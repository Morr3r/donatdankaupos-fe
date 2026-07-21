import type { StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, type } from '../theme/tokens';

export const BCA_ACCOUNT_NUMBER = '0633032332';

export function BcaTransferDetails({
  helper = 'Pastikan nominal transfer sesuai dengan total pembayaran.',
  style,
}: {
  helper?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityLabel={`Rekening transfer BCA ${BCA_ACCOUNT_NUMBER}`}
      style={[styles.card, style]}
    >
      <View style={styles.logoSurface}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Logo BCA"
          resizeMode="contain"
          source={require('../../assets/bca-logo.png')}
          style={styles.logo}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>REKENING TUJUAN TRANSFER</Text>
        <Text selectable style={styles.number}>{BCA_ACCOUNT_NUMBER}</Text>
        <Text style={styles.bankName}>Bank Central Asia (BCA)</Text>
        <Text style={styles.helper}>{helper}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 180, 0.18)',
    backgroundColor: 'rgba(232, 246, 255, 0.88)',
  },
  logoSurface: {
    width: 92,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  logo: { width: 76, height: 28 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0068B4', fontFamily: type.bold, fontSize: 9, letterSpacing: 0.8 },
  number: { color: palette.ink, fontFamily: type.bold, fontSize: 21, letterSpacing: 1, fontVariant: ['tabular-nums'], marginTop: 3 },
  bankName: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 11, marginTop: 1 },
  helper: { color: palette.muted, fontFamily: type.regular, fontSize: 9, lineHeight: 14, marginTop: spacing.xs },
});
