import * as Haptics from 'expo-haptics';
import { Banknote, CircleDollarSign, Clock3, LogOut, Store } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Button, Field, GlassCard, Screen, StatusPill } from '../components/ui';
import { TERMINAL_ID } from '../api/client';
import { palette, radius, spacing, type } from '../theme/tokens';
import { useOperationsStore } from '../store/operationsStore';
import { useSessionStore } from '../store/sessionStore';
import { formatCurrency } from '../utils/format';

const cashSuggestions = [100000, 200000, 300000, 500000];

export function OpenShiftScreen() {
  const [openingCash, setOpeningCash] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const user = useSessionStore((state) => state.user);
  const logout = useSessionStore((state) => state.logout);
  const openShift = useOperationsStore((state) => state.openShift);

  const handleOpen = async () => {
    const value = Number(openingCash.replace(/\D/g, ''));
    if (!Number.isFinite(value) || value < 0) {
      setError('Masukkan modal awal yang valid.');
      return;
    }
    if (!TERMINAL_ID) {
      setError('Perangkat kasir belum siap. Hubungi pengelola outlet.');
      return;
    }
    setSubmitting(true);
    try {
      await openShift(value, TERMINAL_ID);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Shift tidak dapat dibuka.');
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
        <StatusPill label="Persiapan outlet" tone="warning" />
        <Text accessibilityRole="header" style={styles.title}>Buka shift hari ini</Text>
        <Text style={styles.subtitle}>Catat modal awal laci agar rekonsiliasi kas di akhir shift tetap akurat.</Text>
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
          <View style={styles.summaryItem}><Clock3 color={palette.honey} size={19} /><Text style={styles.summaryLabel}>Mulai</Text><Text style={styles.summaryValue}>Sekarang</Text></View>
          <View style={styles.summaryItem}><CircleDollarSign color={palette.rose} size={19} /><Text style={styles.summaryLabel}>Terminal</Text><Text style={styles.summaryValue}>{TERMINAL_ID || 'Belum siap'}</Text></View>
        </View>

        <Field
          error={error}
          keyboardType="number-pad"
          label="Modal awal laci"
          leftIcon={Banknote}
          onChangeText={(value) => { setOpeningCash(value.replace(/\D/g, '')); setError(null); }}
          placeholder="0"
          value={openingCash}
        />
        <Text style={styles.amountPreview}>{formatCurrency(Number(openingCash || 0))}</Text>

        <View style={styles.suggestions}>
          {cashSuggestions.map((amount) => (
            <Button key={amount} compact label={formatCurrency(amount).replace('Rp', 'Rp ')} onPress={() => setOpeningCash(String(amount))} style={styles.suggestionButton} variant={Number(openingCash) === amount ? 'primary' : 'secondary'} />
          ))}
        </View>

        <Button icon={Clock3} label="Buka shift & mulai jualan" loading={submitting} onPress={handleOpen} />
        <Text style={styles.helper}>Modal awal membantu pencocokan uang laci saat penjualan selesai.</Text>
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
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  suggestionButton: { flexGrow: 1, minWidth: 112 },
  helper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
