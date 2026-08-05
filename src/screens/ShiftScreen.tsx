import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Banknote, Landmark, LockKeyhole, ReceiptText, Save, ShieldCheck, WalletCards, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { expenseService } from '../api/services';
import { Button, Divider, Field, GlassCard, Header, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import { formatClock, formatCurrency, formatDateTime, formatNumericInput, parseNumericInput } from '../utils/format';
import { TERMINAL_ID } from '../api/client';
import type { ExpenseOverview } from '../types/domain';

export function ShiftScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Shift'>) {
  const shift = useOperationsStore((state) => state.shift);
  const transactions = useOperationsStore((state) => state.transactions);
  const closeShift = useOperationsStore((state) => state.closeShift);
  const updateOpeningBalances = useOperationsStore((state) => state.updateOpeningBalances);
  const [actualCash, setActualCash] = useState('');
  const [expenseOverview, setExpenseOverview] = useState<ExpenseOverview | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [editingOpeningBalances, setEditingOpeningBalances] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [openingBankBalanceInput, setOpeningBankBalanceInput] = useState('');
  const [openingCashError, setOpeningCashError] = useState<string | null>(null);
  const [openingBankBalanceError, setOpeningBankBalanceError] = useState<string | null>(null);
  const [openingBalanceError, setOpeningBalanceError] = useState<string | null>(null);
  const [savingOpeningBalances, setSavingOpeningBalances] = useState(false);
  const shiftTransactions = useMemo(() => transactions.filter((item) => (
    item.paymentShiftId === shift?.id
    || (!item.paymentShiftId && item.shiftId === shift?.id)
  )), [shift?.id, transactions]);
  const localCashSales = useMemo(() => shiftTransactions.filter((item) => item.status === 'paid' && item.paymentMethod === 'cash').reduce((sum, item) => sum + item.total, 0), [shiftTransactions]);
  const localNonCashSales = useMemo(() => shiftTransactions.filter((item) => item.status === 'paid' && item.paymentMethod !== 'cash').reduce((sum, item) => sum + item.total, 0), [shiftTransactions]);
  const cashSales = expenseOverview?.cashSales ?? localCashSales;
  const nonCashSales = expenseOverview?.nonCashSales ?? localNonCashSales;
  const cashExpenses = expenseOverview?.cashExpenses ?? 0;
  const bankExpenses = expenseOverview?.bankExpenses ?? 0;
  const expectedCash = expenseOverview?.cashBalance ?? (shift?.openingCash ?? 0) + cashSales - cashExpenses;
  const expectedBankBalance = expenseOverview?.bankBalance
    ?? (shift?.openingBankBalance ?? 0) + nonCashSales - bankExpenses;
  const actual = parseNumericInput(actualCash);
  const difference = actual - expectedCash;
  const editedOpeningCash = parseNumericInput(openingCashInput);
  const editedOpeningBankBalance = parseNumericInput(openingBankBalanceInput);
  const openingBalancesChanged = shift ? (
    editedOpeningCash !== shift.openingCash || editedOpeningBankBalance !== shift.openingBankBalance
  ) : false;

  useFocusEffect(useCallback(() => {
    let active = true;
    setExpensesLoaded(false);
    setExpenseError(null);
    if (!shift?.id) {
      setExpenseOverview(null);
      setExpensesLoaded(true);
      return () => { active = false; };
    }
    expenseService.list(shift.id)
      .then((overview) => { if (active) setExpenseOverview(overview); })
      .catch((loadError) => { if (active) setExpenseError(loadError instanceof Error ? loadError.message : 'Pengeluaran tidak dapat dimuat.'); })
      .finally(() => { if (active) setExpensesLoaded(true); });
    return () => { active = false; };
  }, [shift?.id]));

  const beginOpeningBalanceEdit = () => {
    if (!shift || shift.status !== 'open') return;
    setOpeningCashInput(formatNumericInput(shift.openingCash));
    setOpeningBankBalanceInput(formatNumericInput(shift.openingBankBalance));
    setOpeningCashError(null);
    setOpeningBankBalanceError(null);
    setOpeningBalanceError(null);
    setEditingOpeningBalances(true);
  };

  const cancelOpeningBalanceEdit = () => {
    setEditingOpeningBalances(false);
    setOpeningCashError(null);
    setOpeningBankBalanceError(null);
    setOpeningBalanceError(null);
  };

  const handleOpeningBalanceSave = async () => {
    if (!shift || shift.status !== 'open') return;
    const nextCashError = openingCashInput.trim() ? null : 'Kas tunai awal wajib diisi. Masukkan 0 jika kosong.';
    const nextBankError = openingBankBalanceInput.trim() ? null : 'Kas non-tunai awal wajib diisi. Masukkan 0 jika kosong.';
    setOpeningCashError(nextCashError);
    setOpeningBankBalanceError(nextBankError);
    setOpeningBalanceError(null);
    if (nextCashError || nextBankError || !openingBalancesChanged) return;

    setSavingOpeningBalances(true);
    try {
      const updatedShift = await updateOpeningBalances(editedOpeningCash, editedOpeningBankBalance);
      setEditingOpeningBalances(false);
      setExpenseError(null);
      try {
        setExpenseOverview(await expenseService.list(updatedShift.id));
      } catch (loadError) {
        setExpenseError(loadError instanceof Error ? loadError.message : 'Saldo pengeluaran tidak dapat dimuat ulang.');
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (updateError) {
      setOpeningBalanceError(updateError instanceof Error ? updateError.message : 'Saldo awal shift tidak dapat diubah.');
    } finally {
      setSavingOpeningBalances(false);
    }
  };

  const handleClose = () => {
    if (!shift || shift.status !== 'open') return;
    if (!expensesLoaded || expenseError) {
      Alert.alert('Rekonsiliasi belum siap', expenseError ?? 'Tunggu data pengeluaran selesai dimuat.');
      return;
    }
    if (!actualCash) {
      Alert.alert('Kas aktual belum diisi', 'Hitung kas tunai di laci lalu masukkan nominalnya.');
      return;
    }
    Alert.alert('Tutup shift sekarang?', `Selisih kas tercatat ${formatCurrency(difference)}. Saldo tunai aktual dan saldo rekening akan otomatis diteruskan saat membuka shift berikutnya.`, [
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

      <SectionHeader
        actionLabel={shift.status === 'open' && !editingOpeningBalances ? 'Ubah saldo awal' : undefined}
        onAction={beginOpeningBalanceEdit}
        title="Rekonsiliasi saldo kas"
      />
      <GlassCard contentStyle={styles.reconcileCard}>
        {editingOpeningBalances ? (
          <View style={styles.balanceEditor}>
            <View>
              <Text style={styles.balanceEditorTitle}>Ubah saldo awal shift</Text>
              <Text style={styles.balanceEditorSubtitle}>Koreksi nominal yang dimasukkan saat membuka shift.</Text>
            </View>
            <Field
              error={openingCashError}
              keyboardType="number-pad"
              label="Kas tunai awal"
              leftIcon={Banknote}
              onChangeText={(value) => {
                setOpeningCashInput(formatNumericInput(value));
                setOpeningCashError(null);
                setOpeningBalanceError(null);
              }}
              placeholder="0"
              selectTextOnFocus
              value={openingCashInput}
            />
            <Text style={styles.balancePreview}>{formatCurrency(editedOpeningCash)}</Text>
            <Field
              error={openingBankBalanceError}
              keyboardType="number-pad"
              label="Kas non-tunai awal"
              leftIcon={Landmark}
              onChangeText={(value) => {
                setOpeningBankBalanceInput(formatNumericInput(value));
                setOpeningBankBalanceError(null);
                setOpeningBalanceError(null);
              }}
              placeholder="0"
              selectTextOnFocus
              value={openingBankBalanceInput}
            />
            <Text style={styles.balancePreview}>{formatCurrency(editedOpeningBankBalance)}</Text>
            <Text style={styles.balanceEditorHelper}>Perubahan akan langsung memperbarui saldo pengeluaran dan perhitungan penutupan shift.</Text>
            {openingBalanceError ? <Text accessibilityLiveRegion="assertive" style={styles.balanceEditorError}>{openingBalanceError}</Text> : null}
            <View style={styles.balanceEditorActions}>
              <View style={styles.balanceEditorButton}><Button compact icon={X} label="Batal" onPress={cancelOpeningBalanceEdit} variant="secondary" /></View>
              <View style={styles.balanceEditorButton}>
                <Button
                  compact
                  disabled={!openingBalancesChanged || !openingCashInput.trim() || !openingBankBalanceInput.trim()}
                  icon={Save}
                  label="Simpan perubahan"
                  loading={savingOpeningBalances}
                  onPress={handleOpeningBalanceSave}
                />
              </View>
            </View>
            <Divider />
          </View>
        ) : null}
        <ReconcileRow icon={<Banknote color={palette.honey} size={17} />} label="Kas tunai awal" value={formatCurrency(shift.openingCash)} />
        <ReconcileRow label="Penjualan tunai (+)" value={`+ ${formatCurrency(cashSales)}`} />
        <ReconcileRow label="Pengeluaran kas tunai (−)" value={`− ${formatCurrency(cashExpenses)}`} />
        <Divider />
        <ReconcileRow emphasis label="Saldo kas tunai" value={formatCurrency(expectedCash)} />
        <Field editable={shift.status === 'open'} keyboardType="number-pad" label="Kas tunai aktual di laci" leftIcon={Banknote} onChangeText={(value) => setActualCash(formatNumericInput(value))} placeholder="Hitung kas tunai" value={actualCash} />
        {actualCash ? <View style={[styles.difference, difference !== 0 && styles.differenceWarning]}><Text style={[styles.differenceLabel, difference !== 0 && styles.differenceTextWarning]}>Selisih kas</Text><Text style={[styles.differenceValue, difference !== 0 && styles.differenceTextWarning]}>{difference > 0 ? '+' : ''}{formatCurrency(difference)}</Text></View> : null}
        <Divider />
        <ReconcileRow icon={<Landmark color={palette.rose} size={17} />} label="Kas non-tunai awal" value={formatCurrency(shift.openingBankBalance ?? 0)} />
        <ReconcileRow label="Penjualan QRIS/transfer/kartu (+)" value={`+ ${formatCurrency(nonCashSales)}`} />
        <ReconcileRow label="Pengeluaran kas non-tunai (−)" value={`− ${formatCurrency(bankExpenses)}`} />
        <Divider />
        <ReconcileRow emphasis label="Saldo kas non-tunai" value={formatCurrency(expectedBankBalance)} />
      </GlassCard>

      {expenseOverview?.totalExpenses ? <Text style={styles.expenseSummary}>Total pengeluaran shift ini {formatCurrency(expenseOverview.totalExpenses)}.</Text> : null}
      {expenseError ? <Text accessibilityLiveRegion="assertive" style={styles.expenseError}>{expenseError}</Text> : null}

      <View style={styles.auditNote}><ShieldCheck color={palette.success} size={18} /><Text style={styles.auditText}>Setiap perubahan shift tersimpan bersama petugas, perangkat, dan waktu kejadian.</Text></View>
      {shift.status === 'open' ? <Button disabled={editingOpeningBalances || savingOpeningBalances} icon={LockKeyhole} label="Tutup shift" onPress={handleClose} variant="danger" /> : null}
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
  balanceEditor: { gap: spacing.sm },
  balanceEditorTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  balanceEditorSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16, marginTop: 3 },
  balancePreview: { color: palette.cocoa, fontFamily: type.bold, fontSize: 13, marginTop: -spacing.xs, textAlign: 'right' },
  balanceEditorHelper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15 },
  balanceEditorError: { color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 16 },
  balanceEditorActions: { flexDirection: 'row', gap: spacing.sm },
  balanceEditorButton: { flex: 1 },
  difference: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: palette.successSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  differenceWarning: { backgroundColor: palette.honeySoft },
  differenceLabel: { color: palette.success, fontFamily: type.semibold, fontSize: 12 },
  differenceValue: { color: palette.success, fontFamily: type.bold, fontSize: 16 },
  differenceTextWarning: { color: '#805307' },
  expenseSummary: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  expenseError: { color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.md },
  auditNote: { minHeight: 60, borderRadius: radius.md, backgroundColor: palette.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginVertical: spacing.lg },
  auditText: { flex: 1, color: palette.success, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
  notFound: { color: palette.danger, fontFamily: type.medium, textAlign: 'center', marginTop: spacing.xl },
});
