import { create } from 'zustand';
import { notificationService } from '../api/services';
import { registerForPushNotifications, syncApplicationBadge } from '../notifications/pushNotifications';
import type { AppNotification, NotificationFeed, NotificationKind, PushPermissionState, PushTestResult } from '../types/domain';

interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  permissionState: PushPermissionState;
  permissionMessage: string | null;
  isTestingPush: boolean;
  toast: AppNotification | null;
  load: (kind?: NotificationKind) => Promise<NotificationFeed>;
  registerDevice: () => Promise<void>;
  testPush: () => Promise<PushTestResult>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  showToastById: (id: string) => Promise<void>;
  dismissToast: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  permissionState: 'unknown',
  permissionMessage: null,
  isTestingPush: false,
  toast: null,
  load: async (kind) => {
    set({ isLoading: true, error: null });
    try {
      const feed = await notificationService.list(kind);
      set({ items: feed.items, unreadCount: feed.unreadCount, isLoading: false });
      void syncApplicationBadge(feed.unreadCount);
      return feed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notifikasi belum dapat dimuat.';
      set({ isLoading: false, error: message });
      throw error;
    }
  },
  registerDevice: async () => {
    set({ permissionState: 'registering', permissionMessage: null });
    const result = await registerForPushNotifications();
    set({ permissionState: result.state, permissionMessage: result.message ?? null });
  },
  testPush: async () => {
    set({ isTestingPush: true, error: null });
    try {
      const registration = await registerForPushNotifications();
      set({ permissionState: registration.state, permissionMessage: registration.message ?? null });
      if (registration.state !== 'granted') {
        throw new Error(registration.message ?? 'Push notification belum aktif pada perangkat ini.');
      }
      return await notificationService.testPush();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notifikasi uji gagal dikirim.';
      set({ error: message });
      throw error;
    } finally {
      set({ isTestingPush: false });
    }
  },
  markRead: async (id) => {
    const item = get().items.find((candidate) => candidate.id === id);
    if (!item || item.readAt) return;
    const saved = await notificationService.read(id);
    const unreadCount = Math.max(0, get().unreadCount - 1);
    set({
      items: get().items.map((candidate) => candidate.id === id ? saved : candidate),
      unreadCount,
    });
    void syncApplicationBadge(unreadCount);
  },
  markAllRead: async () => {
    if (!get().unreadCount) return;
    await notificationService.readAll();
    const readAt = new Date().toISOString();
    set({ items: get().items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })), unreadCount: 0 });
    void syncApplicationBadge(0);
  },
  showToastById: async (id) => {
    try {
      const feed = await get().load();
      const item = feed.items.find((candidate) => candidate.id === id);
      if (item) set({ toast: item });
    } catch {
      // Push sistem tetap tampil walau inbox belum dapat disegarkan.
    }
  },
  dismissToast: () => set({ toast: null }),
  reset: () => {
    set({
      items: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      permissionState: 'unknown',
      permissionMessage: null,
      isTestingPush: false,
      toast: null,
    });
    void syncApplicationBadge(0);
  },
}));
