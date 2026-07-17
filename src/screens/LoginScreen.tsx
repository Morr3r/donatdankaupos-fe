import { LinearGradient } from 'expo-linear-gradient';
import { LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppBackground, BrandLogo, Button, Field, GlassCard } from '../components/ui';
import { gradients, palette, radius, spacing, type } from '../theme/tokens';
import { useSessionStore } from '../store/sessionStore';

export function LoginScreen() {
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
      // Error state is rendered directly below the fields.
    }
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardDismissMode={process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <BrandLogo width={300} />
            <View style={styles.productPill}><Sparkles color={palette.honey} size={15} /><Text style={styles.productPillText}>Premium Point of Sale</Text></View>
            <Text accessibilityRole="header" style={styles.title}>Kasir ringan.{`\n`}Pelayanan berkelas.</Text>
            <Text style={styles.subtitle}>Kelola penjualan, stok, shift, dan laporan dalam satu pengalaman yang cepat.</Text>
          </View>

          <GlassCard style={styles.loginCard} contentStyle={styles.loginCardInner} intensity={66}>
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
              placeholder="nama@donatdankau.id"
              value={email}
            />
            <Field
              autoComplete="password"
              label="Kata sandi"
              leftIcon={LockKeyhole}
              onChangeText={setPassword}
              placeholder="Minimal 6 karakter"
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

          <Text style={styles.version}>Donat Dankau POS · v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

export function SplashScreen() {
  return (
    <LinearGradient colors={gradients.background} style={styles.splash}>
      <View style={styles.splashMark}><BrandLogo width={260} /></View>
      <Text style={styles.splashText}>Menyiapkan outlet Anda…</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  brandBlock: { alignItems: 'center', marginBottom: spacing.lg },
  productPill: { minHeight: 32, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginTop: spacing.sm },
  productPillText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11, letterSpacing: 0.4 },
  title: { color: palette.ink, fontFamily: type.display, fontSize: 35, lineHeight: 41, textAlign: 'center', marginTop: spacing.md },
  subtitle: { maxWidth: 390, color: palette.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  loginCard: { width: '100%' },
  loginCardInner: { padding: spacing.lg, gap: spacing.md },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  lockIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: palette.roseSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 17 },
  cardSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 12, marginTop: 2 },
  errorText: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 18 },
  securityNotice: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  securityNoticeText: { color: palette.success, fontFamily: type.semibold, fontSize: 11 },
  version: { color: palette.muted, fontFamily: type.medium, fontSize: 10, textAlign: 'center', marginTop: spacing.lg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  splashMark: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.72)' },
  splashText: { color: palette.muted, fontFamily: type.medium, fontSize: 13 },
});
