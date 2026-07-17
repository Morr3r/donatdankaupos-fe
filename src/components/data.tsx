import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { palette, radius, spacing, type } from '../theme/tokens';
import { GlassCard } from './ui';

export function MetricCard({ label, value, helper, icon, accent = palette.cocoa }: { label: string; value: string; helper: string; icon: ReactNode; accent?: string }) {
  return (
    <GlassCard style={styles.metricCard} contentStyle={styles.metricInner}>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}18` }]}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </GlassCard>
  );
}

export function BarChart({ data, height = 126 }: { data: { label: string; value: number }[]; height?: number }) {
  const { width } = useWindowDimensions();
  const max = Math.max(...data.map((item) => item.value), 1);
  const contentWidth = Math.max(Math.min(width - 64, 1160), data.length * 46, 280);
  if (!data.length) {
    return <View style={[styles.chartEmpty, { height }]}><Text style={styles.chartEmptyText}>Belum ada data penjualan.</Text></View>;
  }
  return (
    <ScrollView accessibilityLabel={`Grafik penjualan. Nilai tertinggi ${max}`} horizontal showsHorizontalScrollIndicator={data.length > 8}>
      <View style={[styles.chart, { height: height + 34, width: contentWidth }]}> 
        {data.map((item, index) => {
          const barHeight = Math.max(8, Math.round((item.value / max) * height));
          const isLast = index === data.length - 1;
          return (
            <View key={`${item.label}-${index}`} style={styles.chartColumn}>
              <View style={[styles.barTrack, { height }]}> 
                <View style={[styles.bar, isLast && styles.barActive, { height: barHeight }]} />
              </View>
              <Text numberOfLines={1} style={[styles.chartLabel, isLast && styles.chartLabelActive]}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function ProgressRow({ label, value, total, color, suffix }: { label: string; value: number; total: number; color: string; suffix: string }) {
  const percent = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <View style={styles.progressLabelWrap}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text numberOfLines={2} style={styles.progressLabel}>{label}</Text></View>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.progressValue}>{suffix}</Text>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { backgroundColor: color, width: `${percent}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: { width: '100%', minWidth: 0 },
  metricInner: { padding: spacing.md, minHeight: 164 },
  metricIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  metricLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  metricValue: { color: palette.ink, fontFamily: type.bold, fontSize: 21, marginTop: 3 },
  metricHelper: { minHeight: 30, color: palette.success, fontFamily: type.semibold, fontSize: 10, lineHeight: 15, marginTop: 6 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, paddingTop: spacing.sm },
  chartEmpty: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: 'rgba(107,63,42,0.04)', marginTop: spacing.sm },
  chartEmptyText: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  chartColumn: { flex: 1, alignItems: 'center', gap: 7 },
  barTrack: { width: '100%', borderRadius: radius.sm, backgroundColor: 'rgba(105,68,48,0.07)', justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: palette.roseSoft, borderRadius: radius.sm },
  barActive: { backgroundColor: palette.cocoa },
  chartLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  chartLabelActive: { color: palette.cocoa, fontFamily: type.bold },
  progressRow: { gap: spacing.xs },
  progressHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  progressLabelWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 9, height: 9, flexShrink: 0, borderRadius: 5 },
  progressLabel: { flex: 1, minWidth: 0, color: palette.inkSoft, fontFamily: type.semibold, fontSize: 12, lineHeight: 17 },
  progressValue: { maxWidth: '48%', flexShrink: 1, color: palette.ink, fontFamily: type.bold, fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: 'rgba(104,69,51,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
});
