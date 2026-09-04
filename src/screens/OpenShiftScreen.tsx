import * as Haptics from 'expo-haptics';
import { Banknote, CalendarDays, CircleDollarSign, Clock3, Landmark, LogOut, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Button, Field, GlassCard, Screen, StatusPill } from '../components/ui';
import { TERMINAL_ID } from '../api/client';
import { shiftService } from '../api/services';
import { palette, radius, spacing, type } from '../theme/tokens';
import { useOperationsStore } from '../store/operationsStore';
import { useSessionStore } from '../store/sessionStore';
import { formatJakartaBusinessDate } from '../utils/date';
import { formatCurrency, formatNumericInput, parseNumericInput } from '../utils/format';

export function OpenShiftScreen() {
  const [openingPhysicalCash, setOpeningPhysicalCash] = useState('');
  const [openingBankBalance, setOpeningBankBalance] = useState('');
  const [accumulatedBalances, setAccumulatedBalances] = useState<{ cash: number; bank: number } | null>(null);
  const [physicalError, setPhysicalError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [balancesLoading, setBalancesLoading] = useState(Boolean(TERMINAL_ID));
  const [carriedFromShiftId, setCarriedFromShiftId] = useState<string | null>(null);
  const user = useSessionStore((state) => state.user);
  const logout = useSessionStore((state) => state.logout);
  const openShift = useOperationsStore((state) => state.openShift);
  const hasOpeningBalances = openingPhysicalCash.trim().length > 0 && openingBankBalance.trim().length > 0;

  useEffect(() => {
    let active = true;
    if (!TERMINAL_ID) {
      setBalancesLoading(false);
      return () => { active = false; };
    }
    shiftService.nextOpeningBalances(TERMINAL_ID)
      .then((balances) => {
        if (!active || !balances.sourceShiftId) return;
        setAccumulatedBalances({ cash: balances.openingCash, bank: balances.openingBankBalance });
        setCarriedFromShiftId(balances.sourceShiftId);
      })
      .catch((loadError) => {
        if (active) setSubmitError(loadError instanceof Error ? loadError.message : 'Saldo sebelumnya tidak dapat dimuat.');
      })
      .finally(() => { if (active) setBalancesLoading(false); });
    return () => { active = false; };
  }, []);

  const handleOpen = async () => {
    const physicalValue = parseNumericInput(openingPhysicalCash);
    const bankValue = parseNumericInput(openingBankBalance);
    const nextPhysicalError = openingPhysicalCash.trim().length === 0
      ? 'Kas tunai wajib diisi. Jika laci kosong, masukkan 0.'
      : !Number.isFinite(physicalValue) || physicalValue < 0
        ? 'Masukkan saldo kas tunai yang valid.'
        : null;
    const nextBankError = openingBankBalance.trim().length === 0
      ? 'Kas non-tunai wajib diisi. Jika saldo kosong, masukkan 0.'
      : !Number.isFinite(bankValue) || bankValue < 0
        ? 'Masukkan saldo kas non-tunai yang valid.'
        : null;
    setPhysicalError(nextPhysicalError);
    setBankError(nextBankError);
    setSubmitError(null);
    if (nextPhysicalError || nextBankError) return;
    if (!TERMINAL_ID) {
      setSubmitError('Perangkat kasir belum siap. Hubungi pengelola outlet.');
      return;
    }
    setSubmitting(true);
    try {
      await openShift(physicalValue, bankValue, TERMINAL_ID, false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (openError) {
      setSubmitError(openError instanceof Error ? openError.message : 'Shift tidak dapat dibuka.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <View style={styles.topbar}>
        <BrandLogo width={210} />
        <Button compact icon={LogOut} label="Keluar" onPress={logout} variant="ghost" />
      </View>

      <View style={styles.hero}>
        <StatusPill label={carriedFromShiftId ? 'Saldo sebelumnya tersedia' : 'Buka shift'} tone={carriedFromShiftId ? 'success' : 'warning'} />
        <Text accessibilityRole="header" style={styles.title}>Buka shift hari ini</Text>
        <Text style={styles.subtitle}>{carriedFromShiftId ? 'Saldo akhir shift sebelumnya ditampilkan sebagai acuan. Isi saldo aktual untuk membuka shift baru.' : 'Sebelum mulai berjualan, catat saldo kas tunai dan non-tunai hari ini.'}</Text>
      </View>

      <GlassCard contentStyle={styles.shiftCard}>
        <View style={styles.identityRow}>
          <View style={styles.storeIcon}><Store color={palette.cocoa} size={24} /></View>
          <View style={styles.identityCopy}>
            <Text style={styles.outlet}>{user?.outletName}</Text>
            <Text style={styles.cashier}>{user?.name} · Kasir</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}><CalendarDays color={palette.honey} size={19} /><Text style={styles.summaryLabel}>Hari operasional</Text><Text style={styles.summaryValue}>{formatJakartaBusinessDate()}</Text></View>
          <View style={styles.summaryItem}><CircleDollarSign color={palette.rose} size={19} /><Text style={styles.summaryLabel}>Terminal</Text><Text style={styles.summaryValue}>{TERMINAL_ID || 'Belum siap'}</Text></View>
        </View>

        <Field
          accessibilityLabel={accumulatedBalances ? `Kas tunai awal. Hasil akumulasi ${formatCurrency(accumulatedBalances.cash)}` : 'Kas tunai awal'}
          editable={!balancesLoading}
          error={physicalError}
          keyboardType="number-pad"
          label="Kas tunai awal"
          labelRight={accumulatedBalances ? `Hasil akumulasi: ${formatCurrency(accumulatedBalances.cash)}` : undefined}
          leftIcon={Banknote}
          onChangeText={(value) => { setOpeningPhysicalCash(formatNumericInput(value)); setPhysicalError(null); setSubmitError(null); }}
          placeholder="0"
          value={openingPhysicalCash}
        />
        <Text style={styles.amountPreview}>{openingPhysicalCash.trim() ? formatCurrency(parseNumericInput(openingPhysicalCash)) : ' '}</Text>

        <Field
          accessibilityLabel={accumulatedBalances ? `Kas non-tunai awal. Hasil akumulasi ${formatCurrency(accumulatedBalances.bank)}` : 'Kas non-tunai awal'}
          editable={!balancesLoading}
          error={bankError}
          keyboardType="number-pad"
          label="Kas non-tunai awal"
          labelRight={accumulatedBalances ? `Hasil akumulasi: ${formatCurrency(accumulatedBalances.bank)}` : undefined}
          leftIcon={Landmark}
          onChangeText={(value) => { setOpeningBankBalance(formatNumericInput(value)); setBankError(null); setSubmitError(null); }}
          placeholder="0"
          value={openingBankBalance}
        />
        <Text style={styles.amountPreview}>{openingBankBalance.trim() ? formatCurrency(parseNumericInput(openingBankBalance)) : ' '}</Text>

        {submitError ? <Text style={styles.formError}>{submitError}</Text> : null}
        <Button disabled={!hasOpeningBalances || balancesLoading} icon={Clock3} label={balancesLoading ? 'Memuat saldo sebelumnya...' : 'Buka shift & mulai jualan'} loading={submitting} onPress={handleOpen} />
        <Text style={styles.helper}>{carriedFromShiftId ? 'Bandingkan saldo aktual dengan hasil akumulasi, lalu isi kedua field. Masukkan angka 0 jika saldo kosong.' : 'Kedua field wajib diisi untuk shift pertama. Masukkan angka 0 jika saldo kas tunai atau non-tunai kosong.'}</Text>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { alignItems: 'center', maxWidth: 460, alignSelf: 'center', marginVertical: spacing.xl },
  title: { color: palette.ink, fontFamily: type.display, fontSize: 34, lineHeight: 42, textAlign: 'center', marginTop: spacing.md },
  subtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.xs },
  shiftCard: { padding: spacing.lg, gap: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  storeIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: palette.roseSoft, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1 },
  outlet: { color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  cashier: { color: palette.muted, fontFamily: type.regular, fontSize: 12, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm },
  summaryItem: { flex: 1, minHeight: 104, borderRadius: radius.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: palette.line },
  summaryLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10, marginTop: spacing.sm },
  summaryValue: { color: palette.ink, fontFamily: type.bold, fontSize: 14, marginTop: 2 },
  amountPreview: { color: palette.cocoa, fontFamily: type.display, fontSize: 25, textAlign: 'center', marginTop: -spacing.sm },
  formError: { color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  helper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
