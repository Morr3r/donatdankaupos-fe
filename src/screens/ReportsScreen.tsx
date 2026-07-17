import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import { FileSpreadsheet, PackageCheck, ReceiptText, RefreshCw, TrendingUp, WalletCards } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { reportService, type SalesSummary } from '../api/services';
import { BarChart, MetricCard, ProgressRow } from '../components/data';
import { DateRangePicker } from '../components/date-range-picker';
import { Button, GlassCard, Header, Screen, SectionHeader } from '../components/ui';
import { palette, spacing, type } from '../theme/tokens';
import { type DateRangeSelection, formatRangeLabel, makeDateRange, toDateParam } from '../utils/date';
import { formatCompact, formatCurrency, formatPercent, paymentLabels } from '../utils/format';

const DEFAULT_HPP_PER_ITEM = 2_650;

export function ReportsScreen() {
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<DateRangeSelection>(() => makeDateRange('month'));
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const from = toDateParam(range.from);
  const to = toDateParam(range.to);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await reportService.summary(from, to));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Laporan tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useFocusEffect(useCallback(() => {
    loadReport();
  }, [loadReport]));

  const exportExcel = async () => {
    setExporting(true);
    setError(null);
    try {
      const result = await reportService.exportXlsx(from, to);
      if (Platform.OS === 'web') {
        const arrayBuffer = new ArrayBuffer(result.bytes.byteLength);
        new Uint8Array(arrayBuffer).set(result.bytes);
        const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return;
      }
      const file = new File(Paths.cache, result.filename);
      file.create({ overwrite: true });
      file.write(result.bytes);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: 'Simpan atau bagikan laporan penjualan',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
        });
      } else {
        Alert.alert('Laporan selesai dibuat', `File tersimpan sebagai ${result.filename}.`);
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Laporan Excel belum dapat dibuat.');
    } finally {
      setExporting(false);
    }
  };

  const revenue = summary?.revenue ?? 0;
  const paymentTotal = summary?.paymentBreakdown.reduce((total, item) => total + item.value, 0) ?? 0;
  const rangeLabel = formatRangeLabel(range);
  const compact = width < 480;
  const narrow = width < 350;
  const pieceCount = summary?.pieceCount ?? summary?.itemCount ?? 0;
  const costPerItem = summary?.costPerItem ?? DEFAULT_HPP_PER_ITEM;
  const totalHpp = summary?.costOfGoodsSold ?? 0;
  const netProfit = summary?.netProfit ?? 0;
  const netProfitHelper = summary?.netMarginPercent === null || summary?.netMarginPercent === undefined
    ? `Penjualan − HPP ${formatCurrency(costPerItem)} / pcs`
    : `Margin ${formatPercent(summary.netMarginPercent)} · Penjualan − total HPP ${formatCurrency(totalHpp)}`;

  return (
    <Screen>
      <Header eyebrow="Ringkasan outlet" subtitle="Hanya transaksi berhasil yang masuk perhitungan" title="Laporan" />
      <View style={styles.filterToolbar}>
        <View style={styles.periodFilter}><DateRangePicker onChange={setRange} value={range} /></View>
        <Button icon={FileSpreadsheet} label="Export Excel" loading={exporting} onPress={exportExcel} style={styles.exportButton} variant="secondary" />
      </View>
      {error ? <View style={[styles.errorPanel, compact && styles.errorPanelCompact]}><Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text><Button compact icon={RefreshCw} label="Coba lagi" onPress={loadReport} style={compact ? styles.retryButtonCompact : undefined} variant="secondary" /></View> : null}

      <View style={styles.metrics}>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard helper={summary?.previousPeriodGrowthPercent === null || summary?.previousPeriodGrowthPercent === undefined ? 'Belum ada periode pembanding' : `${summary.previousPeriodGrowthPercent >= 0 ? '+' : ''}${summary.previousPeriodGrowthPercent}% vs periode lalu`} icon={<TrendingUp color={palette.cocoa} size={21} />} label="Penjualan bersih" value={formatCompact(revenue)} /></View>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard accent={palette.rose} helper={`Rata-rata ${formatCurrency(summary?.averageOrderValue ?? 0)}`} icon={<ReceiptText color={palette.rose} size={21} />} label="Transaksi berhasil" value={String(summary?.transactionCount ?? 0)} /></View>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard accent={palette.honey} helper={summary?.transactionCount ? `${(pieceCount / summary.transactionCount).toFixed(1)} pcs / struk` : 'Belum ada transaksi'} icon={<PackageCheck color={palette.honey} size={21} />} label="Pcs terjual" value={String(pieceCount)} /></View>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard accent={palette.success} helper={netProfitHelper} icon={<WalletCards color={palette.success} size={21} />} label="Laba bersih" value={formatCompact(netProfit)} /></View>
      </View>

      <SectionHeader title={`Penjualan · ${rangeLabel}`} />
      <GlassCard contentStyle={[styles.chartCard, compact && styles.chartCardCompact]}>
        <View style={[styles.chartHeading, compact && styles.chartHeadingCompact]}><View style={styles.chartCopy}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.chartTitle}>{formatCurrency(revenue)}</Text><Text style={styles.chartSubtitle}>{loading ? 'Memuat data…' : `${summary?.transactionCount ?? 0} transaksi berhasil pada periode ini`}</Text></View>{summary?.previousPeriodGrowthPercent !== null && summary?.previousPeriodGrowthPercent !== undefined ? <View style={styles.growth}><TrendingUp color={palette.success} size={16} /><Text style={styles.growthText}>{summary.previousPeriodGrowthPercent >= 0 ? '+' : ''}{summary.previousPeriodGrowthPercent}%</Text></View> : null}</View>
        {loading && !summary ? <View style={styles.chartLoading}><ActivityIndicator color={palette.cocoa} /><Text style={styles.loadingText}>Menyiapkan laporan…</Text></View> : <BarChart data={summary?.series ?? []} height={150} />}
      </GlassCard>

      <SectionHeader title="Metode pembayaran" />
      <GlassCard contentStyle={[styles.breakdownCard, compact && styles.breakdownCardCompact]}>
        {summary?.paymentBreakdown.length ? summary.paymentBreakdown.map((item, index) => (
          <ProgressRow key={item.method} color={[palette.cocoa, palette.honey, palette.rose, palette.info][index % 4]} label={paymentLabels[item.method]} suffix={formatCurrency(item.value)} total={paymentTotal} value={item.value} />
        )) : <Text style={styles.emptyText}>Belum ada pembayaran pada periode ini.</Text>}
      </GlassCard>

      <SectionHeader title="Produk terlaris" />
      <GlassCard contentStyle={styles.rankingCard}>
        {summary?.topProducts.length ? summary.topProducts.map((item, index) => <RankingRow key={item.productId} index={index + 1} name={item.name} revenue={item.revenue} sold={item.sold} />) : <Text style={styles.emptyText}>Belum ada produk terjual pada periode ini.</Text>}
      </GlassCard>
    </Screen>
  );
}

