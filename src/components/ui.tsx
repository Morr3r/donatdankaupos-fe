import { LinearGradient } from 'expo-linear-gradient';
import type { LucideProps } from 'lucide-react-native';
import { ChevronLeft, Eye, EyeOff, Search, X } from 'lucide-react-native';
import type { ComponentType, PropsWithChildren, ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients, palette, radius, shadow, spacing, type } from '../theme/tokens';
import { useResponsiveLayout } from '../utils/responsive';
import { useReducedMotion } from '../utils/useReducedMotion';

type IconType = ComponentType<LucideProps>;

export function AppBackground({ children }: PropsWithChildren) {
  return (
    <LinearGradient colors={gradients.background} style={styles.background}>
      <View style={[styles.orb, styles.orbPink, styles.pointerNone]} />
      <View style={[styles.orb, styles.orbGold, styles.pointerNone]} />
      <View style={[styles.orb, styles.orbWhite, styles.pointerNone]} />
      {children}
    </LinearGradient>
  );
}

export function BrandLogo({ width = 270, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  const sourceSize = width;
  return (
    <View accessibilityLabel="Logo Donat Dankau" accessibilityRole="image" style={[styles.logoViewport, { width, height: width * 0.25 }, style]}>
      <Image
        resizeMode="contain"
        source={require('../../assets/donat-dankau-logo.png')}
        style={{ position: 'absolute', width: sourceSize, height: sourceSize, top: -sourceSize * 0.415, left: 0 }}
      />
    </View>
  );
}

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
}

