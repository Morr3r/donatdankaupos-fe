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

export const setApiAccessToken = (token: string | null) => {
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
