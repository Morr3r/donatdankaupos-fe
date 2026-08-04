import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { notificationService } from '../api/services';
import { sessionStorage } from '../storage/sessionStorage';
import type { PushPermissionState } from '../types/domain';

const CHANNEL_ID = 'operations';
const PUSH_TOKEN_STORAGE_KEY = 'donat_dankau_expo_push_token_v1';
let currentExpoPushToken: string | null = null;
let registrationPromise: Promise<PushRegistrationResult> | null = null;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export interface PushRegistrationResult {
  state: PushPermissionState;
  token?: string;
  message?: string;
}

function getExpoProjectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

function getDeviceName(): string {
  return Device.deviceName ?? `${Device.brand ?? 'Perangkat'} ${Device.modelName ?? ''}`.trim();
}

async function registerExpoToken(devicePushToken?: Notifications.DevicePushToken): Promise<string> {
  const projectId = getExpoProjectId();
  if (!projectId) throw new Error('Project ID Expo belum tersedia.');

  const token = (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;
  await notificationService.registerDevice({
    expoPushToken: token,
    platform: Platform.OS as 'android' | 'ios',
    deviceName: getDeviceName(),
  });
  currentExpoPushToken = token;
  await sessionStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  return token;
}

async function performPushRegistration(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') return { state: 'unsupported' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Aktivitas operasional',
        description: 'Transaksi baru dan perubahan stok Donat Dankau.',
        importance: Notifications.AndroidImportance.MAX,
        lightColor: '#E88CA4',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        sound: 'default',
        vibrationPattern: [0, 180, 90, 180],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      return { state: 'denied', message: 'Izin notifikasi belum diberikan pada perangkat ini.' };
    }

    const token = await registerExpoToken();
    return { state: 'granted', token };
  } catch (error) {
    return {
      state: 'error',
      message: error instanceof Error ? error.message : 'Push notification belum dapat diaktifkan.',
    };
  }
}

export function registerForPushNotifications(): Promise<PushRegistrationResult> {
  registrationPromise ??= performPushRegistration().finally(() => {
    registrationPromise = null;
  });
  return registrationPromise;
}

export async function syncChangedPushToken(devicePushToken: Notifications.DevicePushToken): Promise<void> {
  if (Platform.OS === 'web') return;
  await registerExpoToken(devicePushToken);
}

export async function unregisterCurrentPushDevice(): Promise<void> {
  const token = currentExpoPushToken ?? await sessionStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;
  currentExpoPushToken = null;
  try {
    await notificationService.unregisterDevice(token);
  } finally {
    await sessionStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}

export async function syncApplicationBadge(unreadCount: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(Math.max(0, unreadCount)).catch(() => false);
}

export function openSystemNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

export { Notifications };
