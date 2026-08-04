import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowRight, Banknote, Clock3, PackageOpen, ReceiptText, ShoppingBag, TrendingUp, Users } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart, MetricCard } from '../components/data';
import { BrandLogo, Button, GlassCard, Header, ScalePressable, Screen, SectionHeader, StatusPill } from '../components/ui';
import { reportService, type SalesSummary } from '../api/services';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { useSessionStore } from '../store/sessionStore';
import { gradients, palette, radius, spacing, type } from '../theme/tokens';
import { formatClock, formatCompact, formatCurrency, getGreeting, getPaymentLabel } from '../utils/format';
import { useResponsiveLayout } from '../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { NotificationBell } from '../components/notifications';

const toDateParam = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isLandscapePhone, width } = useResponsiveLayout();
  const user = useSessionStore((state) => state.user);
  const shift = useOperationsStore((state) => state.shift);
  const transactions = useOperationsStore((state) => state.transactions);
  const [todaySummary, setTodaySummary] = useState<SalesSummary | null>(null);
  const [weekSummary, setWeekSummary] = useState<SalesSummary | null>(null);
  const todaySales = todaySummary?.revenue ?? 0;
  const itemCount = todaySummary?.pieceCount ?? todaySummary?.itemCount ?? 0;
  const recentPaidTransactions = transactions.filter((transaction) => transaction.status === 'paid').slice(0, 3);
  const compactTransactions = width < 480;
  const smallPhone = width < 360;

  useFocusEffect(useCallback(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    Promise.all([
      reportService.summary(toDateParam(today), toDateParam(today)),
      reportService.summary(toDateParam(weekStart), toDateParam(today)),
    ]).then(([current, week]) => {
      setTodaySummary(current);
      setWeekSummary(week);
    }).catch(() => undefined);
  }, []));

  return (
    <Screen>
      <Header
        brand={<BrandLogo style={styles.headerLogo} width={128} />}
        subtitle={`${getGreeting()}, ${user?.name?.split(' ')[0] ?? 'Kasir'}`}
        title="Ringkasan hari ini"
        right={<NotificationBell onPress={() => navigation.navigate('Notifications')} />}
      />

      <GlassCard dark style={styles.heroCard} contentStyle={[styles.heroContent, isLandscapePhone && styles.heroContentLandscape]}>
        <LinearGradient colors={gradients.primary} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroOrb, styles.pointerNone]} />
        <View style={styles.heroTop}>
          <StatusPill label="Shift aktif" tone="success" />
          <View style={styles.shiftTime}><Clock3 color={palette.honeySoft} size={15} /><Text style={styles.shiftTimeText}>Sejak {shift ? formatClock(shift.openedAt) : '--:--'}</Text></View>
        </View>
        <Text style={[styles.heroLabel, isLandscapePhone && styles.heroLabelLandscape]}>Penjualan bersih</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.heroValue, isLandscapePhone && styles.heroValueLandscape]}>{formatCurrency(todaySales)}</Text>
        <Text style={styles.heroHelper}>{todaySummary?.transactionCount ?? 0} transaksi berhasil · rerata {formatCurrency(todaySummary?.averageOrderValue ?? 0)}</Text>
        <Button icon={ShoppingBag} label="Buat transaksi baru" onPress={() => navigation.navigate('MainTabs', { screen: 'POS' })} style={[styles.heroButton, isLandscapePhone && styles.heroButtonLandscape, smallPhone && styles.heroButtonFull]} variant="secondary" />
      </GlassCard>

      <SectionHeader title="Performa outlet" />
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCell, width >= 900 ? styles.metricCellWide : smallPhone ? styles.metricCellFull : styles.metricCellHalf]}><MetricCard accent={palette.cocoa} helper={todaySummary?.previousPeriodGrowthPercent === null || todaySummary?.previousPeriodGrowthPercent === undefined ? 'Belum ada periode pembanding' : `${todaySummary.previousPeriodGrowthPercent >= 0 ? '+' : ''}${todaySummary.previousPeriodGrowthPercent}% dari kemarin`} icon={<TrendingUp color={palette.cocoa} size={21} />} label="Omzet" value={formatCompact(todaySales)} /></View>
        <View style={[styles.metricCell, width >= 900 ? styles.metricCellWide : smallPhone ? styles.metricCellFull : styles.metricCellHalf]}><MetricCard accent={palette.rose} helper="Transaksi lunas hari ini" icon={<ReceiptText color={palette.rose} size={21} />} label="Transaksi" value={String(todaySummary?.transactionCount ?? 0)} /></View>
        <View style={[styles.metricCell, width >= 900 ? styles.metricCellWide : smallPhone ? styles.metricCellFull : styles.metricCellHalf]}><MetricCard accent={palette.honey} helper="Total donat terjual" icon={<PackageOpen color={palette.honey} size={21} />} label="Pcs terjual" value={String(itemCount)} /></View>
        <View style={[styles.metricCell, width >= 900 ? styles.metricCellWide : smallPhone ? styles.metricCellFull : styles.metricCellHalf]}><MetricCard accent={palette.success} helper="Nilai per transaksi" icon={<Users color={palette.success} size={21} />} label="Rerata struk" value={formatCompact(todaySummary?.averageOrderValue ?? 0)} /></View>
      </View>

      <SectionHeader title="Akses cepat" />
      <View style={styles.quickGrid}>
        <QuickAction fullWidth={smallPhone} icon={<ShoppingBag color={palette.cocoa} size={22} />} label="Kasir" onPress={() => navigation.navigate('MainTabs', { screen: 'POS' })} tone={palette.roseSoft} />
        <QuickAction fullWidth={smallPhone} icon={<ReceiptText color={palette.info} size={22} />} label="Riwayat" onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })} tone={palette.infoSoft} />
        <QuickAction fullWidth={smallPhone} icon={<PackageOpen color={palette.success} size={22} />} label="Stok" onPress={() => navigation.navigate('Inventory')} tone={palette.successSoft} />
        <QuickAction fullWidth={smallPhone} icon={<Banknote color={palette.honey} size={22} />} label="Shift" onPress={() => navigation.navigate('Shift')} tone={palette.honeySoft} />
      </View>

      <SectionHeader actionLabel="Laporan lengkap" onAction={() => navigation.navigate('MainTabs', { screen: 'Reports' })} title="Tren 7 hari" />
      <GlassCard contentStyle={styles.chartCard}>
        <View style={styles.chartHeading}>
          <View style={styles.chartCopy}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.chartValue}>{formatCurrency(weekSummary?.revenue ?? 0)}</Text><Text style={styles.chartCaption}>Total 7 hari terakhir</Text></View>
          {weekSummary?.previousPeriodGrowthPercent !== null && weekSummary?.previousPeriodGrowthPercent !== undefined ? <View style={styles.trendPill}><TrendingUp color={palette.success} size={15} /><Text style={styles.trendText}>{weekSummary.previousPeriodGrowthPercent >= 0 ? '+' : ''}{weekSummary.previousPeriodGrowthPercent}%</Text></View> : null}
        </View>
        <BarChart data={weekSummary?.series ?? []} />
      </GlassCard>

      <SectionHeader actionLabel="Lihat semua" onAction={() => navigation.navigate('MainTabs', { screen: 'Orders' })} title="Transaksi terbaru" />
      <GlassCard contentStyle={styles.transactionCard}>
        {recentPaidTransactions.length ? recentPaidTransactions.map((transaction, index) => (
          <ScalePressable key={transaction.id} accessibilityLabel={`Buka transaksi ${transaction.receiptNo}`} onPress={() => navigation.navigate('OrderDetail', { transactionId: transaction.id })} style={[styles.transactionRow, compactTransactions && styles.transactionRowCompact, index > 0 && styles.transactionBorder]}>
            <View style={styles.receiptIcon}><ReceiptText color={palette.cocoa} size={19} /></View>
            <View style={styles.transactionCopy}>
              <Text numberOfLines={2} style={styles.transactionId}>{transaction.receiptNo}</Text>
              <Text style={styles.transactionMeta}>{formatClock(transaction.paidAt ?? transaction.createdAt)} · {transaction.itemCount} item · {getPaymentLabel(transaction.paymentMethod)}</Text>
              {compactTransactions ? <View style={styles.transactionAmountCompact}><Text numberOfLines={1} style={styles.transactionValue}>{formatCurrency(transaction.total)}</Text><ArrowRight color={palette.muted} size={17} /></View> : null}
            </View>
            {!compactTransactions ? <View style={styles.transactionAmount}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.transactionValue}>{formatCurrency(transaction.total)}</Text><ArrowRight color={palette.muted} size={17} /></View> : null}
          </ScalePressable>
        )) : <Text style={styles.transactionEmpty}>Belum ada transaksi berhasil pada shift ini.</Text>}
      </GlassCard>
    </Screen>
  );
}

