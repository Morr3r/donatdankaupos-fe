import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BellRing, CheckCheck, ChevronRight, Inbox, Radio, RefreshCw, Settings2, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { NotificationGlyph } from '../components/notifications';
import { Button, Chip, GlassCard, Header, ScalePressable, Screen, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { openSystemNotificationSettings } from '../notifications/pushNotifications';
import { useNotificationStore } from '../store/notificationStore';
import { gradients, palette, radius, shadow, spacing, type } from '../theme/tokens';
import type { AppNotification, NotificationKind } from '../types/domain';
import { formatCurrency } from '../utils/format';
import { useResponsiveLayout } from '../utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
type NotificationFilter = 'all' | NotificationKind;

const filterOptions: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'Semua sinyal' },
  { id: 'sale_created', label: 'Transaksi' },
  { id: 'stock_adjusted', label: 'Stok' },
];

export function NotificationsScreen({ navigation }: Props) {
  const { isLandscapePhone } = useResponsiveLayout();
  const items = useNotificationStore((state) => state.items);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isLoading = useNotificationStore((state) => state.isLoading);
  const error = useNotificationStore((state) => state.error);
  const permissionState = useNotificationStore((state) => state.permissionState);
  const permissionMessage = useNotificationStore((state) => state.permissionMessage);
  const isTestingPush = useNotificationStore((state) => state.isTestingPush);
  const load = useNotificationStore((state) => state.load);
  const registerDevice = useNotificationStore((state) => state.registerDevice);
  const testPush = useNotificationStore((state) => state.testPush);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const sendTestPush = async () => {
    void Haptics.selectionAsync();
    try {
      const result = await testPush();
      Alert.alert('Notifikasi uji dikirim', result.message);
    } catch (testError) {
      Alert.alert(
        'Notifikasi uji gagal',
        testError instanceof Error ? testError.message : 'Periksa izin dan koneksi perangkat lalu coba kembali.',
      );
    }
  };

  useFocusEffect(useCallback(() => {
    void load().catch(() => undefined);
  }, [load]));

  const filtered = useMemo(
    () => filter === 'all' ? items : items.filter((item) => item.kind === filter),
    [filter, items],
  );
  const transactionCount = items.filter((item) => item.kind === 'sale_created').length;
  const stockCount = items.filter((item) => item.kind === 'stock_adjusted').length;

  const openNotification = async (item: AppNotification) => {
    void Haptics.selectionAsync();
    await markRead(item.id).catch(() => undefined);
    if (item.data.route === 'order_detail' && typeof item.data.transactionId === 'string') {
      navigation.navigate('OrderDetail', { transactionId: item.data.transactionId });
      return;
    }
    if (item.data.route === 'inventory') {
      navigation.navigate('Inventory');
    }
  };

  return (
    <Screen bottomInset={spacing.md} contentStyle={styles.screen} scroll={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <Header
              eyebrow="Operations intelligence"
              onBack={navigation.goBack}
              subtitle="Sinyal real-time lintas owner dan staff"
              title="Notification Center"
            />
            <GlassCard dark style={styles.commandCard} contentStyle={[styles.commandSurface, isLandscapePhone && styles.commandSurfaceLandscape]}>
              <LinearGradient colors={gradients.notification} style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={styles.commandGlowRose} />
              <View pointerEvents="none" style={styles.commandGlowGold} />
              <View style={[styles.commandLayout, isLandscapePhone && styles.commandLayoutLandscape]}>
                <View style={styles.signalVisual}>
                  <View style={styles.signalRingOuter}>
                    <View style={styles.signalRingInner}><Radio color={palette.rose} size={29} strokeWidth={1.8} /></View>
                  </View>
                  <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
                </View>
                <View style={styles.commandCopy}>
                  <View style={styles.commandEyebrow}><Sparkles color={palette.champagne} size={13} /><Text style={styles.commandEyebrowText}>SIGNAL COMMAND</Text></View>
                  <Text style={styles.commandValue}>{unreadCount}</Text>
                  <Text style={styles.commandLabel}>{unreadCount === 1 ? 'sinyal belum dibaca' : 'sinyal belum dibaca'}</Text>
                  <Text style={styles.commandHelper}>Semua aktivitas penting tersinkron aman ke perangkat Anda.</Text>
                </View>
              </View>
              <View style={styles.commandFooter}>
                <StatusPill label={permissionState === 'granted' ? 'Push aktif' : 'Inbox sinkron'} tone={permissionState === 'granted' ? 'success' : 'info'} />
                <Button compact disabled={!unreadCount} icon={CheckCheck} label="Baca semua" onPress={() => void markAllRead()} variant="secondary" />
              </View>
            </GlassCard>

            <View style={styles.metricsRow}>
              <SignalMetric label="Transaksi" value={transactionCount} tone={palette.rose} />
              <SignalMetric label="Perubahan stok" value={stockCount} tone={palette.honey} />
            </View>

            <View style={styles.filterRow}>
              {filterOptions.map((option) => (
                <Chip key={option.id} label={option.label} onPress={() => setFilter(option.id)} selected={filter === option.id} />
              ))}
            </View>

            {permissionState !== 'granted' ? (
              <PushPermissionCard
                message={permissionMessage}
                onActivate={() => void registerDevice()}
                onSettings={() => void openSystemNotificationSettings()}
                state={permissionState}
              />
            ) : (
              <GlassCard contentStyle={styles.testCard}>
                <View style={styles.permissionIcon}><BellRing color={palette.success} size={21} /></View>
                <View style={styles.permissionCopy}>
                  <Text style={styles.permissionTitle}>Push perangkat terhubung</Text>
                  <Text style={styles.permissionBody}>Kirim pesan dari server untuk memastikan banner sistem muncul saat aplikasi aktif maupun ditutup.</Text>
                </View>
                <Button compact icon={Radio} label="Kirim uji" loading={isTestingPush} onPress={() => void sendTestPush()} variant="secondary" />
              </GlassCard>
            )}
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            <View style={styles.feedHeading}>
              <View><Text style={styles.feedEyebrow}>ACTIVITY STREAM</Text><Text accessibilityRole="header" style={styles.feedTitle}>Sinyal terbaru</Text></View>
              <ScalePressable accessibilityLabel="Segarkan notifikasi" onPress={() => void load()} style={styles.refreshButton}>
                <RefreshCw color={palette.cocoa} size={19} />
              </ScalePressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyNotifications loading={isLoading} />}
        onRefresh={() => void load()}
        refreshing={isLoading}
        renderItem={({ item }) => <NotificationCard item={item} onPress={() => void openNotification(item)} />}
        showsVerticalScrollIndicator={false}
        style={styles.feed}
      />
    </Screen>
  );
}

function SignalMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <GlassCard style={styles.metricCard} contentStyle={styles.metricSurface}>
      <View style={[styles.metricIndicator, { backgroundColor: tone }]} />
      <View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
    </GlassCard>
  );
}

function NotificationCard({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const unread = !item.readAt;
  const actionLabel = item.kind === 'sale_created' ? 'Lihat transaksi' : 'Buka stok';
  const detailValue = item.kind === 'sale_created' && typeof item.data.total === 'number'
    ? formatCurrency(item.data.total)
    : item.kind === 'stock_adjusted' && typeof item.data.stockAfter === 'number'
      ? `${item.data.stockAfter} pcs`
      : null;
  return (
    <ScalePressable
      accessibilityLabel={`${unread ? 'Belum dibaca. ' : ''}${item.title}. ${item.body}`}
      accessibilityHint={actionLabel}
      onPress={onPress}
      style={[styles.notificationCard, unread && styles.notificationCardUnread]}
    >
      {unread ? <View style={styles.unreadBeam} /> : null}
      <View style={styles.notificationTop}>
        <NotificationGlyph item={item} />
        <View style={styles.notificationMeta}>
          <View style={styles.notificationMetaRow}>
            <Text style={styles.notificationKind}>{item.kind === 'sale_created' ? 'TRANSACTION SIGNAL' : 'INVENTORY SIGNAL'}</Text>
            {unread ? <View style={styles.unreadPill}><View style={styles.unreadDot} /><Text style={styles.unreadText}>BARU</Text></View> : null}
          </View>
          <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
        </View>
        {detailValue ? <Text style={styles.detailValue}>{detailValue}</Text> : null}
      </View>
      <Text style={styles.notificationTitle}>{item.title}</Text>
      <Text style={styles.notificationBody}>{item.body}</Text>
      <View style={styles.notificationFooter}>
        <View style={styles.secureRow}><ShieldCheck color={palette.success} size={14} /><Text style={styles.secureText}>Terverifikasi sistem</Text></View>
        <View style={styles.actionRow}><Text style={styles.actionText}>{actionLabel}</Text><ChevronRight color={palette.cocoa} size={17} /></View>
      </View>
    </ScalePressable>
  );
}

function PushPermissionCard({
  state,
  message,
  onActivate,
  onSettings,
}: {
  state: ReturnType<typeof useNotificationStore.getState>['permissionState'];
  message: string | null;
  onActivate: () => void;
  onSettings: () => void;
}) {
  const isDenied = state === 'denied';
  const isWeb = state === 'unsupported';
  return (
    <GlassCard contentStyle={styles.permissionCard}>
      <View style={styles.permissionIcon}><BellRing color={palette.cocoa} size={21} /></View>
      <View style={styles.permissionCopy}>
        <Text style={styles.permissionTitle}>{isWeb ? 'Inbox real-time aktif' : isDenied ? 'Push belum diizinkan' : 'Aktifkan push premium'}</Text>
        <Text style={styles.permissionBody}>{isWeb ? 'Push sistem tersedia di aplikasi Android/iOS. Inbox ini tetap tersinkron.' : message ?? 'Terima sinyal operasional walau aplikasi sedang ditutup.'}</Text>
      </View>
      {!isWeb ? <Button compact icon={isDenied ? Settings2 : BellRing} label={isDenied ? 'Pengaturan' : 'Aktifkan'} loading={state === 'registering'} onPress={isDenied ? onSettings : onActivate} variant="secondary" /> : null}
    </GlassCard>
  );
}

function EmptyNotifications({ loading }: { loading: boolean }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Inbox color={palette.rose} size={31} strokeWidth={1.8} /></View>
      <Text style={styles.emptyTitle}>{loading ? 'Menyelaraskan sinyal...' : 'Semua tenang'}</Text>
      <Text style={styles.emptyBody}>{loading ? 'Mengambil aktivitas terbaru dari pusat operasi.' : 'Transaksi staff dan perubahan stok owner akan muncul di sini.'}</Text>
    </View>
  );
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const differenceMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (differenceMinutes < 1) return 'Baru saja';
  if (differenceMinutes < 60) return `${differenceMinutes} menit lalu`;
  if (differenceMinutes < 24 * 60) return `${Math.floor(differenceMinutes / 60)} jam lalu`;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(date);
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  feed: { flex: 1, minHeight: 0 },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  headerContent: { gap: spacing.md },
  commandCard: { overflow: 'hidden' },
  commandSurface: { minHeight: 298, padding: spacing.lg, justifyContent: 'space-between' },
  commandSurfaceLandscape: { minHeight: 218, padding: spacing.md },
  commandGlowRose: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(232,140,164,0.16)', right: -80, top: -110 },
  commandGlowGold: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(243,197,107,0.09)', left: -86, bottom: -120 },
  commandLayout: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  commandLayoutLandscape: { gap: spacing.md },
  signalVisual: { width: 104, alignItems: 'center', gap: spacing.xs },
  signalRingOuter: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: 'rgba(232,140,164,0.28)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.035)' },
  signalRingInner: { width: 69, height: 69, borderRadius: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(243,197,107,0.26)', backgroundColor: 'rgba(255,255,255,0.055)' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, minHeight: 24, borderRadius: radius.pill, backgroundColor: 'rgba(38,122,85,0.20)', borderWidth: 1, borderColor: 'rgba(90,196,143,0.24)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5AC48F' },
  liveText: { color: '#8CE0B5', fontFamily: type.bold, fontSize: 8, letterSpacing: 1.1 },
  commandCopy: { flex: 1, minWidth: 0 },
  commandEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commandEyebrowText: { color: palette.champagne, fontFamily: type.bold, fontSize: 9, letterSpacing: 1.5 },
  commandValue: { color: palette.white, fontFamily: type.display, fontSize: 48, lineHeight: 56, marginTop: 3, fontVariant: ['tabular-nums'] },
  commandLabel: { color: palette.white, fontFamily: type.semibold, fontSize: 13 },
  commandHelper: { maxWidth: 330, color: 'rgba(255,255,255,0.58)', fontFamily: type.regular, fontSize: 10, lineHeight: 16, marginTop: 5 },
  commandFooter: { minHeight: 54, paddingTop: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1 },
  metricSurface: { minHeight: 84, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metricIndicator: { width: 5, height: 38, borderRadius: radius.pill },
  metricValue: { color: palette.ink, fontFamily: type.bold, fontSize: 20, fontVariant: ['tabular-nums'] },
  metricLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10, marginTop: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  permissionCard: { minHeight: 92, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  testCard: { minHeight: 92, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  permissionIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.champagneSoft, alignItems: 'center', justifyContent: 'center' },
  permissionCopy: { flex: 1, minWidth: 0 },
  permissionTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 12 },
  permissionBody: { color: palette.muted, fontFamily: type.regular, fontSize: 9, lineHeight: 14, marginTop: 3 },
  feedHeading: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedEyebrow: { color: palette.rose, fontFamily: type.bold, fontSize: 8, letterSpacing: 1.4 },
  feedTitle: { color: palette.ink, fontFamily: type.displayRegular, fontSize: 20, marginTop: 2 },
  refreshButton: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.glassStrong, borderWidth: 1, borderColor: palette.line },
  notificationCard: { overflow: 'hidden', minHeight: 196, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.78)', ...shadow.glass },
  notificationCardUnread: { borderColor: 'rgba(232,140,164,0.40)', backgroundColor: 'rgba(255,253,249,0.96)' },
  unreadBeam: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: palette.rose },
  notificationTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notificationMeta: { flex: 1, minWidth: 0 },
  notificationMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  notificationKind: { flexShrink: 1, color: palette.cocoa, fontFamily: type.bold, fontSize: 8, letterSpacing: 1.2 },
  notificationTime: { color: palette.muted, fontFamily: type.regular, fontSize: 9, marginTop: 4 },
  unreadPill: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 7, backgroundColor: palette.roseSoft },
  unreadDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.rose },
  unreadText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 7, letterSpacing: 0.6 },
  detailValue: { maxWidth: '30%', color: palette.cocoa, fontFamily: type.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  notificationTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  notificationBody: { color: palette.inkSoft, fontFamily: type.regular, fontSize: 11, lineHeight: 18, marginTop: 5 },
  notificationFooter: { minHeight: 42, paddingTop: spacing.sm, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  secureText: { color: palette.success, fontFamily: type.medium, fontSize: 9 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 10 },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft, borderWidth: 1, borderColor: 'rgba(232,140,164,0.24)' },
  emptyTitle: { color: palette.ink, fontFamily: type.displayRegular, fontSize: 20, marginTop: spacing.md },
  emptyBody: { maxWidth: 300, color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: spacing.xs },
  error: { color: palette.danger, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
});
