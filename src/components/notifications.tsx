import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Bell, Box, ReceiptText, Sparkles } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigateFromNotificationData } from '../navigation/notificationNavigation';
import { Notifications, syncChangedPushToken } from '../notifications/pushNotifications';
import { useNotificationStore } from '../store/notificationStore';
import { gradients, palette, radius, shadow, spacing, type } from '../theme/tokens';
import type { AppNotification } from '../types/domain';
import { useReducedMotion } from '../utils/useReducedMotion';
import { ScalePressable } from './ui';

const processedResponseIds = new Set<string>();

export function NotificationBell({ onPress, tone = 'light' }: { onPress: () => void; tone?: 'light' | 'dark' }) {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const pulse = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!unreadCount || reducedMotion) return;
    Animated.sequence([
      Animated.spring(pulse, { toValue: 1.13, useNativeDriver: Platform.OS !== 'web', speed: 24, bounciness: 7 }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 25, bounciness: 4 }),
    ]).start();
  }, [pulse, reducedMotion, unreadCount]);

  return (
    <ScalePressable
      accessibilityLabel={unreadCount ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
      accessibilityHint="Membuka pusat notifikasi operasional"
      onPress={onPress}
      style={[styles.bellButton, tone === 'dark' && styles.bellButtonDark]}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Bell color={tone === 'dark' ? palette.white : palette.cocoaDark} size={21} strokeWidth={2.1} />
      </Animated.View>
      {unreadCount ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </ScalePressable>
  );
}

export function NotificationBridge({ enabled }: { enabled: boolean }) {
  const load = useNotificationStore((state) => state.load);
  const registerDevice = useNotificationStore((state) => state.registerDevice);
  const markRead = useNotificationStore((state) => state.markRead);
  const reset = useNotificationStore((state) => state.reset);

  useEffect(() => {
    if (!enabled) {
      reset();
      return undefined;
    }
    void load().catch(() => undefined);
    void registerDevice();

    const refresh = () => void load().catch(() => undefined);
    const timer = setInterval(refresh, 30_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        void registerDevice();
      }
    });

    if (Platform.OS === 'web') {
      return () => {
        clearInterval(timer);
        appStateSubscription.remove();
      };
    }

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const requestId = response.notification.request.identifier;
      if (processedResponseIds.has(requestId)) return;
      processedResponseIds.add(requestId);
      const data = response.notification.request.content.data as Record<string, unknown>;
      const notificationId = data.notificationId;
      if (typeof notificationId === 'string') void markRead(notificationId).catch(() => undefined);
      navigateFromNotificationData(data);
    };

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const id = notification.request.content.data?.notificationId;
      if (typeof id === 'string') refresh();
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      void syncChangedPushToken(token).catch(() => undefined);
    });
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) handleResponse(lastResponse);

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
      receivedSubscription.remove();
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [enabled, load, markRead, registerDevice, reset]);

  return <NotificationToast />;
}

function NotificationToast() {
  const insets = useSafeAreaInsets();
  const toast = useNotificationStore((state) => state.toast);
  const dismissToast = useNotificationStore((state) => state.dismissToast);
  const markRead = useNotificationStore((state) => state.markRead);
  const reducedMotion = useReducedMotion();
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return undefined;
    if (reducedMotion) {
      translateY.setValue(0);
      opacity.setValue(1);
    } else {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', speed: 22, bounciness: 5 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
    const timer = setTimeout(() => dismissToast(), 4_500);
    return () => {
      clearTimeout(timer);
      translateY.setValue(-24);
      opacity.setValue(0);
    };
  }, [dismissToast, opacity, reducedMotion, toast, translateY]);

  if (!toast) return null;
  const open = () => {
    void Haptics.selectionAsync();
    void markRead(toast.id).catch(() => undefined);
    navigateFromNotificationData(toast.data);
    dismissToast();
  };

  return (
    <View pointerEvents="box-none" style={[styles.toastLayer, { paddingTop: insets.top + spacing.xs }]}>
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <ScalePressable
          accessibilityLabel={`${toast.title}. ${toast.body}`}
          accessibilityHint="Membuka detail notifikasi"
          onPress={open}
          style={styles.toastShell}
        >
          <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(232,140,164,0.24)', 'rgba(217,154,43,0.08)']} style={StyleSheet.absoluteFill} />
          <View style={styles.toastGlow} />
          <NotificationGlyph item={toast} compact />
          <View style={styles.toastCopy}>
            <View style={styles.toastEyebrowRow}>
              <Sparkles color={palette.honeySoft} size={12} />
              <Text style={styles.toastEyebrow}>LIVE SIGNAL</Text>
            </View>
            <Text numberOfLines={1} style={styles.toastTitle}>{toast.title}</Text>
            <Text numberOfLines={2} style={styles.toastBody}>{toast.body}</Text>
          </View>
        </ScalePressable>
      </Animated.View>
    </View>
  );
}

export function NotificationGlyph({ item, compact = false }: { item: Pick<AppNotification, 'kind'>; compact?: boolean }) {
  const Icon = item.kind === 'sale_created' ? ReceiptText : Box;
  const tone = item.kind === 'sale_created' ? palette.rose : palette.honey;
  return (
    <View style={[styles.glyph, compact && styles.glyphCompact, { borderColor: `${tone}66` }]}>
      <Icon color={tone} size={compact ? 20 : 22} strokeWidth={2.1} />
    </View>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(107,63,42,0.14)',
    ...shadow.glass,
  },
  bellButtonDark: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.15)' },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    backgroundColor: palette.rose,
    borderWidth: 2,
    borderColor: palette.cream,
  },
  badgeText: { color: palette.white, fontFamily: type.bold, fontSize: 9, fontVariant: ['tabular-nums'] },
  toastLayer: { position: 'absolute', zIndex: 1000, top: 0, left: spacing.md, right: spacing.md },
  toastShell: {
    minHeight: 104,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(35,22,18,0.88)',
    ...shadow.floating,
  },
  toastGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: -42, top: -54, backgroundColor: 'rgba(232,140,164,0.15)' },
  toastCopy: { flex: 1, minWidth: 0 },
  toastEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toastEyebrow: { color: palette.honeySoft, fontFamily: type.bold, fontSize: 8, letterSpacing: 1.4 },
  toastTitle: { color: palette.white, fontFamily: type.bold, fontSize: 13, lineHeight: 19, marginTop: 4 },
  toastBody: { color: 'rgba(255,255,255,0.68)', fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 2 },
  glyph: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1 },
  glyphCompact: { width: 44, height: 44, borderRadius: 15 },
});
