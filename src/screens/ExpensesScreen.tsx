import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Banknote, Landmark, Plus, ReceiptText, RotateCcw, WalletCards } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expenseService } from '../api/services';
import { Button, Field, FormModal, GlassCard, Header, ScalePressable, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { Expense, ExpenseFundingSource, ExpenseOverview } from '../types/domain';
import { createLocalId, formatCurrency, formatDateTime, formatNumericInput, parseNumericInput } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Expenses'>;

const fundingLabels: Record<ExpenseFundingSource, string> = {
  bank: 'Rekening kas',
  cash: 'Uang fisik',
};

export function ExpensesScreen({ navigation }: Props) {
  const shift = useOperationsStore((state) => state.shift);
  const [overview, setOverview] = useState<ExpenseOverview | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [fundingSource, setFundingSource] = useState<ExpenseFundingSource>('bank');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenseToCancel, setExpenseToCancel] = useState<Expense | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const numericAmount = parseNumericInput(amount);
  const availableBank = Math.max(0, overview?.bankBalance ?? 0);
  const availableCash = Math.max(0, overview?.cashBalance ?? 0);
  const selectedBalance = fundingSource === 'bank' ? availableBank : availableCash;
  const insufficient = numericAmount > selectedBalance;
  const activeExpenseCount = overview?.expenses.filter((expense) => expense.status === 'active').length ?? 0;
  const cancelledExpenseCount = (overview?.expenses.length ?? 0) - activeExpenseCount;
  const canSubmit = Boolean(
    shift?.status === 'open'
      && overview
      && name.trim().length >= 2
      && numericAmount > 0
      && !insufficient,
  );

  const loadExpenses = useCallback(async () => {
    if (!shift?.id) {
      setOverview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOverview(await expenseService.list(shift.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Pengeluaran tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [shift?.id]);

  useFocusEffect(useCallback(() => {
    void loadExpenses();
  }, [loadExpenses]));

  const handleCreate = async () => {
    if (!shift || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await expenseService.create({
        idempotencyKey: createLocalId('expense'),
        shiftId: shift.id,
        name: name.trim(),
        amount: numericAmount,
        fundingSource,
      });
      setOverview(saved);
      setName('');
      setAmount('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Pengeluaran tidak dapat disimpan.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCancellation = (expense: Expense) => {
    setExpenseToCancel(expense);
    setCancelReason('');
    setCancelError(null);
  };

  const closeCancellation = () => {
    if (cancelling) return;
    setExpenseToCancel(null);
    setCancelReason('');
    setCancelError(null);
  };

  const handleCancel = async () => {
    if (!expenseToCancel) return;
    if (cancelReason.trim().length < 5) {
      setCancelError('Alasan pembatalan minimal 5 karakter.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      setOverview(await expenseService.cancel(expenseToCancel.id, cancelReason.trim()));
      setExpenseToCancel(null);
      setCancelReason('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (cancelExpenseError) {
      setCancelError(cancelExpenseError instanceof Error ? cancelExpenseError.message : 'Pengeluaran tidak dapat dibatalkan.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl} contentStyle={styles.screen}>
      <Header onBack={navigation.goBack} subtitle="Pilih rekening kas atau uang fisik untuk setiap catatan" title="Pengeluaran" />

      <GlassCard dark contentStyle={styles.heroCard}>
        <View style={styles.heroHeading}><View style={styles.heroIcon}><ReceiptText color={palette.honeySoft} size={24} /></View><StatusPill label="Shift aktif" tone="success" /></View>
        <Text style={styles.heroLabel}>Total pengeluaran aktif</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>{formatCurrency(overview?.totalExpenses ?? 0)}</Text>
        <Text style={styles.heroHelper}>{activeExpenseCount} aktif{cancelledExpenseCount > 0 ? ` · ${cancelledExpenseCount} dibatalkan` : ''} pada shift hari ini</Text>
      </GlassCard>

      <View style={styles.balanceGrid}>
        <BalanceCard icon={Landmark} label="Rekening kas" loading={loading} value={overview?.bankBalance ?? 0} />
        <BalanceCard icon={Banknote} label="Uang fisik" loading={loading} value={overview?.cashBalance ?? 0} />
        <BalanceCard icon={WalletCards} label="Total tersedia" loading={loading} value={overview?.totalBalance ?? 0} />
      </View>

      <SectionHeader title="Catat pengeluaran" />
      <GlassCard contentStyle={styles.formCard}>
        <Field autoCapitalize="words" label="Nama pengeluaran" onChangeText={(value) => { setName(value); setError(null); }} placeholder="Contoh: Belanja bahan" value={name} />
        <Field keyboardType="number-pad" label="Nominal" leftIcon={ReceiptText} onChangeText={(value) => { setAmount(formatNumericInput(value)); setError(null); }} placeholder="0" value={amount} />

        <View style={styles.sourceGroup}>
          <Text style={styles.sourceLabel}>Sumber dana</Text>
          <View style={styles.sourceGrid}>
            <FundingOption
              balance={availableBank}
              icon="bank"
              label={fundingLabels.bank}
              onPress={() => { setFundingSource('bank'); setError(null); }}
              selected={fundingSource === 'bank'}
            />
            <FundingOption
              balance={availableCash}
              icon="cash"
              label={fundingLabels.cash}
              onPress={() => { setFundingSource('cash'); setError(null); }}
              selected={fundingSource === 'cash'}
            />
          </View>
        </View>

        {numericAmount > 0 && overview ? (
          <View style={[styles.allocationCard, insufficient && styles.allocationDanger]}>
            <View style={styles.allocationHeading}>
              {insufficient ? <AlertTriangle color={palette.danger} size={18} /> : <WalletCards color={palette.cocoa} size={18} />}
              <Text style={[styles.allocationTitle, insufficient && styles.dangerText]}>{insufficient ? `Saldo ${fundingLabels[fundingSource].toLowerCase()} tidak cukup` : 'Rincian sumber dana'}</Text>
            </View>
            {insufficient ? (
              <Text style={styles.allocationText}>Nominal melebihi saldo tersedia {formatCurrency(selectedBalance)}. Pilih sumber lain atau ubah nominal.</Text>
            ) : (
              <AllocationRow label={`Dari ${fundingLabels[fundingSource].toLowerCase()}`} value={numericAmount} />
            )}
          </View>
        ) : null}
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <Button disabled={!canSubmit} icon={Plus} label="Simpan pengeluaran" loading={submitting} onPress={handleCreate} />
      </GlassCard>

      <SectionHeader actionLabel={loading ? 'Memuat...' : 'Segarkan'} onAction={loading ? undefined : loadExpenses} title="Riwayat pengeluaran" />
      {overview?.expenses.length ? (
        <GlassCard contentStyle={styles.listCard}>
          {overview.expenses.map((expense, index) => {
            const isCancelled = expense.status === 'cancelled';
            return (
              <View key={expense.id} style={[styles.expenseRow, index > 0 && styles.expenseDivider, isCancelled && styles.cancelledRow]}>
                <View style={[styles.expenseIcon, isCancelled && styles.cancelledIcon]}><ReceiptText color={isCancelled ? palette.muted : palette.cocoa} size={19} /></View>
                <View style={styles.expenseCopy}>
                  <Text style={[styles.expenseName, isCancelled && styles.cancelledText]}>{expense.name}</Text>
                  <Text style={styles.expenseMeta}>{formatDateTime(expense.createdAt)} · {expense.createdByName}</Text>
                  <View style={styles.fundingRow}>
                    {expense.bankAmount > 0 ? <Text style={styles.fundingBank}>Rekening kas {formatCurrency(expense.bankAmount)}</Text> : null}
                    {expense.cashAmount > 0 ? <Text style={styles.fundingCash}>Fisik {formatCurrency(expense.cashAmount)}</Text> : null}
                    {isCancelled ? <StatusPill label="Dibatalkan" tone="danger" /> : null}
                  </View>
                  {isCancelled ? <Text style={styles.cancelReason}>Alasan: {expense.cancelReason}</Text> : null}
                </View>
                <View style={styles.expenseAside}>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.expenseAmount, isCancelled && styles.cancelledAmount]}>{formatCurrency(expense.amount)}</Text>
                  {!isCancelled ? <Button compact icon={RotateCcw} label="Batalkan" onPress={() => openCancellation(expense)} style={styles.cancelButton} variant="danger" /> : null}
                </View>
              </View>
            );
          })}
        </GlassCard>
      ) : (
        <View style={styles.emptyState}>
          <ReceiptText color={palette.rose} size={30} />
          <Text style={styles.emptyTitle}>{loading ? 'Memuat pengeluaran...' : 'Belum ada pengeluaran'}</Text>
          <Text style={styles.emptyText}>Pengeluaran yang disimpan pada shift ini akan tampil di sini.</Text>
          {error && !overview ? <Button compact label="Coba lagi" onPress={loadExpenses} variant="secondary" /> : null}
        </View>
      )}

      <FormModal
        footer={<View style={styles.modalActions}><Button compact label="Kembali" onPress={closeCancellation} variant="secondary" /><Button compact label="Batalkan & kembalikan saldo" loading={cancelling} onPress={handleCancel} variant="danger" /></View>}
        onClose={closeCancellation}
        subtitle={expenseToCancel ? `${formatCurrency(expenseToCancel.amount)} akan dikembalikan ke ${expenseToCancel.fundingSource === 'cash' ? 'uang fisik' : expenseToCancel.fundingSource === 'bank' ? 'rekening kas' : 'sumber dana asal'}. Catatan tetap disimpan untuk audit.` : undefined}
        title={`Batalkan ${expenseToCancel?.name ?? 'pengeluaran'}`}
        visible={Boolean(expenseToCancel)}
      >
        <Field label="Alasan pembatalan" multiline numberOfLines={3} onChangeText={(value) => { setCancelReason(value); setCancelError(null); }} placeholder="Contoh: Salah memasukkan nominal" style={styles.reasonInput} value={cancelReason} />
        {cancelError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{cancelError}</Text> : null}
      </FormModal>
    </Screen>
  );
}

function BalanceCard({ icon: Icon, label, value, loading }: { icon: typeof Banknote; label: string; value: number; loading: boolean }) {
  return (
    <GlassCard style={styles.balanceCard} contentStyle={styles.balanceInner}>
      <Icon color={palette.honey} size={20} />
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balanceValue}>{loading ? '...' : formatCurrency(value)}</Text>
    </GlassCard>
  );
}

function FundingOption({ balance, icon, label, onPress, selected }: { balance: number; icon: ExpenseFundingSource; label: string; onPress: () => void; selected: boolean }) {
  const Icon = icon === 'bank' ? Landmark : Banknote;
  return (
    <ScalePressable
      accessibilityHint={`Saldo tersedia ${formatCurrency(balance)}`}
      accessibilityLabel={`Gunakan ${label}`}
      accessibilityState={{ selected }}
      containerStyle={styles.sourceOptionPressable}
      onPress={onPress}
      style={[styles.sourceOption, selected && styles.sourceOptionSelected]}
    >
      <Icon color={selected ? palette.cocoa : palette.muted} size={20} />
      <View style={styles.sourceCopy}>
        <Text style={[styles.sourceName, selected && styles.sourceNameSelected]}>{label}</Text>
        <Text numberOfLines={1} style={styles.sourceBalance}>{formatCurrency(balance)}</Text>
      </View>
      <View style={[styles.sourceRadio, selected && styles.sourceRadioSelected]}>{selected ? <View style={styles.sourceRadioDot} /> : null}</View>
    </ScalePressable>
  );
}

function AllocationRow({ label, value }: { label: string; value: number }) {
  return <View style={styles.allocationRow}><Text style={styles.allocationLabel}>{label}</Text><Text style={styles.allocationValue}>{formatCurrency(value)}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 820, alignSelf: 'center' },
  heroCard: { padding: spacing.lg, minHeight: 190 },
  heroHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  heroLabel: { color: 'rgba(255,255,255,0.65)', fontFamily: type.medium, fontSize: 12, marginTop: spacing.md },
  heroValue: { color: palette.white, fontFamily: type.display, fontSize: 34, marginTop: 2 },
  heroHelper: { color: 'rgba(255,255,255,0.58)', fontFamily: type.regular, fontSize: 11, marginTop: spacing.xs },
  balanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  balanceCard: { flexGrow: 1, flexBasis: 210 },
  balanceInner: { padding: spacing.md, minHeight: 112 },
  balanceLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11, marginTop: spacing.sm },
  balanceValue: { color: palette.ink, fontFamily: type.bold, fontSize: 18, marginTop: 2 },
  formCard: { padding: spacing.md, gap: spacing.md },
  sourceGroup: { gap: spacing.xs },
  sourceLabel: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 11 },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sourceOptionPressable: { flexGrow: 1, flexBasis: 220 },
  sourceOption: { minHeight: 78, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.porcelain, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceOptionSelected: { borderColor: palette.honey, backgroundColor: palette.honeySoft },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceName: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 12 },
  sourceNameSelected: { color: palette.cocoa },
  sourceBalance: { color: palette.muted, fontFamily: type.medium, fontSize: 10, marginTop: 3 },
  sourceRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: palette.muted, alignItems: 'center', justifyContent: 'center' },
  sourceRadioSelected: { borderColor: palette.cocoa },
  sourceRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.cocoa },
  allocationCard: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: palette.honeySoft, borderWidth: 1, borderColor: 'rgba(217,154,43,0.2)' },
  allocationDanger: { backgroundColor: palette.dangerSoft, borderColor: 'rgba(185,62,72,0.2)' },
  allocationHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  allocationTitle: { color: palette.cocoa, fontFamily: type.bold, fontSize: 13 },
  dangerText: { color: palette.danger },
  allocationText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17 },
  allocationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allocationLabel: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 12 },
  allocationValue: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  error: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 17 },
  listCard: { paddingHorizontal: spacing.md },
  expenseRow: { minHeight: 118, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.md },
  expenseDivider: { borderTopWidth: 1, borderTopColor: palette.line },
  cancelledRow: { opacity: 0.72 },
  expenseIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  cancelledIcon: { backgroundColor: palette.line },
  expenseCopy: { flex: 1, minWidth: 0, paddingTop: 2 },
  expenseName: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  cancelledText: { color: palette.muted, textDecorationLine: 'line-through' },
  expenseMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  fundingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  fundingBank: { color: palette.info, fontFamily: type.semibold, fontSize: 9, backgroundColor: palette.infoSoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  fundingCash: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 9, backgroundColor: palette.honeySoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  cancelReason: { color: palette.danger, fontFamily: type.medium, fontSize: 9, lineHeight: 14, marginTop: spacing.xs },
  expenseAside: { alignItems: 'flex-end', gap: spacing.xs, maxWidth: 150 },
  expenseAmount: { color: palette.danger, fontFamily: type.bold, fontSize: 14, maxWidth: 150 },
  cancelledAmount: { color: palette.muted, textDecorationLine: 'line-through' },
  cancelButton: { minWidth: 112 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.xs },
  reasonInput: { minHeight: 84, textAlignVertical: 'top' },
  emptyState: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.52)', padding: spacing.lg },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  emptyText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