export function Screen({ children, scroll = true, style, contentStyle, bottomInset }: ScreenProps) {
  const { isLandscapePhone, isPhone, width } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const gutter = isPhone ? spacing.md : width >= 768 ? spacing.xl : spacing.md;
  const resolvedBottomInset = bottomInset ?? (isLandscapePhone ? 76 : 112);
  const innerStyle = [
    styles.screenContent,
    {
      paddingHorizontal: gutter,
      paddingTop: isLandscapePhone ? spacing.xxs : spacing.sm,
      paddingBottom: resolvedBottomInset + insets.bottom,
    },
    contentStyle,
  ];

  return (
    <AppBackground>
      <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.safeArea}
        >
          {scroll ? (
            <ScrollView
              contentContainerStyle={innerStyle}
              contentInsetAdjustmentBehavior="automatic"
              keyboardDismissMode={process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={innerStyle}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
}

interface FormModalProps extends PropsWithChildren {
  visible: boolean;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  onClose: () => void;
}

export function FormModal({ visible, title, subtitle, footer, onClose, children }: FormModalProps) {
  const insets = useSafeAreaInsets();
  const { isLandscapePhone } = useResponsiveLayout();
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.modalBackdrop,
          isLandscapePhone && styles.modalBackdropLandscape,
          {
            paddingLeft: Math.max(insets.left, isLandscapePhone ? spacing.xs : spacing.md),
            paddingRight: Math.max(insets.right, isLandscapePhone ? spacing.xs : spacing.md),
          },
        ]}
      >
        <GlassCard style={[styles.modalCard, isLandscapePhone && styles.modalCardLandscape]} contentStyle={styles.modalSurface}>
          <ScrollView
            contentContainerStyle={[styles.modalContent, isLandscapePhone && styles.modalContentLandscape]}
            keyboardDismissMode={process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeading}>
              <View style={styles.modalCopy}>
                <Text accessibilityRole="header" style={styles.modalTitle}>{title}</Text>
                {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
              </View>
              <IconButton icon={X} label="Tutup" onPress={onClose} />
            </View>
            {children}
          </ScrollView>
          {footer ? <View style={[styles.modalFooter, isLandscapePhone && styles.modalFooterLandscape]}>{footer}</View> : null}
        </GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface GlassCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export function GlassCard({ children, style, contentStyle, dark = false }: GlassCardProps) {
  return (
    <View style={[styles.glassShell, dark && styles.glassShellDark, contentStyle, style]}>
      <View style={[styles.glassHighlight, styles.pointerNone]} />
      {children}
    </View>
  );
}

interface ScalePressableProps extends PropsWithChildren {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
  accessibilityState?: { selected?: boolean; disabled?: boolean; busy?: boolean };
}

export function ScalePressable({
  children,
  onPress,
  style,
  containerStyle,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
}: ScalePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  const animate = (toValue: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue, useNativeDriver: Platform.OS !== 'web', speed: 30, bounciness: 4 }).start();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      onPressIn={() => animate(0.975)}
      onPressOut={() => animate(1)}
      style={containerStyle}
    >
      {({ pressed }) => (
        <Animated.View style={[style, { opacity: disabled ? 0.45 : pressed ? 0.9 : 1, transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconType;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function Button({ label, onPress, icon: Icon, variant = 'primary', loading, disabled, style, compact }: ButtonProps) {
  const content = (
    <View style={[styles.buttonInner, compact && styles.buttonInnerCompact]}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? palette.white : palette.cocoa} /> : Icon ? <Icon color={variant === 'primary' ? palette.white : variant === 'danger' ? palette.danger : palette.cocoa} size={20} strokeWidth={2} /> : null}
      <Text style={[styles.buttonText, variant === 'primary' && styles.buttonTextPrimary, variant === 'danger' && styles.buttonTextDanger]}>{label}</Text>
    </View>
  );

  if (variant === 'primary') {
    return (
      <ScalePressable accessibilityLabel={label} disabled={disabled || loading} onPress={onPress} style={[styles.button, styles.buttonPrimary, style]}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>{content}</LinearGradient>
      </ScalePressable>
    );
  }

  return (
    <ScalePressable accessibilityLabel={label} disabled={disabled || loading} onPress={onPress} style={[styles.button, styles[`button_${variant}`], style]}>
      {content}
    </ScalePressable>
  );
}

interface IconButtonProps {
  icon: IconType;
  label: string;
  onPress: () => void;
  tone?: 'light' | 'dark' | 'danger';
}

export function IconButton({ icon: Icon, label, onPress, tone = 'light' }: IconButtonProps) {
  return (
    <ScalePressable accessibilityLabel={label} onPress={onPress} style={[styles.iconButton, tone === 'dark' && styles.iconButtonDark, tone === 'danger' && styles.iconButtonDanger]}>
      <Icon color={tone === 'dark' ? palette.white : tone === 'danger' ? palette.danger : palette.ink} size={21} strokeWidth={2} />
    </ScalePressable>
  );
}

interface HeaderProps {
  eyebrow?: string;
  brand?: ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function Header({ eyebrow, brand, title, subtitle, onBack, right }: HeaderProps) {
  const { isLandscapePhone } = useResponsiveLayout();
  return (
    <View style={[styles.header, isLandscapePhone && styles.headerLandscape]}>
      {onBack ? <IconButton icon={ChevronLeft} label="Kembali" onPress={onBack} /> : null}
      <View style={styles.headerCopy}>
        {brand ? <View style={styles.headerBrand}>{brand}</View> : eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.headerTitle, isLandscapePhone && styles.headerTitleLandscape]}>{title}</Text>
        {subtitle ? <Text numberOfLines={isLandscapePhone ? 1 : undefined} style={[styles.headerSubtitle, isLandscapePhone && styles.headerSubtitleLandscape]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  leftIcon?: IconType;
}

export function Field({ label, error, leftIcon: LeftIcon, secureTextEntry, style, ...props }: FieldProps) {
  const [secure, setSecure] = useState(Boolean(secureTextEntry));
  return (
    <View style={styles.fieldGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {LeftIcon ? <LeftIcon color={palette.muted} size={20} /> : null}
        <TextInput
          {...props}
          allowFontScaling
          placeholderTextColor="#988A82"
          secureTextEntry={secureTextEntry ? secure : false}
          style={[styles.fieldInput, style]}
        />
        {secureTextEntry ? (
          <Pressable accessibilityLabel={secure ? 'Tampilkan kata sandi' : 'Sembunyikan kata sandi'} hitSlop={12} onPress={() => setSecure((value) => !value)} style={styles.fieldAction}>
            {secure ? <Eye color={palette.muted} size={20} /> : <EyeOff color={palette.muted} size={20} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function SearchField({ value, onChangeText, placeholder = 'Cari produk atau SKU' }: SearchFieldProps) {
  return (
    <View style={styles.searchField}>
      <Search color={palette.muted} size={20} />
      <TextInput
        accessibilityLabel="Cari produk"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8D7D74"
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
      {value ? (
        <Pressable accessibilityLabel="Hapus pencarian" hitSlop={12} onPress={() => onChangeText('')}>
          <X color={palette.muted} size={19} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconType;
}

export function Chip({ label, selected, onPress, icon: Icon }: ChipProps) {
  const content = (
    <View style={[styles.chip, selected && styles.chipSelected]}>
      {Icon ? <Icon color={selected ? palette.white : palette.cocoa} size={16} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return <ScalePressable accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}>{content}</ScalePressable>;
}

export function StatusPill({ label, tone = 'success', style }: { label: string; tone?: 'success' | 'danger' | 'warning' | 'info'; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.statusPill, styles[`status_${tone}`], style]}>
      <View style={[styles.statusDot, styles[`statusDot_${tone}`]]} />
      <Text style={[styles.statusText, styles[`statusText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={4} style={styles.sectionActionButton}>
          <Text numberOfLines={1} style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  background: { flex: 1, overflow: 'hidden', backgroundColor: palette.cream },
  pointerNone: { pointerEvents: 'none' },
  logoViewport: { overflow: 'hidden', alignSelf: 'center' },
  safeArea: { flex: 1 },
  screenContent: { flexGrow: 1, width: '100%', maxWidth: 1240, alignSelf: 'center', paddingTop: spacing.sm },
  orb: { position: 'absolute', borderRadius: radius.pill },
  orbPink: { width: 230, height: 230, backgroundColor: 'rgba(232, 140, 164, 0.22)', top: -70, right: -95 },
  orbGold: { width: 190, height: 190, backgroundColor: 'rgba(239, 184, 89, 0.18)', bottom: 70, left: -100 },
  orbWhite: { width: 150, height: 150, backgroundColor: 'rgba(255,255,255,0.65)', top: '36%', right: -95 },
  glassShell: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.82)', backgroundColor: palette.glass, },
  glassShellDark: { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: palette.glassDark },
  glassHighlight: { position: 'absolute', top: 0, left: 20, right: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.95)' },
  button: { minHeight: 52, borderRadius: radius.md, overflow: 'hidden' },
  buttonPrimary: { ...shadow.glass },
  buttonGradient: { minHeight: 52, justifyContent: 'center' },
  button_secondary: { backgroundColor: palette.glassStrong, borderColor: palette.line, borderWidth: 1 },
  button_ghost: { backgroundColor: 'transparent' },
  button_danger: { backgroundColor: palette.dangerSoft, borderColor: 'rgba(185,62,72,0.16)', borderWidth: 1 },
  buttonInner: { minHeight: 52, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  buttonInnerCompact: { minHeight: 44, paddingHorizontal: spacing.md },
  buttonText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 15 },
  buttonTextPrimary: { color: palette.white },
  buttonTextDanger: { color: palette.danger },
  iconButton: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.glassStrong, borderColor: palette.line, borderWidth: 1 },
  iconButtonDark: { backgroundColor: palette.cocoaDark, borderColor: 'rgba(255,255,255,0.16)' },
  iconButtonDanger: { backgroundColor: palette.dangerSoft, borderColor: 'rgba(185,62,72,0.16)' },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: spacing.sm, marginBottom: spacing.md },
  headerLandscape: { minHeight: 52, marginBottom: spacing.xs },
  headerCopy: { flex: 1 },
  headerBrand: { alignItems: 'flex-start', marginBottom: 2 },
  headerRight: { marginLeft: spacing.xs },
  eyebrow: { color: palette.honey, fontFamily: type.bold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { color: palette.ink, fontFamily: type.display, fontSize: 28, lineHeight: 34 },
  headerTitleLandscape: { fontSize: 23, lineHeight: 28 },
  headerSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 18, marginTop: 2 },
  headerSubtitleLandscape: { fontSize: 11, lineHeight: 15 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 13, marginLeft: 2 },
  field: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, paddingHorizontal: spacing.md },
  fieldError: { borderColor: palette.danger },
  fieldInput: { flex: 1, minHeight: 52, color: palette.ink, fontFamily: type.medium, fontSize: 15, paddingVertical: spacing.sm },
  fieldAction: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  fieldErrorText: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 17 },
  searchField: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.78)' },
  searchInput: { flex: 1, minHeight: 50, color: palette.ink, fontFamily: type.medium, fontSize: 15 },
  chip: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.64)', borderWidth: 1, borderColor: palette.line },
  chipSelected: { backgroundColor: palette.cocoaDark, borderColor: palette.cocoaDark },
  chipText: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 13 },
  chipTextSelected: { color: palette.white },
  statusPill: { minHeight: 30, paddingHorizontal: spacing.sm, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: type.bold, fontSize: 11 },
  status_success: { backgroundColor: palette.successSoft },
  status_danger: { backgroundColor: palette.dangerSoft },
  status_warning: { backgroundColor: palette.honeySoft },
  status_info: { backgroundColor: palette.infoSoft },
  statusDot_success: { backgroundColor: palette.success },
  statusDot_danger: { backgroundColor: palette.danger },
  statusDot_warning: { backgroundColor: '#A16A0A' },
  statusDot_info: { backgroundColor: palette.info },
  statusText_success: { color: palette.success },
  statusText_danger: { color: palette.danger },
  statusText_warning: { color: '#805307' },
  statusText_info: { color: palette.info },
  sectionHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { flex: 1, minWidth: 0, color: palette.ink, fontFamily: type.bold, fontSize: 17, lineHeight: 23 },
  sectionActionButton: { minHeight: 44, flexShrink: 0, justifyContent: 'center', paddingLeft: spacing.xs },
  sectionAction: { color: palette.cocoa, fontFamily: type.bold, fontSize: 13 },
  divider: { height: 1, backgroundColor: palette.line },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: palette.scrim },
  modalBackdropLandscape: { paddingVertical: spacing.xs },
  modalCard: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: palette.porcelain },
  modalCardLandscape: { maxWidth: 760, maxHeight: '100%' },
  modalSurface: { maxHeight: '100%', flexShrink: 1, backgroundColor: palette.porcelain },
  modalContent: { padding: spacing.lg, gap: spacing.md },
  modalContentLandscape: { padding: spacing.sm, gap: spacing.sm },
  modalHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  modalCopy: { flex: 1 },
  modalTitle: { color: palette.ink, fontFamily: type.display, fontSize: 24, lineHeight: 30 },
  modalSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17, marginTop: 3 },
  modalFooter: { padding: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: palette.porcelain },
  modalFooterLandscape: { padding: spacing.xs },
});