function RankingRow({ index, name, sold, revenue }: { index: number; name: string; sold: number; revenue: number }) {
  return (
    <View style={styles.rankingRow}>
      <View style={[styles.rank, index === 1 && styles.rankFirst]}><Text style={[styles.rankText, index === 1 && styles.rankTextFirst]}>{index}</Text></View>
      <View style={styles.rankCopy}>
        <Text numberOfLines={2} style={styles.rankName}>{name}</Text>
        <View style={styles.rankDetails}>
          <Text style={styles.rankMeta}>{sold} pcs terjual</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.rankRevenue}>{formatCurrency(revenue)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filterToolbar: { gap: spacing.sm },
  periodFilter: { flex: 1 },
  exportButton: { alignSelf: 'stretch' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: spacing.sm, marginTop: spacing.md },
  metric: { minWidth: 150, flexGrow: 1, flexBasis: 0 },
  metricPhone: { flexBasis: '46%' },
  metricNarrow: { minWidth: '100%', flexBasis: '100%' },
  chartCard: { padding: spacing.lg },
  chartCardCompact: { padding: spacing.md },
  chartHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chartHeadingCompact: { alignItems: 'flex-start' },
  chartCopy: { flex: 1, minWidth: 0 },
  chartTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 20 },
  chartSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  chartLoading: { height: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  growth: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  growthText: { color: palette.success, fontFamily: type.bold, fontSize: 12 },
  breakdownCard: { padding: spacing.lg, gap: spacing.lg },
  breakdownCardCompact: { padding: spacing.md, gap: spacing.md },
  rankingCard: { paddingHorizontal: spacing.md },
  rankingRow: { minHeight: 80, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.line },
  rank: { width: 36, height: 36, flexShrink: 0, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107,63,42,0.08)' },
  rankFirst: { backgroundColor: palette.honeySoft },
  rankText: { color: palette.muted, fontFamily: type.bold, fontSize: 12 },
  rankTextFirst: { color: '#805307' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankName: { color: palette.ink, fontFamily: type.semibold, fontSize: 13, lineHeight: 18 },
  rankDetails: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xxs },
  rankMeta: { flex: 1, minWidth: 0, color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15 },
  rankRevenue: { maxWidth: '52%', flexShrink: 1, color: palette.cocoa, fontFamily: type.bold, fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
  emptyText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, textAlign: 'center', paddingVertical: spacing.lg },
  errorPanel: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 18, padding: spacing.sm, backgroundColor: palette.dangerSoft },
  errorPanelCompact: { alignItems: 'stretch', flexDirection: 'column' },
  retryButtonCompact: { alignSelf: 'stretch' },
  error: { flex: 1, color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 17 },
});
