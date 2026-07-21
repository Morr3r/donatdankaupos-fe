import { create } from 'zustand';
import { authService } from '../api/services';
import { setApiAccessToken, setTokenRefresher } from '../api/client';
import { sessionStorage } from '../storage/sessionStorage';
import type { LoginPayload, User } from '../types/domain';
import { normalizeBrandCopy } from '../utils/brand';

const SESSION_KEY = 'donat_dankau_session_v1';

type SessionStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface SessionState {
  status: SessionStatus;
  user: User | null;
  isSubmitting: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const configureTokenRefresh = () => {
  setTokenRefresher(async () => {
    try {
      const raw = await sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const current = JSON.parse(raw) as StoredSession;
      const refreshed = await authService.refresh(current.refreshToken);
      await sessionStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
      return refreshed.accessToken;
    } catch {
      await sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  });
};

export const useSessionStore = create<SessionState>((set) => ({
  status: 'bootstrapping',
  user: null,
  isSubmitting: false,
  error: null,
  hydrate: async () => {
    try {
      const raw = await sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        set({ status: 'unauthenticated' });
        return;
      }
      const session = normalizeBrandCopy(JSON.parse(raw) as StoredSession);
      await sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setApiAccessToken(session.accessToken);
      configureTokenRefresh();
      set({ status: 'authenticated', user: session.user });
    } catch {
      await sessionStorage.removeItem(SESSION_KEY);
      setApiAccessToken(null);
      setTokenRefresher(null);
      set({ status: 'unauthenticated', user: null });
    }
  },
  login: async (payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const response = await authService.login(payload);
      const stored: StoredSession = response;
      await sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
      setApiAccessToken(response.accessToken);
      configureTokenRefresh();
      set({ status: 'authenticated', user: response.user, isSubmitting: false });
    } catch (error) {
      set({ isSubmitting: false, error: error instanceof Error ? error.message : 'Login gagal.' });
      throw error;
    }
  },
  logout: async () => {
    try {
      const raw = await sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as StoredSession;
        await authService.logout(session.refreshToken);
      }
    } finally {
      await sessionStorage.removeItem(SESSION_KEY);
      setApiAccessToken(null);
      setTokenRefresher(null);
      set({ status: 'unauthenticated', user: null });
    }
  },
  clearError: () => set({ error: null }),
}));
