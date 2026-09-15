import { z } from 'zod';
import { normalizeBrandCopy } from '../utils/brand';

const apiErrorSchema = z.object({
  detail: z.unknown().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
export const TERMINAL_ID = process.env.EXPO_PUBLIC_TERMINAL_ID?.trim() ?? '';

let accessToken: string | null = null;
let tokenRefresher: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;
const profileImageCache = new Map<string, Promise<string>>();

export const setApiAccessToken = (token: string | null) => {
  if (token !== accessToken) profileImageCache.clear();
  accessToken = token;
};

export const setTokenRefresher = (refresher: (() => Promise<string | null>) | null) => {
  tokenRefresher = refresher;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encode binary without relying on Buffer/btoa, which are not consistent across web and native runtimes. */
function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const packed = (first << 16) | (second << 8) | third;
    result += BASE64_ALPHABET[(packed >> 18) & 63];
    result += BASE64_ALPHABET[(packed >> 12) & 63];
    result += index + 1 < bytes.length ? BASE64_ALPHABET[(packed >> 6) & 63] : '=';
    result += index + 2 < bytes.length ? BASE64_ALPHABET[packed & 63] : '=';
  }
  return result;
}

async function requestProfileImage(userId: string, retryAfterRefresh = true): Promise<string> {
  if (!API_BASE_URL) {
    throw new ApiError('Layanan belum siap digunakan pada perangkat ini.', 0, 'API_URL_MISSING');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(userId)}/avatar`, {
      signal: controller.signal,
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    if (response.status === 401 && retryAfterRefresh && tokenRefresher) {
      refreshPromise ??= tokenRefresher().finally(() => { refreshPromise = null; });
      const refreshedToken = await refreshPromise;
      if (refreshedToken) {
        setApiAccessToken(refreshedToken);
        return requestProfileImage(userId, false);
      }
    }

    if (!response.ok) {
      const raw = await response.json().catch(() => ({}));
      const parsed = apiErrorSchema.safeParse(raw);
      const error = parsed.success ? parsed.data : {};
      const detail = typeof error.detail === 'string' ? error.detail : undefined;
      throw new ApiError(error.message ?? detail ?? 'Foto profil tidak dapat dimuat.', response.status, error.code);
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!mimeType?.startsWith('image/')) {
      throw new ApiError('Format foto profil tidak dikenali.', 500, 'INVALID_AVATAR_TYPE');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new ApiError('Foto profil kosong.', 500, 'EMPTY_AVATAR');
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Foto profil terlalu lama dimuat.', 408, 'TIMEOUT');
    }
    throw new ApiError('Foto profil tidak dapat dimuat.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve an authenticated avatar to an in-memory data URI. React Native Web cannot
 * attach Authorization headers to the browser image element, so fetching the bytes
 * first keeps profile photos working consistently on Android, iOS, and PWA builds.
 */
export function loadProfileImage(userId: string, version: string): Promise<string> {
  const cacheKey = `${userId}:${version}`;
  const cached = profileImageCache.get(cacheKey);
  if (cached) return cached;

  const pending = requestProfileImage(userId);
  profileImageCache.set(cacheKey, pending);
  void pending.catch(() => {
    if (profileImageCache.get(cacheKey) === pending) profileImageCache.delete(cacheKey);
  });
  return pending;
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; timeoutMs?: number; skipAuthRefresh?: boolean };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError('Layanan belum siap digunakan pada perangkat ini.', 0, 'API_URL_MISSING');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  const { body, timeoutMs: _timeoutMs, skipAuthRefresh, ...requestInit } = options;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401 && !skipAuthRefresh && tokenRefresher) {
      refreshPromise ??= tokenRefresher().finally(() => { refreshPromise = null; });
      const refreshedToken = await refreshPromise;
      if (refreshedToken) {
        setApiAccessToken(refreshedToken);
        return apiRequest<T>(path, { ...options, skipAuthRefresh: true });
      }
    }

    if (!response.ok) {
      const raw = await response.json().catch(() => ({}));
      const parsed = apiErrorSchema.safeParse(raw);
      const error = parsed.success ? parsed.data : {};
      const detail = typeof error.detail === 'string' ? error.detail : undefined;
      throw new ApiError(error.message ?? detail ?? 'Permintaan gagal diproses.', response.status, error.code);
    }

    if (response.status === 204) return undefined as T;
    return normalizeBrandCopy((await response.json()) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Koneksi terlalu lama. Periksa jaringan lalu coba lagi.', 408, 'TIMEOUT');
    }
    throw new ApiError('Tidak dapat terhubung. Periksa koneksi lalu coba lagi.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiFileRequest(path: string, retryAfterRefresh = true): Promise<{ bytes: Uint8Array; filename: string }> {
  if (!API_BASE_URL) {
    throw new ApiError('Layanan belum siap digunakan pada perangkat ini.', 0, 'API_URL_MISSING');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (response.status === 401 && retryAfterRefresh && tokenRefresher) {
      refreshPromise ??= tokenRefresher().finally(() => { refreshPromise = null; });
      const refreshedToken = await refreshPromise;
      if (refreshedToken) {
        setApiAccessToken(refreshedToken);
        return apiFileRequest(path, false);
      }
    }
    if (!response.ok) {
      const raw = await response.json().catch(() => ({}));
      const parsed = apiErrorSchema.safeParse(raw);
      const error = parsed.success ? parsed.data : {};
      const detail = typeof error.detail === 'string' ? error.detail : undefined;
      throw new ApiError(error.message ?? detail ?? 'File laporan tidak dapat dibuat.', response.status, error.code);
    }
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'laporan-operasional.xlsx';
    return { bytes: new Uint8Array(await response.arrayBuffer()), filename };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Pembuatan laporan terlalu lama. Silakan coba lagi.', 408, 'TIMEOUT');
    }
    throw new ApiError('File laporan tidak dapat diunduh. Periksa koneksi lalu coba lagi.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}
