import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Banknote, Landmark, Pencil, Plus, ReceiptText, RefreshCw, Trash2, WalletCards } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { expenseService } from '../api/services';
import { Button, Field, FormModal, GlassCard, Header, ScalePressable, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { Expense, ExpenseFundingSource, ExpenseOverview, ExpenseRangeOverview } from '../types/domain';
import { toJakartaDateKey } from '../utils/date';
import { createLocalId, formatCurrency, formatDateTime, formatNumericInput, parseNumericInput } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetails'>;

const fundingLabels: Record<ExpenseFundingSource, string> = {
  bank: 'Kas non-tunai',
  cash: 'Kas tunai',
};

export function ExpenseDetailsScreen({ navigation, route }: Props) {
  const { from, to, rangeLabel } = route.params;
  const shift = useOperationsStore((state) => state.shift);
  const [report, setReport] = useState<ExpenseRangeOverview | null>(null);
  const [balance, setBalance] = useState<ExpenseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [fundingSource, setFundingSource] = useState<ExpenseFundingSource>('bank');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rangeResult, balanceResult] = await Promise.all([
        expenseService.listRange(from, to),
        shift?.status === 'open' ? expenseService.list(shift.id).catch(() => null) : Promise.resolve(null),
      ]);
      setReport(rangeResult);
      setBalance(balanceResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Rincian pengeluaran tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [from, shift?.id, shift?.status, to]);

  useFocusEffect(useCallback(() => {
    void loadDetails();
  }, [loadDetails]));

  const today = toJakartaDateKey();
  const canCreate = Boolean(shift?.status === 'open' && balance && from <= today && today <= to);
  const numericAmount = parseNumericInput(amount);
  const restoredBank = editingExpense?.bankAmount ?? 0;
  const restoredCash = editingExpense?.cashAmount ?? 0;
  const availableBank = Math.max(0, (balance?.bankBalance ?? 0) + restoredBank);
  const availableCash = Math.max(0, (balance?.cashBalance ?? 0) + restoredCash);
  const selectedBalance = fundingSource === 'bank' ? availableBank : availableCash;
  const insufficient = numericAmount > selectedBalance;
  const canSave = Boolean(
    shift?.status === 'open'
      && balance
      && name.trim().length >= 2
      && numericAmount > 0
      && !insufficient,
  );

  const openCreate = () => {
    setEditingExpense(null);
    setName('');
    setAmount('');
    setFundingSource('bank');
    setFormError(null);
    setEditorVisible(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setName(expense.name);
    setAmount(formatNumericInput(expense.amount));
    setFundingSource(expense.fundingSource === 'cash' ? 'cash' : 'bank');
    setFormError(null);
    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorVisible(false);
    setEditingExpense(null);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!shift || !canSave) return;
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      if (editingExpense) {
        await expenseService.update(editingExpense.id, {
          name: name.trim(),
          amount: numericAmount,
          fundingSource,
        });
        setNotice('Perubahan pengeluaran berhasil disimpan.');
      } else {
        await expenseService.create({
          idempotencyKey: createLocalId('expense'),
          shiftId: shift.id,
          name: name.trim(),
          amount: numericAmount,
          fundingSource,
        });
        setNotice('Pengeluaran baru berhasil ditambahkan.');
      }
      setEditorVisible(false);
      setEditingExpense(null);
      await loadDetails();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Pengeluaran tidak dapat disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteError(null);
  };

  const closeDelete = () => {
    if (deleting) return;
    setExpenseToDelete(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    setNotice(null);
    try {
      await expenseService.cancel(expenseToDelete.id, 'Dihapus dari detail pengeluaran');
      setExpenseToDelete(null);
      setNotice('Pengeluaran dihapus dari total dan saldo sudah dikembalikan.');
      await loadDetails();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (removeError) {
      setDeleteError(removeError instanceof Error ? removeError.message : 'Pengeluaran tidak dapat dihapus.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl} contentStyle={styles.screen}>
      <Header eyebrow="Rincian laporan" onBack={navigation.goBack} subtitle={rangeLabel} title="Detail pengeluaran" />

      <GlassCard dark contentStyle={styles.heroCard}>
        <View style={styles.heroHeading}>
          <View style={styles.heroIcon}><ReceiptText color={palette.honeySoft} size={24} /></View>
          <StatusPill label={`${report?.expenseCount ?? 0} aktif`} tone="success" />
        </View>
        <Text style={styles.heroLabel}>Total pengeluaran</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>{formatCurrency(report?.totalExpenses ?? 0)}</Text>
        <Text style={styles.heroHelper}>Catatan yang dibatalkan tidak masuk ke total laporan.</Text>
      </GlassCard>

      <View style={styles.summaryGrid}>
        <SummaryCard icon={Banknote} label="Kas tunai" loading={loading} value={report?.cashExpenses ?? 0} />
        <SummaryCard icon={Landmark} label="Kas non-tunai" loading={loading} value={report?.bankExpenses ?? 0} />
      </View>

      {notice ? <View accessibilityLiveRegion="polite" style={styles.noticePanel}><Text style={styles.noticeText}>{notice}</Text></View> : null}
      {error ? (
        <View style={styles.errorPanel}>
          <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{error}</Text>
          <Button compact icon={RefreshCw} label="Coba lagi" onPress={loadDetails} variant="secondary" />
        </View>
      ) : null}

      <SectionHeader title="Daftar pengeluaran" />
      <View style={styles.toolbar}>
        <View style={styles.toolbarCopy}>
          <Text style={styles.toolbarTitle}>Kelola rincian biaya</Text>
          <Text style={styles.toolbarHelper}>{canCreate ? 'Tambah, edit, atau hapus catatan pada shift aktif.' : 'Penambahan hanya tersedia untuk periode hari ini saat shift aktif.'}</Text>
        </View>
        <Button compact disabled={!canCreate} icon={Plus} label="Tambah" onPress={openCreate} />
      </View>

      {loading && !report ? (
        <View accessibilityLiveRegion="polite" style={styles.loadingState}>
          <ActivityIndicator color={palette.cocoa} />
          <Text style={styles.emptyText}>Memuat rincian pengeluaran…</Text>
        </View>
      ) : report?.expenses.length ? (
        <GlassCard contentStyle={styles.listCard}>
          {report.expenses.map((expense, index) => {
            const isCancelled = expense.status === 'cancelled';
            const canEdit = !isCancelled && shift?.status === 'open' && expense.shiftId === shift.id;
            return (
              <View key={expense.id} style={[styles.expenseRow, index > 0 && styles.rowDivider, isCancelled && styles.cancelledRow]}>
                <View style={styles.rowMain}>
                  <View style={[styles.expenseIcon, isCancelled && styles.cancelledIcon]}>
                    <ReceiptText color={isCancelled ? palette.muted : palette.cocoa} size={20} />
                  </View>
                  <View style={styles.expenseCopy}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.expenseName, isCancelled && styles.cancelledText]}>{expense.name}</Text>
                      {isCancelled ? <StatusPill label="Dihapus" tone="danger" /> : !canEdit ? <StatusPill label="Terkunci" tone="warning" /> : null}
                    </View>
                    <Text style={styles.expenseMeta}>{formatDateTime(expense.createdAt)} · {expense.createdByName}</Text>
                    <View style={styles.fundingRow}>
                      {expense.bankAmount > 0 ? <Text style={styles.fundingBank}>Non-tunai {formatCurrency(expense.bankAmount)}</Text> : null}
                      {expense.cashAmount > 0 ? <Text style={styles.fundingCash}>Tunai {formatCurrency(expense.cashAmount)}</Text> : null}
                    </View>
                    {isCancelled && expense.cancelReason ? <Text style={styles.cancelReason}>Alasan: {expense.cancelReason}</Text> : null}
                  </View>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.expenseAmount, isCancelled && styles.cancelledAmount]}>{formatCurrency(expense.amount)}</Text>
                </View>
                {canEdit ? (
                  <View style={styles.rowActions}>
                    <Button compact icon={Pencil} label="Edit" onPress={() => openEdit(expense)} style={styles.rowAction} variant="secondary" />
                    <Button compact icon={Trash2} label="Hapus" onPress={() => openDelete(expense)} style={styles.rowAction} variant="danger" />
                  </View>
                ) : null}
              </View>
            );
          })}
        </GlassCard>
      ) : (
        <View style={styles.emptyState}>
          <ReceiptText color={palette.rose} size={32} />
          <Text style={styles.emptyTitle}>Belum ada rincian pengeluaran</Text>
          <Text style={styles.emptyText}>Contohnya tepung terigu, minyak goreng, gas, atau biaya operasional lain.</Text>
          {canCreate ? <Button compact icon={Plus} label="Tambah pengeluaran" onPress={openCreate} /> : null}
        </View>
      )}

      <FormModal
        footer={<View style={styles.modalActions}><Button compact label="Batal" onPress={closeEditor} variant="secondary" /><Button compact label={editingExpense ? 'Simpan perubahan' : 'Tambah pengeluaran'} loading={saving} disabled={!canSave} onPress={handleSave} /></View>}
        onClose={closeEditor}
        subtitle={editingExpense ? 'Perbarui nama, nominal, atau sumber dana catatan ini.' : 'Catatan baru akan masuk ke laporan periode hari ini.'}
        title={editingExpense ? 'Edit pengeluaran' : 'Tambah pengeluaran'}
        visible={editorVisible}
      >
        <View style={styles.formContent}>
          <Field autoCapitalize="words" label="Nama pengeluaran" onChangeText={(value) => { setName(value); setFormError(null); }} placeholder="Contoh: Tepung terigu" value={name} />
          <Field keyboardType="number-pad" label="Nominal" leftIcon={ReceiptText} onChangeText={(value) => { setAmount(formatNumericInput(value)); setFormError(null); }} placeholder="0" value={amount} />
          <View style={styles.sourceGroup}>
            <Text style={styles.sourceLabel}>Sumber dana</Text>
            <View style={styles.sourceGrid}>
              <FundingOption balance={availableBank} icon="bank" label={fundingLabels.bank} onPress={() => { setFundingSource('bank'); setFormError(null); }} selected={fundingSource === 'bank'} />
              <FundingOption balance={availableCash} icon="cash" label={fundingLabels.cash} onPress={() => { setFundingSource('cash'); setFormError(null); }} selected={fundingSource === 'cash'} />
            </View>
          </View>
          {numericAmount > 0 && insufficient ? (
            <View style={styles.balanceWarning}>
              <AlertTriangle color={palette.danger} size={18} />
              <Text style={styles.balanceWarningText}>Nominal melebihi saldo {fundingLabels[fundingSource].toLowerCase()} yang tersedia, yaitu {formatCurrency(selectedBalance)}.</Text>
            </View>
          ) : null}
          {formError ? <Text accessibilityLiveRegion="assertive" style={styles.formError}>{formError}</Text> : null}
        </View>
      </FormModal>

      <FormModal
        footer={<View style={styles.modalActions}><Button compact label="Batal" onPress={closeDelete} variant="secondary" /><Button compact icon={Trash2} label="Hapus pengeluaran" loading={deleting} onPress={handleDelete} variant="danger" /></View>}
        onClose={closeDelete}
        subtitle={expenseToDelete ? `${formatCurrency(expenseToDelete.amount)} akan dikeluarkan dari total laporan dan dikembalikan ke saldo asal. Jejak audit tetap disimpan.` : undefined}
        title={`Hapus ${expenseToDelete?.name ?? 'pengeluaran'}?`}
        visible={Boolean(expenseToDelete)}
      >
        <View style={styles.deleteWarning}>
          <AlertTriangle color={palette.danger} size={21} />
          <Text style={styles.deleteWarningText}>Tindakan ini tidak dapat dibatalkan dari aplikasi.</Text>
        </View>
        {deleteError ? <Text accessibilityLiveRegion="assertive" style={styles.formError}>{deleteError}</Text> : null}
      </FormModal>
    </Screen>
  );
}

