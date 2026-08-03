import * as Haptics from 'expo-haptics';
import { Banknote, CalendarDays, CircleDollarSign, Clock3, Landmark, LogOut, Store } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Button, Field, GlassCard, Screen, StatusPill } from '../components/ui';
import { TERMINAL_ID } from '../api/client';
import { palette, radius, spacing, type } from '../theme/tokens';
import { useOperationsStore } from '../store/operationsStore';
import { useSessionStore } from '../store/sessionStore';
import { formatJakartaBusinessDate } from '../utils/date';
import { formatCurrency, formatNumericInput, parseNumericInput } from '../utils/format';

const cashSuggestions = [100000, 200000, 300000, 500000];

export function OpenShiftScreen() {
  const [openingPhysicalCash, setOpeningPhysicalCash] = useState('');
  const [openingBankBalance, setOpeningBankBalance] = useState('');
  const [physicalError, setPhysicalError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const user = useSessionStore((state) => state.user);
  const logout = useSessionStore((state) => state.logout);
  const openShift = useOperationsStore((state) => state.openShift);
  const hasOpeningBalances = openingPhysicalCash.trim().length > 0 && openingBankBalance.trim().length > 0;

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
      await openShift(physicalValue, bankValue, TERMINAL_ID);
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
        <StatusPill label="Wajib setiap hari" tone="warning" />
        <Text accessibilityRole="header" style={styles.title}>Buka shift hari ini</Text>
        <Text style={styles.subtitle}>Sebelum mulai berjualan, catat saldo kas tunai dan non-tunai hari ini.</Text>
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
          error={physicalError}
          keyboardType="number-pad"
          label="Kas tunai awal"
          leftIcon={Banknote}
          onChangeText={(value) => { setOpeningPhysicalCash(formatNumericInput(value)); setPhysicalError(null); setSubmitError(null); }}
          placeholder="0"
          value={openingPhysicalCash}
        />
        <Text style={styles.amountPreview}>{formatCurrency(parseNumericInput(openingPhysicalCash))}</Text>

        <Text style={styles.suggestionLabel}>Nominal cepat kas tunai</Text>
        <View style={styles.suggestions}>
          {cashSuggestions.map((amount) => (
            <Button key={amount} compact label={formatCurrency(amount).replace('Rp', 'Rp ')} onPress={() => { setOpeningPhysicalCash(formatNumericInput(amount)); setPhysicalError(null); setSubmitError(null); }} style={styles.suggestionButton} variant={parseNumericInput(openingPhysicalCash) === amount ? 'primary' : 'secondary'} />
          ))}
        </View>

        <Field
          error={bankError}
          keyboardType="number-pad"
          label="Kas non-tunai awal"
          leftIcon={Landmark}
          onChangeText={(value) => { setOpeningBankBalance(formatNumericInput(value)); setBankError(null); setSubmitError(null); }}
          placeholder="0"
          value={openingBankBalance}
        />
        <Text style={styles.amountPreview}>{formatCurrency(parseNumericInput(openingBankBalance))}</Text>

        {submitError ? <Text style={styles.formError}>{submitError}</Text> : null}
        <Button disabled={!hasOpeningBalances} icon={Clock3} label="Buka shift & mulai jualan" loading={submitting} onPress={handleOpen} />
        <Text style={styles.helper}>Kedua field wajib diisi setiap hari. Masukkan angka 0 jika saldo kas tunai atau non-tunai kosong.</Text>
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
  suggestionLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10, marginBottom: -spacing.sm },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  suggestionButton: { flexGrow: 1, minWidth: 112 },
  formError: { color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  helper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
