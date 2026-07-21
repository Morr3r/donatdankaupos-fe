import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Banknote, Landmark, Plus, ReceiptText, WalletCards } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expenseService } from '../api/services';
import { Button, Field, GlassCard, Header, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { ExpenseOverview } from '../types/domain';
import { createLocalId, formatCurrency, formatDateTime, formatNumericInput, parseNumericInput } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Expenses'>;

export function ExpensesScreen({ navigation }: Props) {
  const shift = useOperationsStore((state) => state.shift);
  const [overview, setOverview] = useState<ExpenseOverview | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numericAmount = parseNumericInput(amount);
  const availableBank = Math.max(0, overview?.bankBalance ?? 0);
  const availableCash = Math.max(0, overview?.cashBalance ?? 0);
  const bankAllocation = Math.min(numericAmount, availableBank);
  const cashAllocation = Math.max(0, numericAmount - bankAllocation);
  const insufficient = numericAmount > availableBank + availableCash;
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

  return (
    <Screen bottomInset={spacing.xl} contentStyle={styles.screen}>
      <Header onBack={navigation.goBack} subtitle="Biaya shift aktif diambil dari rekening lalu uang fisik" title="Pengeluaran" />

      <GlassCard dark contentStyle={styles.heroCard}>
        <View style={styles.heroHeading}><View style={styles.heroIcon}><ReceiptText color={palette.honeySoft} size={24} /></View><StatusPill label="Shift aktif" tone="success" /></View>
        <Text style={styles.heroLabel}>Total pengeluaran</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>{formatCurrency(overview?.totalExpenses ?? 0)}</Text>
        <Text style={styles.heroHelper}>{overview?.expenses.length ?? 0} catatan pada shift hari ini</Text>
      </GlassCard>

      <View style={styles.balanceGrid}>
        <BalanceCard icon={Landmark} label="Saldo rekening" loading={loading} value={overview?.bankBalance ?? 0} />
        <BalanceCard icon={Banknote} label="Uang fisik" loading={loading} value={overview?.cashBalance ?? 0} />
        <BalanceCard icon={WalletCards} label="Total tersedia" loading={loading} value={overview?.totalBalance ?? 0} />
      </View>

      <SectionHeader title="Catat pengeluaran" />
      <GlassCard contentStyle={styles.formCard}>
        <Field autoCapitalize="words" label="Nama pengeluaran" onChangeText={(value) => { setName(value); setError(null); }} placeholder="Contoh: Belanja bahan" value={name} />
        <Field keyboardType="number-pad" label="Nominal" leftIcon={ReceiptText} onChangeText={(value) => { setAmount(formatNumericInput(value)); setError(null); }} placeholder="0" value={amount} />
        {numericAmount > 0 && overview ? (
          <View style={[styles.allocationCard, insufficient && styles.allocationDanger]}>
            <View style={styles.allocationHeading}>
              {insufficient ? <AlertTriangle color={palette.danger} size={18} /> : <WalletCards color={palette.cocoa} size={18} />}
              <Text style={[styles.allocationTitle, insufficient && styles.dangerText]}>{insufficient ? 'Saldo tidak mencukupi' : 'Sumber dana otomatis'}</Text>
            </View>
            {insufficient ? (
              <Text style={styles.allocationText}>Nominal melebihi total saldo tersedia {formatCurrency(availableBank + availableCash)}.</Text>
            ) : (
              <>
                <AllocationRow label="Dari rekening" value={bankAllocation} />
                <AllocationRow label="Dari uang fisik" value={cashAllocation} />
                {cashAllocation > 0 ? <Text style={styles.fallbackText}>Saldo rekening tidak cukup, sehingga {formatCurrency(cashAllocation)} otomatis diambil dari uang fisik.</Text> : null}
              </>
            )}
          </View>
        ) : null}
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <Button disabled={!canSubmit} icon={Plus} label="Simpan pengeluaran" loading={submitting} onPress={handleCreate} />
      </GlassCard>

      <SectionHeader actionLabel={loading ? 'Memuat...' : 'Segarkan'} onAction={loading ? undefined : loadExpenses} title="Riwayat pengeluaran" />
      {overview?.expenses.length ? (
        <GlassCard contentStyle={styles.listCard}>
          {overview.expenses.map((expense, index) => (
            <View key={expense.id} style={[styles.expenseRow, index > 0 && styles.expenseDivider]}>
              <View style={styles.expenseIcon}><ReceiptText color={palette.cocoa} size={19} /></View>
              <View style={styles.expenseCopy}>
                <Text style={styles.expenseName}>{expense.name}</Text>
                <Text style={styles.expenseMeta}>{formatDateTime(expense.createdAt)} · {expense.createdByName}</Text>
                <View style={styles.fundingRow}>
                  {expense.bankAmount > 0 ? <Text style={styles.fundingBank}>Rekening {formatCurrency(expense.bankAmount)}</Text> : null}
                  {expense.cashAmount > 0 ? <Text style={styles.fundingCash}>Fisik {formatCurrency(expense.cashAmount)}</Text> : null}
                </View>
              </View>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
            </View>
          ))}
        </GlassCard>
      ) : (
        <View style={styles.emptyState}>
          <ReceiptText color={palette.rose} size={30} />
          <Text style={styles.emptyTitle}>{loading ? 'Memuat pengeluaran...' : 'Belum ada pengeluaran'}</Text>
          <Text style={styles.emptyText}>Pengeluaran yang disimpan pada shift ini akan tampil di sini.</Text>
          {error && !overview ? <Button compact label="Coba lagi" onPress={loadExpenses} variant="secondary" /> : null}
        </View>
      )}
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
  allocationCard: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: palette.honeySoft, borderWidth: 1, borderColor: 'rgba(217,154,43,0.2)' },
  allocationDanger: { backgroundColor: palette.dangerSoft, borderColor: 'rgba(185,62,72,0.2)' },
  allocationHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  allocationTitle: { color: palette.cocoa, fontFamily: type.bold, fontSize: 13 },
  dangerText: { color: palette.danger },
  allocationText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17 },
  allocationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allocationLabel: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 12 },
  allocationValue: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  fallbackText: { color: palette.cocoa, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
  error: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 17 },
  listCard: { paddingHorizontal: spacing.md },
  expenseRow: { minHeight: 102, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  expenseDivider: { borderTopWidth: 1, borderTopColor: palette.line },
  expenseIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  expenseCopy: { flex: 1, minWidth: 0 },
  expenseName: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  expenseMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  fundingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  fundingBank: { color: palette.info, fontFamily: type.semibold, fontSize: 9, backgroundColor: palette.infoSoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  fundingCash: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 9, backgroundColor: palette.honeySoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  expenseAmount: { color: palette.danger, fontFamily: type.bold, fontSize: 14, maxWidth: 150 },
  emptyState: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.52)', padding: spacing.lg },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  emptyText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