function SummaryCard({ icon: Icon, label, value, loading }: { icon: typeof Banknote; label: string; value: number; loading: boolean }) {
  return (
    <GlassCard style={styles.summaryCard} contentStyle={styles.summaryInner}>
      <Icon color={palette.honey} size={20} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryValue}>{loading ? '…' : formatCurrency(value)}</Text>
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

const styles = StyleSheet.create({
  screen: { maxWidth: 920, alignSelf: 'center' },
  heroCard: { minHeight: 188, padding: spacing.lg },
  heroHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  heroLabel: { color: 'rgba(255,255,255,0.68)', fontFamily: type.medium, fontSize: 12, marginTop: spacing.md },
  heroValue: { color: palette.white, fontFamily: type.display, fontSize: 34, marginTop: 2, fontVariant: ['tabular-nums'] },
  heroHelper: { color: 'rgba(255,255,255,0.62)', fontFamily: type.regular, fontSize: 11, lineHeight: 17, marginTop: spacing.xs },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  summaryCard: { flexGrow: 1, flexBasis: 240 },
  summaryInner: { minHeight: 108, padding: spacing.md },
  summaryLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11, marginTop: spacing.sm },
  summaryValue: { color: palette.ink, fontFamily: type.bold, fontSize: 18, marginTop: 2, fontVariant: ['tabular-nums'] },
  noticePanel: { borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(38,122,85,0.18)', backgroundColor: palette.successSoft, padding: spacing.md, marginTop: spacing.md },
  noticeText: { color: palette.success, fontFamily: type.semibold, fontSize: 12, lineHeight: 18 },
  errorPanel: { gap: spacing.sm, borderRadius: radius.md, backgroundColor: palette.dangerSoft, padding: spacing.md, marginTop: spacing.md },
  errorText: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 18 },
  toolbar: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.55)', padding: spacing.md, marginBottom: spacing.md },
  toolbarCopy: { flex: 1, minWidth: 0 },
  toolbarTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  toolbarHelper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 16, marginTop: 3 },
  loadingState: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  listCard: { paddingHorizontal: spacing.md },
  expenseRow: { paddingVertical: spacing.md, gap: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.line },
  cancelledRow: { opacity: 0.72 },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  expenseIcon: { width: 44, height: 44, flexShrink: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  cancelledIcon: { backgroundColor: palette.line },
  expenseCopy: { flex: 1, minWidth: 0, paddingTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  expenseName: { flexShrink: 1, color: palette.ink, fontFamily: type.bold, fontSize: 13, lineHeight: 19 },
  cancelledText: { color: palette.muted, textDecorationLine: 'line-through' },
  expenseMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 16, marginTop: 3 },
  fundingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  fundingBank: { color: palette.info, fontFamily: type.semibold, fontSize: 9, backgroundColor: palette.infoSoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  fundingCash: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 9, backgroundColor: palette.honeySoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  cancelReason: { color: palette.danger, fontFamily: type.medium, fontSize: 9, lineHeight: 14, marginTop: spacing.xs },
  expenseAmount: { maxWidth: 160, flexShrink: 1, color: palette.danger, fontFamily: type.bold, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
  cancelledAmount: { color: palette.muted, textDecorationLine: 'line-through' },
  rowActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.xs },
  rowAction: { minWidth: 112 },
  emptyState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.52)', padding: spacing.lg },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15, textAlign: 'center' },
  emptyText: { maxWidth: 460, color: palette.muted, fontFamily: type.regular, fontSize: 11, textAlign: 'center', lineHeight: 17 },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.xs },
  formContent: { gap: spacing.md },
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
  balanceWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(185,62,72,0.18)', backgroundColor: palette.dangerSoft, padding: spacing.md },
  balanceWarningText: { flex: 1, color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 17 },
  formError: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  deleteWarning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: palette.dangerSoft, padding: spacing.md },
  deleteWarningText: { flex: 1, color: palette.danger, fontFamily: type.semibold, fontSize: 12, lineHeight: 18 },
});
