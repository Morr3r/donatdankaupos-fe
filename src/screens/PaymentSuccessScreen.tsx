import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Home, ReceiptText, Share2, ShoppingBag } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { BcaTransferDetails } from '../components/bca-transfer-details';
import { Button, Divider, GlassCard, Screen, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { gradients, palette, radius, shadow, spacing, type } from '../theme/tokens';
import { selectedOptionSummary } from '../utils/cartOptions';
import { formatCurrency, formatDateTime, orderTypeLabels, paymentLabels, pricingModeLabels } from '../utils/format';
import { LinearGradient } from 'expo-linear-gradient';
import { shareInvoiceImage } from '../utils/share-invoice';
import { useReducedMotion } from '../utils/useReducedMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentSuccess'>;

export function PaymentSuccessScreen({ navigation, route }: Props) {
  const transaction = useOperationsStore((state) => state.transactions.find((item) => item.id === route.params.transactionId));
  const receiptRef = useRef<ViewShotRef>(null);
  const checkScale = useRef(new Animated.Value(1)).current;
  const checkOffset = useRef(new Animated.Value(0)).current;
  const [sharingReceipt, setSharingReceipt] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    checkScale.stopAnimation();
    checkOffset.stopAnimation();
    checkScale.setValue(1);
    checkOffset.setValue(0);

    if (reducedMotion) return undefined;

    const useNativeDriver = Platform.OS !== 'web';
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(checkScale, {
            toValue: 1.07,
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
          Animated.timing(checkOffset, {
            toValue: -5,
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
        ]),
        Animated.parallel([
          Animated.timing(checkScale, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver,
          }),
          Animated.timing(checkOffset, {
            toValue: 0,
            duration: 650,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver,
          }),
        ]),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [checkOffset, checkScale, reducedMotion]);

  if (!transaction) return <Screen><Text style={styles.notFound}>Transaksi tidak ditemukan.</Text></Screen>;

  const newSale = () => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'POS' } }] });
  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Home' } }] });
  const safeReceiptNo = transaction.receiptNo.replace(/[^a-zA-Z0-9_-]/g, '-');

  const shareReceipt = async () => {
    if (!receiptRef.current || sharingReceipt) return;

    setSharingReceipt(true);
    setShareFeedback(null);
    try {
      const imageUri = await receiptRef.current.capture();
      const result = await shareInvoiceImage(imageUri, transaction.receiptNo);
      if (result === 'downloaded') {
        setShareFeedback({ message: 'Invoice JPG berhasil diunduh.', tone: 'success' });
      } else if (result === 'unavailable') {
        setShareFeedback({ message: 'Fitur berbagi tidak tersedia di perangkat ini.', tone: 'danger' });
      }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      setShareFeedback({ message: 'Invoice JPG belum dapat dibuat. Silakan coba lagi.', tone: 'danger' });
    } finally {
      setSharingReceipt(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <ViewShot
        ref={receiptRef}
        options={{
          fileName: `invoice-${safeReceiptNo}`,
          format: 'jpg',
          quality: 0.95,
          result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
        }}
        style={styles.invoiceSurface}
      >
        <View style={[styles.shareOrb, styles.shareOrbPink]} />
        <View style={[styles.shareOrb, styles.shareOrbGold]} />
        <View style={[styles.shareOrb, styles.shareOrbWhite]} />
      <View style={styles.successHero}>
        <Animated.View
          style={[styles.checkMotion, { transform: [{ translateY: checkOffset }, { scale: checkScale }] }]}
        >
          <LinearGradient colors={gradients.success} style={styles.checkCircle}>
            <Check color={palette.white} size={42} strokeWidth={2.5} />
          </LinearGradient>
        </Animated.View>
        <StatusPill label="Pembayaran berhasil" style={styles.successStatus} tone="success" />
        <Text accessibilityRole="header" style={styles.title}>Transaksi selesai</Text>
        <Text style={styles.subtitle}>Pembayaran sudah dicatat. Siapkan pesanan terbaik untuk pelanggan.</Text>
        <Text style={styles.total}>{formatCurrency(transaction.total)}</Text>
        {transaction.change > 0 ? <Text style={styles.change}>Kembalian {formatCurrency(transaction.change)}</Text> : null}
      </View>

      <GlassCard style={styles.receiptCard} contentStyle={styles.receiptInner}>
        <View style={styles.receiptHeading}>
          <View style={styles.receiptIcon}><ReceiptText color={palette.cocoa} size={22} /></View>
          <View style={styles.receiptCopy}><Text style={styles.receiptNo}>{transaction.receiptNo}</Text><Text style={styles.receiptDate}>{formatDateTime(transaction.createdAt)}</Text></View>
          <StatusPill label="Tersimpan" tone="success" />
        </View>
        <Divider />
        {transaction.items.map((item) => (
          <View key={item.lineId} style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.quantity}×</Text><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text>{selectedOptionSummary(item) ? <Text style={styles.itemOptions}>{selectedOptionSummary(item)}</Text> : null}</View><Text style={styles.itemValue}>{formatCurrency(item.price * item.quantity)}</Text>
          </View>
        ))}
        <Divider />
        <DetailRow label="Metode" value={paymentLabels[transaction.paymentMethod]} />
        <DetailRow label="Jenis pesanan" value={orderTypeLabels[transaction.orderType]} />
        <DetailRow label="Jenis harga" value={pricingModeLabels[transaction.pricingMode]} />
        {transaction.customerName ? <DetailRow label="Pelanggan" value={transaction.customerName} /> : null}
        <DetailRow label="Kasir" value={transaction.cashierName} />
        {transaction.paymentMethod === 'transfer' ? (
          <BcaTransferDetails helper="Rekening tujuan untuk pembayaran" style={styles.invoiceBankCard} />
        ) : null}
        <Divider />
        <DetailRow label="Jumlah donat" value={`${transaction.pieceCount} pcs`} />
        <DetailRow label="Subtotal" value={formatCurrency(transaction.subtotal)} />
        {transaction.discount > 0 ? <DetailRow label="Diskon" value={`− ${formatCurrency(transaction.discount)}`} /> : null}
        {transaction.tax > 0 ? <DetailRow label="Pajak" value={formatCurrency(transaction.tax)} /> : null}
        {transaction.service > 0 ? <DetailRow label="Biaya layanan" value={formatCurrency(transaction.service)} /> : null}
        <View style={styles.invoiceTotalRow}><Text style={styles.invoiceTotalLabel}>Total pembayaran</Text><Text style={styles.invoiceTotalValue}>{formatCurrency(transaction.total)}</Text></View>
        {transaction.paymentMethod === 'cash' ? <DetailRow label="Uang diterima" value={formatCurrency(transaction.amountPaid)} /> : null}
        {transaction.change > 0 ? <DetailRow label="Kembalian" value={formatCurrency(transaction.change)} /> : null}
        <Text style={styles.invoiceThanks}>Terima kasih sudah berbelanja di Donat Dankau.</Text>
      </GlassCard>
      </ViewShot>

      <View style={styles.actions}>
        <Button icon={ShoppingBag} label="Transaksi baru" onPress={newSale} />
        <Button icon={Share2} label="Bagikan invoice (JPG)" loading={sharingReceipt} onPress={shareReceipt} variant="secondary" />
        {shareFeedback ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.shareFeedback, shareFeedback.tone === 'success' ? styles.shareFeedbackSuccess : styles.shareFeedbackDanger]}
          >
            {shareFeedback.message}
          </Text>
        ) : null}
        <Button icon={Home} label="Kembali ke beranda" onPress={goHome} variant="ghost" />
      </View>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  invoiceSurface: { position: 'relative', maxWidth: 624, width: '100%', alignSelf: 'center', overflow: 'hidden', padding: spacing.sm, backgroundColor: palette.cream },
  shareOrb: { position: 'absolute', borderRadius: radius.pill },
  shareOrbPink: { width: 220, height: 220, top: -80, right: -100, backgroundColor: 'rgba(232, 140, 164, 0.22)' },
  shareOrbGold: { width: 180, height: 180, bottom: 45, left: -105, backgroundColor: 'rgba(239, 184, 89, 0.18)' },
  shareOrbWhite: { width: 150, height: 150, top: '38%', right: -100, backgroundColor: 'rgba(255,255,255,0.65)' },
  successHero: { alignItems: 'center', paddingVertical: spacing.xl, maxWidth: 520, alignSelf: 'center' },
  checkMotion: { marginBottom: spacing.md },
  checkCircle: { width: 86, height: 86, borderRadius: 31, alignItems: 'center', justifyContent: 'center', ...shadow.floating },
  successStatus: { alignSelf: 'center' },
  title: { color: palette.ink, fontFamily: type.display, fontSize: 32, marginTop: spacing.md },
  subtitle: { maxWidth: 390, color: palette.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  total: { color: palette.cocoa, fontFamily: type.display, fontSize: 36, marginTop: spacing.lg },
  change: { color: palette.success, fontFamily: type.bold, fontSize: 13, marginTop: spacing.xs },
  receiptCard: { maxWidth: 600, width: '100%', alignSelf: 'center' },
  receiptInner: { padding: spacing.lg, gap: spacing.sm },
  receiptHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  receiptIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  receiptCopy: { flex: 1 },
  receiptNo: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  receiptDate: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  invoiceBankCard: { marginVertical: spacing.xs },
  itemRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemQty: { width: 28, color: palette.cocoa, fontFamily: type.bold, fontSize: 12 },
  itemCopy: { flex: 1 },
  itemName: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 12 },
  itemOptions: { color: palette.cocoa, fontFamily: type.regular, fontSize: 9, marginTop: 2 },
  itemValue: { color: palette.ink, fontFamily: type.semibold, fontSize: 12 },
  detailRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  detailValue: { color: palette.ink, fontFamily: type.semibold, fontSize: 11 },
  invoiceTotalRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: palette.line, marginTop: spacing.xs, paddingTop: spacing.sm },
  invoiceTotalLabel: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  invoiceTotalValue: { color: palette.cocoa, fontFamily: type.display, fontSize: 21 },
  invoiceThanks: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 10, lineHeight: 16, textAlign: 'center', paddingTop: spacing.sm },
  actions: { maxWidth: 600, width: '100%', alignSelf: 'center', gap: spacing.xs, marginTop: spacing.lg },
  shareFeedback: { fontFamily: type.medium, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: spacing.sm },
  shareFeedbackSuccess: { color: palette.success },
  shareFeedbackDanger: { color: palette.danger },
  notFound: { color: palette.danger, fontFamily: type.medium, textAlign: 'center', marginTop: spacing.xxl },
});
