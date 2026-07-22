import { LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground, BrandLogo, Button, Field, GlassCard } from '../components/ui';
import { palette, radius, spacing, type } from '../theme/tokens';
import { useSessionStore } from '../store/sessionStore';
import { useResponsiveLayout } from '../utils/responsive';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { isLandscapePhone } = useResponsiveLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const login = useSessionStore((state) => state.login);
  const isSubmitting = useSessionStore((state) => state.isSubmitting);
  const serverError = useSessionStore((state) => state.error);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      setLocalError('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Kata sandi minimal 6 karakter.');
      return;
    }
    setLocalError(null);
    try {
      await login({ email: normalizedEmail, password });
    } catch {
    }
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            isLandscapePhone && styles.containerLandscape,
            {
              paddingLeft: Math.max(insets.left, isLandscapePhone ? spacing.md : spacing.lg),
              paddingRight: Math.max(insets.right, isLandscapePhone ? spacing.md : spacing.lg),
            },
          ]}
          keyboardDismissMode={process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.loginLayout, isLandscapePhone && styles.loginLayoutLandscape]}>
            <View style={[styles.brandBlock, isLandscapePhone && styles.brandBlockLandscape]}>
              <BrandLogo width={isLandscapePhone ? 220 : 300} />
              <View style={[styles.productPill, isLandscapePhone && styles.productPillLandscape]}><Sparkles color={palette.honey} size={15} /><Text style={styles.productPillText}>Premium Point of Sale</Text></View>
              <Text accessibilityRole="header" style={[styles.title, isLandscapePhone && styles.titleLandscape]}>Kasir ringan.{`\n`}Pelayanan berkelas.</Text>
              <Text style={[styles.subtitle, isLandscapePhone && styles.subtitleLandscape]}>Kelola penjualan, stok, shift, dan laporan dalam satu pengalaman yang cepat.</Text>
            </View>

            <GlassCard style={[styles.loginCard, isLandscapePhone && styles.loginCardLandscape]} contentStyle={[styles.loginCardInner, isLandscapePhone && styles.loginCardInnerLandscape]}>
              <View style={styles.cardHeading}>
                <View style={styles.lockIcon}><LockKeyhole color={palette.cocoa} size={22} /></View>
                <View>
                  <Text style={styles.cardTitle}>Masuk ke outlet</Text>
                  <Text style={styles.cardSubtitle}>Gunakan akun kasir Anda</Text>
                </View>
              </View>

              <Field
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                label="Email"
                leftIcon={Mail}
                onChangeText={setEmail}
                placeholder="Masukkan email anda"
                value={email}
              />
              <Field
                autoComplete="password"
                label="Kata sandi"
                leftIcon={LockKeyhole}
                onChangeText={setPassword}
                placeholder="Masukkan kata sandi anda"
                secureTextEntry
                value={password}
              />
              {localError || serverError ? <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{localError ?? serverError}</Text> : null}
              <Button label="Masuk ke POS" loading={isSubmitting} onPress={handleLogin} />

              <View style={styles.securityNotice}>
                <ShieldCheck color={palette.success} size={17} />
                <Text style={styles.securityNoticeText}>Akun Anda terlindungi di perangkat ini</Text>
              </View>
            </GlassCard>
          </View>

          <Text style={[styles.version, isLandscapePhone && styles.versionLandscape]}>Donat Dankau POS · v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, width: '100%', alignSelf: 'center' },
  containerLandscape: { paddingVertical: spacing.sm },
  loginLayout: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  loginLayoutLandscape: { maxWidth: 960, flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  brandBlock: { alignItems: 'center', marginBottom: spacing.lg },
  brandBlockLandscape: { flex: 0.9, minWidth: 0, marginBottom: 0 },
  productPill: { minHeight: 32, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginTop: spacing.sm },
  productPillLandscape: { marginTop: spacing.xs },
  productPillText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11, letterSpacing: 0.4 },
  title: { color: palette.ink, fontFamily: type.display, fontSize: 35, lineHeight: 41, textAlign: 'center', marginTop: spacing.md },
  titleLandscape: { fontSize: 28, lineHeight: 33, marginTop: spacing.xs },
  subtitle: { maxWidth: 390, color: palette.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  subtitleLandscape: { maxWidth: 340, fontSize: 11, lineHeight: 17 },
  loginCard: { width: '100%' },
  loginCardLandscape: { flex: 1.1, minWidth: 0 },
  loginCardInner: { padding: spacing.lg, gap: spacing.md },
  loginCardInnerLandscape: { padding: spacing.md, gap: spacing.sm },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  lockIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: palette.roseSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 17 },
  cardSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 12, marginTop: 2 },
  errorText: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 18 },
  securityNotice: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  securityNoticeText: { color: palette.success, fontFamily: type.semibold, fontSize: 11 },
  version: { color: palette.muted, fontFamily: type.medium, fontSize: 10, textAlign: 'center', marginTop: spacing.lg },
  versionLandscape: { marginTop: spacing.xs },
});
