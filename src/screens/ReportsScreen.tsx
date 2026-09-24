import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Banknote, ChevronRight, FileSpreadsheet, Landmark, PackageCheck, ReceiptText, RefreshCw, TrendingUp, WalletCards } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { reportService, type SalesSummary } from '../api/services';
import { BarChart, MetricCard, ProgressRow } from '../components/data';
import { DateRangePicker } from '../components/date-range-picker';
import { Button, GlassCard, Header, ScalePressable, Screen, SectionHeader } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { palette, radius, spacing, type } from '../theme/tokens';
import { type DateRangeSelection, formatRangeLabel, makeDateRange, toDateParam } from '../utils/date';
import { formatCompact, formatCurrency, formatPercent, paymentLabels } from '../utils/format';

const HPP_BOX_REFERENCES = [
  { label: 'Jadul', topping: 3_200, productionPerPiece: 1_150, productionPerBox: 13_794 },
  { label: 'Klasik', topping: 7_200, productionPerPiece: 1_483, productionPerBox: 17_794 },
  { label: 'Antop', topping: 10_800, productionPerPiece: 1_783, productionPerBox: 21_394 },
] as const;

export function ReportsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<DateRangeSelection>(() => makeDateRange('day'));
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRequestId = useRef(0);
  const from = toDateParam(range.from);
  const to = toDateParam(range.to);

  const loadReport = useCallback(async () => {
    const requestId = ++reportRequestId.current;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const result = await reportService.summary(from, to);
      if (requestId === reportRequestId.current) setSummary(result);
    } catch (reportError) {
      if (requestId === reportRequestId.current) {
        setError(reportError instanceof Error ? reportError.message : 'Laporan tidak dapat dimuat.');
      }
    } finally {
      if (requestId === reportRequestId.current) setLoading(false);
    }
  }, [from, to]);

  useFocusEffect(useCallback(() => {
    void loadReport();
    return () => { reportRequestId.current += 1; };
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
          dialogTitle: 'Simpan atau bagikan laporan operasional',
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
  const costPerItem = summary?.costPerItem ?? 0;
  const productionCost = summary?.productionCost ?? 0;
  const contribution = summary?.contributionMargin ?? 0;
  const periodFixedCost = summary?.periodFixedCost ?? 0;
  const monthlyFixedCost = summary?.monthlyFixedCost ?? 4_480_000;
  const fixedCostPerBox = summary?.fixedCostPerBox ?? null;
  const boxCount = summary?.boxCount ?? pieceCount / 12;
  const netBusinessProfit = summary?.netBusinessProfit ?? summary?.netProfit ?? 0;
  const contributionHelper = !pieceCount
    ? 'Belum ada penjualan untuk menghitung kontribusi'
    : summary?.contributionMarginPercent === null || summary?.contributionMarginPercent === undefined
      ? `HPP produksi rata-rata ${formatCurrency(costPerItem)} / pcs`
      : `Margin ${formatPercent(summary.contributionMarginPercent)} · setelah HPP produksi`;

  return (
    <Screen>
      <Header eyebrow="Ringkasan outlet" subtitle="Hanya transaksi berhasil yang masuk perhitungan" title="Laporan" />
      <View style={styles.filterToolbar}>
        <View style={styles.periodFilter}><DateRangePicker onChange={setRange} value={range} /></View>
        <Button icon={FileSpreadsheet} label="Export Excel Lengkap" loading={exporting} onPress={exportExcel} style={styles.exportButton} variant="secondary" />
      </View>
      {error ? <View style={[styles.errorPanel, compact && styles.errorPanelCompact]}><Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text><Button compact icon={RefreshCw} label="Coba lagi" onPress={loadReport} style={compact ? styles.retryButtonCompact : undefined} variant="secondary" /></View> : null}

      <View style={styles.metrics}>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard helper={summary?.previousPeriodGrowthPercent === null || summary?.previousPeriodGrowthPercent === undefined ? 'Belum ada periode pembanding' : `${summary.previousPeriodGrowthPercent >= 0 ? '+' : ''}${summary.previousPeriodGrowthPercent}% vs periode lalu`} icon={<TrendingUp color={palette.cocoa} size={21} />} label="Penjualan bersih" value={formatCompact(revenue)} /></View>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard accent={palette.rose} helper={`Rata-rata ${formatCurrency(summary?.averageOrderValue ?? 0)}`} icon={<ReceiptText color={palette.rose} size={21} />} label="Transaksi berhasil" value={String(summary?.transactionCount ?? 0)} /></View>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard accent={palette.honey} helper={summary?.transactionCount ? `${(pieceCount / summary.transactionCount).toFixed(1)} pcs / struk` : 'Belum ada transaksi'} icon={<PackageCheck color={palette.honey} size={21} />} label="Pcs terjual" value={String(pieceCount)} /></View>
        <View style={[styles.metric, compact && styles.metricPhone, narrow && styles.metricNarrow]}><MetricCard accent={palette.success} helper={contributionHelper} icon={<WalletCards color={palette.success} size={21} />} label="Margin kontribusi" value={formatCompact(contribution)} /></View>
      </View>

      <SectionHeader title={`Analisis usaha · ${rangeLabel}`} />
      <GlassCard contentStyle={[styles.hppCard, compact && styles.hppCardCompact]}>
        <View style={styles.hppPeriodTotals}>
          <HppTotal label="HPP produksi" value={productionCost} />
          <HppTotal label="Margin kontribusi" value={contribution} />
          <HppTotal label="Biaya tetap periode" value={periodFixedCost} />
          <HppTotal emphasized label="Laba bersih usaha" negative={netBusinessProfit < 0} value={netBusinessProfit} />
        </View>
        <View style={styles.hppAssumption}>
          <Text style={styles.hppAssumptionTitle}>Biaya tetap dihitung pada akhir periode</Text>
          <Text style={styles.hppAssumptionText}>Margin kontribusi = penjualan − HPP produksi. Biaya tetap bulanan {formatCurrency(monthlyFixedCost)} diprorata sesuai hari pada periode laporan, lalu dikurangkan sekali untuk memperoleh laba bersih usaha.</Text>
        </View>
        <View style={styles.volumeAnalysis}>
          <View style={styles.volumeMetric}><Text style={styles.volumeLabel}>Ekuivalen box terjual</Text><Text style={styles.volumeValue}>{boxCount.toLocaleString('id-ID', { maximumFractionDigits: 2 })} box</Text></View>
          <View style={styles.volumeMetric}><Text style={styles.volumeLabel}>Indikator biaya tetap / box</Text><Text style={styles.volumeValue}>{fixedCostPerBox === null ? '—' : formatCurrency(fixedCostPerBox)}</Text></View>
        </View>
        <View style={styles.targetNote}>
          <Text style={styles.targetTitle}>Target volume operasional</Text>
          <Text style={styles.targetText}>Target 208 box menghasilkan indikator {formatCurrency(21_538)} / box. Target 300–312 box lebih masuk akal, dengan indikator sekitar {formatCurrency(14_933)}–{formatCurrency(14_359)} / box.</Text>
          <Text style={styles.targetText}>Jadul reseller {formatCurrency(28_000)} memberi margin kontribusi {formatCurrency(14_206)} / box dan tetap sehat secara langsung, tetapi marginnya paling tipis sehingga harganya perlu dievaluasi.</Text>
        </View>
        <Text style={styles.hppAssumptionTitle}>Acuan HPP produksi per box isi 12</Text>
        <View style={styles.hppReferenceList}>
          {HPP_BOX_REFERENCES.map((item) => <HppReferenceRow key={item.label} {...item} />)}
        </View>
      </GlassCard>

      <SectionHeader title={`Pengeluaran · ${rangeLabel}`} />
      <ScalePressable
        accessibilityHint="Membuka daftar pengeluaran untuk periode laporan ini"
        accessibilityLabel={`Lihat detail pengeluaran ${rangeLabel}`}
        onPress={() => navigation.navigate('ExpenseDetails', { from, to, rangeLabel })}
        style={styles.expenseCardPressable}
      >
      <GlassCard contentStyle={[styles.expenseCard, compact && styles.expenseCardCompact]}>
        {loading ? (
          <View accessibilityLiveRegion="polite" style={styles.expenseLoading}>
            <ActivityIndicator color={palette.cocoa} />
            <Text style={styles.expenseHelper}>Memuat pengeluaran…</Text>
          </View>
        ) : summary?.totalExpenses !== undefined ? (
          <>
            <View>
              <Text style={styles.expenseLabel}>Total pengeluaran</Text>
              <Text style={styles.expenseTotal}>{formatCurrency(summary.totalExpenses)}</Text>
              <Text style={styles.expenseHelper}>{summary.expenseCount ? `${summary.expenseCount} pengeluaran · Tidak termasuk yang dibatalkan` : 'Belum ada pengeluaran pada periode ini.'}</Text>
            </View>
            <View style={styles.expenseBreakdown}>
              <View style={styles.expenseSource}>
                <View style={styles.expenseSourceLabel}><Banknote color={palette.cocoa} size={18} /><Text style={styles.expenseLabel}>Kas tunai</Text></View>
                <Text style={styles.expenseAmount}>{formatCurrency(summary.cashExpenses)}</Text>
              </View>
              <View style={styles.expenseSource}>
                <View style={styles.expenseSourceLabel}><Landmark color={palette.cocoa} size={18} /><Text style={styles.expenseLabel}>Kas non-tunai</Text></View>
                <Text style={styles.expenseAmount}>{formatCurrency(summary.bankExpenses)}</Text>
              </View>
            </View>
          </>
        ) : <Text style={styles.expenseHelper}>Data pengeluaran belum tersedia. Muat ulang laporan untuk mencoba lagi.</Text>}
        <View style={styles.expenseDetailAction}>
          <Text style={styles.expenseDetailText}>Lihat rincian dan kelola pengeluaran</Text>
          <ChevronRight color={palette.cocoa} size={20} />
        </View>
      </GlassCard>
      </ScalePressable>

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

function HppTotal({ label, value, emphasized = false, negative = false }: { label: string; value: number; emphasized?: boolean; negative?: boolean }) {
  return (
    <View style={[styles.hppTotal, emphasized && styles.hppTotalEmphasized, negative && styles.hppTotalNegative]}>
      <Text style={styles.hppTotalLabel}>{label}</Text>
      <Text style={[styles.hppTotalValue, emphasized && styles.hppTotalValueEmphasized, negative && styles.hppTotalValueNegative]}>{formatCurrency(value)}</Text>
    </View>
  );
}

function HppReferenceRow({ label, topping, productionPerPiece, productionPerBox }: typeof HPP_BOX_REFERENCES[number]) {
  return (
    <View style={styles.hppReferenceRow}>
      <View style={styles.hppReferenceCopy}>
        <Text style={styles.hppReferenceName}>{label}</Text>
        <Text style={styles.hppReferenceMeta}>Produksi {formatCurrency(productionPerPiece)} / pcs · topping {formatCurrency(topping)} / box · produksi {formatCurrency(productionPerBox)} / box</Text>
      </View>
      <View style={styles.hppReferenceAmountWrap}>
        <Text style={styles.hppReferenceAmount}>{formatCurrency(productionPerBox)}</Text>
        <Text style={styles.hppReferenceSuffix}>HPP produksi / box</Text>
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
  hppCard: { padding: spacing.lg, gap: spacing.md },
  hppCardCompact: { padding: spacing.md },
  hppPeriodTotals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hppTotal: { flexGrow: 1, flexBasis: 140, minWidth: 0, borderRadius: radius.md, padding: spacing.md, backgroundColor: 'rgba(107,63,42,0.06)' },
  hppTotalEmphasized: { backgroundColor: palette.honeySoft },
  hppTotalNegative: { backgroundColor: palette.dangerSoft },
  hppTotalLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  hppTotalValue: { color: palette.ink, fontFamily: type.bold, fontSize: 17, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] },
  hppTotalValueEmphasized: { color: palette.cocoa },
  hppTotalValueNegative: { color: palette.danger },
  hppAssumption: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.md },
  hppAssumptionTitle: { color: palette.ink, fontFamily: type.semibold, fontSize: 12 },
  hppAssumptionText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17, marginTop: spacing.xxs },
  volumeAnalysis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  volumeMetric: { flexGrow: 1, flexBasis: 180, minWidth: 0, borderRadius: radius.sm, padding: spacing.md, backgroundColor: palette.infoSoft },
  volumeLabel: { color: palette.info, fontFamily: type.medium, fontSize: 10 },
  volumeValue: { color: palette.ink, fontFamily: type.bold, fontSize: 16, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] },
  targetNote: { borderRadius: radius.md, padding: spacing.md, backgroundColor: palette.honeySoft, gap: spacing.xs },
  targetTitle: { color: palette.cocoa, fontFamily: type.bold, fontSize: 12 },
  targetText: { color: palette.inkSoft, fontFamily: type.regular, fontSize: 11, lineHeight: 17 },
  hppReferenceList: { borderTopWidth: 1, borderTopColor: palette.line },
  hppReferenceRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.line },
  hppReferenceCopy: { flex: 1, minWidth: 0 },
  hppReferenceName: { color: palette.ink, fontFamily: type.bold, fontSize: 12 },
  hppReferenceMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 3 },
  hppReferenceAmountWrap: { flexShrink: 0, alignItems: 'flex-end' },
  hppReferenceAmount: { color: palette.cocoa, fontFamily: type.bold, fontSize: 13, fontVariant: ['tabular-nums'] },
  hppReferenceSuffix: { color: palette.muted, fontFamily: type.regular, fontSize: 9, marginTop: 2 },
  expenseCard: { padding: spacing.lg, gap: spacing.md },
  expenseCardPressable: { borderRadius: 24 },
  expenseCardCompact: { padding: spacing.md },
  expenseLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 120 },
  expenseLabel: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 12, flexShrink: 1 },
  expenseTotal: { color: palette.cocoa, fontFamily: type.bold, fontSize: 26, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] },
  expenseHelper: { color: palette.muted, fontFamily: type.regular, fontSize: 12, lineHeight: 18, marginTop: spacing.xxs },
  expenseBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.md },
  expenseSource: { flexGrow: 1, flexBasis: 140, minWidth: 0, gap: spacing.xs },
  expenseSourceLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  expenseAmount: { color: palette.ink, fontFamily: type.semibold, fontSize: 16, fontVariant: ['tabular-nums'] },
  expenseDetailAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.sm },
  expenseDetailText: { flex: 1, color: palette.cocoa, fontFamily: type.bold, fontSize: 12 },
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