function QuickAction({ icon, label, tone, onPress, fullWidth }: { icon: React.ReactNode; label: string; tone: string; onPress: () => void; fullWidth?: boolean }) {
  return (
    <ScalePressable accessibilityLabel={label} onPress={onPress} style={[styles.quickAction, fullWidth && styles.quickActionFull]}>
      <View style={[styles.quickIcon, { backgroundColor: tone }]}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
      <ArrowRight color={palette.muted} size={16} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  pointerNone: { pointerEvents: 'none' },
  headerLogo: { alignSelf: 'flex-start' },
  heroCard: { marginTop: spacing.xs },
  heroContent: { padding: spacing.lg, minHeight: 278 },
  heroContentLandscape: { minHeight: 208, padding: spacing.md },
  heroOrb: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(232,140,164,0.18)', right: -45, top: -65 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shiftTime: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftTimeText: { color: palette.honeySoft, fontFamily: type.semibold, fontSize: 11 },
  heroLabel: { color: 'rgba(255,255,255,0.68)', fontFamily: type.medium, fontSize: 12, marginTop: spacing.lg },
  heroLabelLandscape: { marginTop: spacing.sm },
  heroValue: { color: palette.white, fontFamily: type.display, fontSize: 34, marginTop: 3 },
  heroValueLandscape: { fontSize: 30 },
  heroHelper: { color: 'rgba(255,255,255,0.72)', fontFamily: type.regular, fontSize: 11, marginTop: 3 },
  heroButton: { marginTop: spacing.lg, alignSelf: 'flex-start', minWidth: 208 },
  heroButtonLandscape: { marginTop: spacing.sm },
  heroButtonFull: { alignSelf: 'stretch', minWidth: 0 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCell: { minWidth: 0, flexGrow: 1 },
  metricCellFull: { flexBasis: '100%' },
  metricCellHalf: { flexBasis: '47%' },
  metricCellWide: { flexBasis: '23%' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickAction: { minHeight: 68, minWidth: '47%', flex: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.66)', borderWidth: 1, borderColor: palette.line },
  quickActionFull: { minWidth: '100%' },
  quickIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { flex: 1, color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  chartCard: { padding: spacing.lg },
  chartHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chartCopy: { flex: 1, minWidth: 0 },
  chartValue: { color: palette.ink, fontFamily: type.bold, fontSize: 20 },
  chartCaption: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 2 },
  trendPill: { minHeight: 32, paddingHorizontal: spacing.sm, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.successSoft },
  trendText: { color: palette.success, fontFamily: type.bold, fontSize: 11 },
  transactionCard: { paddingHorizontal: spacing.md },
  transactionRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  transactionRowCompact: { minHeight: 96, alignItems: 'flex-start', paddingVertical: spacing.sm },
  transactionBorder: { borderTopWidth: 1, borderTopColor: palette.line },
  receiptIcon: { width: 42, height: 42, flexShrink: 0, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionId: { color: palette.ink, fontFamily: type.bold, fontSize: 12, lineHeight: 17 },
  transactionMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 3 },
  transactionAmount: { maxWidth: '42%', minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  transactionAmountCompact: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  transactionValue: { minWidth: 0, flexShrink: 1, color: palette.cocoa, fontFamily: type.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  transactionEmpty: { color: palette.muted, fontFamily: type.medium, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: spacing.xl },
});
