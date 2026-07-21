import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Banknote, Clock3, Landmark, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Button, Divider, Field, GlassCard, Header, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import { formatClock, formatCurrency, formatDateTime } from '../utils/format';
import { TERMINAL_ID } from '../api/client';

export function ShiftScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Shift'>) {
  const shift = useOperationsStore((state) => state.shift);
  const transactions = useOperationsStore((state) => state.transactions);
  const closeShift = useOperationsStore((state) => state.closeShift);
  const [actualCash, setActualCash] = useState('');
  const shiftTransactions = useMemo(() => transactions.filter((item) => item.shiftId === shift?.id), [shift?.id, transactions]);
  const cashSales = useMemo(() => shiftTransactions.filter((item) => item.status === 'paid' && item.paymentMethod === 'cash').reduce((sum, item) => sum + item.total, 0), [shiftTransactions]);
  const nonCashSales = useMemo(() => shiftTransactions.filter((item) => item.status === 'paid' && item.paymentMethod !== 'cash').reduce((sum, item) => sum + item.total, 0), [shiftTransactions]);
  const expectedCash = (shift?.openingCash ?? 0) + cashSales;
  const expectedBankBalance = (shift?.openingBankBalance ?? 0) + nonCashSales;
  const actual = Number(actualCash.replace(/\D/g, '') || 0);
  const difference = actual - expectedCash;

  const handleClose = () => {
    if (!shift || shift.status !== 'open') return;
    if (!actualCash) {
      Alert.alert('Kas aktual belum diisi', 'Hitung uang fisik di laci lalu masukkan nominalnya.');
      return;
    }
    Alert.alert('Tutup shift sekarang?', `Selisih kas tercatat ${formatCurrency(difference)}. Setelah ditutup, kasir harus membuka shift baru.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Tutup shift', style: 'destructive', onPress: async () => {
        try {
          await closeShift(actual);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.goBack();
        } catch (closeError) {
          Alert.alert('Shift gagal ditutup', closeError instanceof Error ? closeError.message : 'Coba kembali.');
        }
      } },
    ]);
  };

  if (!shift) return <Screen><Header onBack={navigation.goBack} title="Shift" /><Text style={styles.notFound}>Belum ada shift pada perangkat ini.</Text></Screen>;

  return (
    <Screen bottomInset={spacing.xl}>
      <Header onBack={navigation.goBack} right={<StatusPill label={shift.status === 'open' ? 'Aktif' : 'Ditutup'} tone={shift.status === 'open' ? 'success' : 'danger'} />} subtitle={`Dibuka ${formatDateTime(shift.openedAt)}`} title="Shift & kas harian" />

      <GlassCard dark contentStyle={styles.heroCard}>
        <View style={styles.heroTop}><View style={styles.heroIcon}><WalletCards color={palette.honeySoft} size={24} /></View><View><Text style={styles.heroTitle}>Shift {shift.id.slice(-6).toUpperCase()}</Text><Text style={styles.heroSubtitle}>Terminal {shift.terminalId || TERMINAL_ID} · sejak {formatClock(shift.openedAt)}</Text></View></View>
        <Text style={styles.heroLabel}>Total penjualan shift</Text>
        <Text style={styles.heroTotal}>{formatCurrency(cashSales + nonCashSales)}</Text>
      </GlassCard>

      <SectionHeader title="Ringkasan penjualan" />
      <View style={styles.metrics}>
        <GlassCard style={styles.metric} contentStyle={styles.metricInner}><Banknote color={palette.honey} size={22} /><Text style={styles.metricLabel}>Tunai</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{formatCurrency(cashSales)}</Text></GlassCard>
        <GlassCard style={styles.metric} contentStyle={styles.metricInner}><ReceiptText color={palette.rose} size={22} /><Text style={styles.metricLabel}>Non-tunai</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{formatCurrency(nonCashSales)}</Text></GlassCard>
      </View>

      <SectionHeader title="Rekonsiliasi kas" />
      <GlassCard contentStyle={styles.reconcileCard}>
        <ReconcileRow icon={<Banknote color={palette.honey} size={17} />} label="Uang fisik awal" value={formatCurrency(shift.openingCash)} />
        <ReconcileRow label="Penjualan tunai" value={formatCurrency(cashSales)} />
        <Divider />
        <ReconcileRow emphasis label="Uang fisik seharusnya" value={formatCurrency(expectedCash)} />
        <Field editable={shift.status === 'open'} keyboardType="number-pad" label="Kas aktual di laci" leftIcon={Banknote} onChangeText={(value) => setActualCash(value.replace(/\D/g, ''))} placeholder="Hitung uang fisik" value={actualCash} />
        {actualCash ? <View style={[styles.difference, difference !== 0 && styles.differenceWarning]}><Text style={[styles.differenceLabel, difference !== 0 && styles.differenceTextWarning]}>Selisih kas</Text><Text style={[styles.differenceValue, difference !== 0 && styles.differenceTextWarning]}>{difference > 0 ? '+' : ''}{formatCurrency(difference)}</Text></View> : null}
        <Divider />
        <ReconcileRow icon={<Landmark color={palette.rose} size={17} />} label="Uang rekening awal" value={formatCurrency(shift.openingBankBalance ?? 0)} />
        <ReconcileRow label="Penjualan non-tunai" value={formatCurrency(nonCashSales)} />
        <Divider />
        <ReconcileRow emphasis label="Rekening estimasi" value={formatCurrency(expectedBankBalance)} />
      </GlassCard>

      <View style={styles.auditNote}><ShieldCheck color={palette.success} size={18} /><Text style={styles.auditText}>Setiap perubahan shift tersimpan bersama petugas, perangkat, dan waktu kejadian.</Text></View>
      {shift.status === 'open' ? <Button icon={LockKeyhole} label="Tutup shift" onPress={handleClose} variant="danger" /> : null}
    </Screen>
  );
}

function ReconcileRow({ label, value, emphasis, icon }: { label: string; value: string; emphasis?: boolean; icon?: React.ReactNode }) {
  return <View style={styles.reconcileRow}><View style={styles.reconcileLabelRow}>{icon}<Text style={[styles.reconcileLabel, emphasis && styles.reconcileEmphasis]}>{label}</Text></View><Text style={[styles.reconcileValue, emphasis && styles.reconcileValueEmphasis]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  heroCard: { padding: spacing.lg, minHeight: 196 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,231,173,0.12)' },
  heroTitle: { color: palette.white, fontFamily: type.bold, fontSize: 14 },
  heroSubtitle: { color: 'rgba(255,255,255,0.62)', fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  heroLabel: { color: 'rgba(255,255,255,0.62)', fontFamily: type.medium, fontSize: 11, marginTop: spacing.lg },
  heroTotal: { color: palette.white, fontFamily: type.display, fontSize: 30, marginTop: 3 },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1 },
  metricInner: { minHeight: 130, padding: spacing.md },
  metricLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10, marginTop: spacing.md },
  metricValue: { color: palette.ink, fontFamily: type.bold, fontSize: 15, marginTop: 3 },
  reconcileCard: { padding: spacing.lg, gap: spacing.md },
  reconcileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reconcileLabelRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reconcileLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 12 },
  reconcileValue: { color: palette.ink, fontFamily: type.semibold, fontSize: 12 },
  reconcileEmphasis: { color: palette.ink, fontFamily: type.bold },
  reconcileValueEmphasis: { color: palette.cocoa, fontFamily: type.bold, fontSize: 17 },
  difference: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: palette.successSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  differenceWarning: { backgroundColor: palette.honeySoft },
  differenceLabel: { color: palette.success, fontFamily: type.semibold, fontSize: 12 },
  differenceValue: { color: palette.success, fontFamily: type.bold, fontSize: 16 },
  differenceTextWarning: { color: '#805307' },
  auditNote: { minHeight: 60, borderRadius: radius.md, backgroundColor: palette.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginVertical: spacing.lg },
  auditText: { flex: 1, color: palette.success, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
  notFound: { color: palette.danger, fontFamily: type.medium, textAlign: 'center', marginTop: spacing.xl },
});
