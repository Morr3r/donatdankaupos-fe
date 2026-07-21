import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Banknote, CreditCard, Handshake, Landmark, QrCode, ShoppingBag, Tag, UserRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { promotionService, saleService } from '../api/services';
import { BcaTransferDetails } from '../components/bca-transfer-details';
import { CartRow } from '../components/pos';
import { Button, Chip, Divider, Field, GlassCard, Header, ScalePressable, Screen, SectionHeader } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useCatalogStore } from '../store/catalogStore';
import { useOperationsStore } from '../store/operationsStore';
import { usePOSStore } from '../store/posStore';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { OrderType, PaymentMethod, SaleRequest } from '../types/domain';
import { createLocalId, formatCurrency, getCartTotals } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const orderTypes: { id: OrderType; label: string }[] = [
  { id: 'takeaway', label: 'Bawa pulang' },
  { id: 'dine_in', label: 'Dine in' },
  { id: 'delivery', label: 'Delivery' },
];

const paymentMethods: { id: PaymentMethod; label: string; helper: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Tunai', helper: 'Hitung kembalian', icon: Banknote },
  { id: 'qris', label: 'QRIS', helper: 'Scan kode bayar', icon: QrCode },
  { id: 'card', label: 'Kartu', helper: 'EDC debit/kredit', icon: CreditCard },
  { id: 'transfer', label: 'Transfer', helper: 'BCA · konfirmasi manual', icon: Landmark },
];

export function CheckoutScreen({ navigation }: Props) {
  const cart = usePOSStore((state) => state.cart);
  const changeQuantity = usePOSStore((state) => state.changeQuantity);
  const removeLine = usePOSStore((state) => state.removeLine);
  const pricingMode = usePOSStore((state) => state.pricingMode);
  const resetSale = usePOSStore((state) => state.resetSale);
  const loadCatalog = useCatalogStore((state) => state.load);
  const shift = useOperationsStore((state) => state.shift);
  const addTransaction = useOperationsStore((state) => state.addTransaction);
  const user = useSessionStore((state) => state.user);
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [voucher, setVoucher] = useState('');
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const totals = useMemo(() => getCartTotals(
    cart,
    discount,
    orderType,
    user?.dineInServiceRateBps ?? 0,
  ), [cart, discount, orderType, user?.dineInServiceRateBps]);
  const numericPaid = Number(amountPaid.replace(/\D/g, '') || 0);
  const suggestions = useMemo(() => {
    const rounded50 = Math.ceil(totals.total / 50_000) * 50_000;
    const rounded100 = Math.ceil(totals.total / 100_000) * 100_000;
    return Array.from(new Set([totals.total, rounded50, rounded100])).filter((value) => value > 0);
  }, [totals.total]);

  const applyVoucher = async () => {
    if (!voucher.trim()) {
      setDiscount(0);
      setError('Masukkan kode promo terlebih dahulu.');
      return;
    }
    setValidatingVoucher(true);
    try {
      const result = await promotionService.validate(voucher.trim(), totals.subtotal);
      setVoucher(result.code);
      setDiscount(result.discount);
      setError(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (voucherError) {
      setDiscount(0);
      setError(voucherError instanceof Error ? voucherError.message : 'Promo tidak dapat divalidasi.');
    } finally {
      setValidatingVoucher(false);
    }
  };

  const handlePayment = async () => {
    if (!cart.length || !shift || shift.status !== 'open') {
      setError('Keranjang kosong atau shift sudah tidak aktif.');
      return;
    }
    const paid = paymentMethod === 'cash' ? numericPaid : totals.total;
    if (paymentMethod === 'cash' && paid < totals.total) {
      setError(`Nominal kurang ${formatCurrency(totals.total - paid)}.`);
      return;
    }

    setProcessing(true);
    setError(null);
    const payload: SaleRequest = {
      idempotencyKey: createLocalId('sale'),
      shiftId: shift.id,
      items: cart,
      orderType,
      paymentMethod,
      pricingMode,
      customerName: customerName.trim() || undefined,
      voucherCode: voucher.trim() || undefined,
      discount,
      amountPaid: paid,
      totals,
    };

    try {
      const transaction = await saleService.create(payload);
      addTransaction(transaction);
      resetSale();
      void loadCatalog().catch(() => undefined);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('PaymentSuccess', { transactionId: transaction.id });
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Pembayaran tidak dapat diproses.');
    } finally {
      setProcessing(false);
    }
  };

  if (!cart.length) {
    return (
      <Screen>
        <Header onBack={navigation.goBack} title="Checkout" />
        <View style={styles.emptyState}><View style={styles.emptyIcon}><ShoppingBag color={palette.rose} size={32} /></View><Text style={styles.emptyTitle}>Keranjang sudah kosong</Text><Text style={styles.emptyText}>Kembali ke katalog untuk menambahkan produk.</Text><Button label="Kembali ke kasir" onPress={navigation.goBack} /></View>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing.xl}>
      <Header onBack={navigation.goBack} subtitle={`${cart.reduce((sum, item) => sum + item.quantity, 0)} item siap diproses`} title="Checkout" />

      <GlassCard style={styles.pricingCard} contentStyle={styles.pricingCardInner}>
        <View style={styles.pricingIcon}>
          {pricingMode === 'reseller' ? <Handshake color={palette.white} size={20} /> : <UserRound color={palette.white} size={20} />}
        </View>
        <View style={styles.pricingCopy}>
          <Text style={styles.pricingTitle}>Harga {pricingMode === 'reseller' ? 'reseller' : 'pelanggan'}</Text>
          <Text style={styles.pricingText}>Mode harga ini terkunci untuk seluruh pesanan.</Text>
        </View>
      </GlassCard>

      <SectionHeader title="Jenis pesanan" />
      <View style={styles.chips}>{orderTypes.map((item) => <Chip key={item.id} label={item.label} onPress={() => setOrderType(item.id)} selected={orderType === item.id} />)}</View>

      <SectionHeader title="Detail pelanggan" />
      <Field autoCapitalize="words" label="Nama pelanggan (opsional)" leftIcon={UserRound} onChangeText={setCustomerName} placeholder="Contoh: Kak Rani" value={customerName} />

      <SectionHeader title="Pesanan" />
      <GlassCard contentStyle={styles.orderCard}>
        {cart.map((item, index) => <View key={item.lineId}>{index > 0 ? <Divider /> : null}<CartRow item={item} onChange={changeQuantity} onRemove={removeLine} /></View>)}
      </GlassCard>

      <SectionHeader title="Promo" />
      <View style={styles.voucherRow}>
        <View style={styles.voucherField}><Field autoCapitalize="characters" leftIcon={Tag} onChangeText={setVoucher} placeholder="Kode voucher" value={voucher} /></View>
        <Button compact label="Pakai" loading={validatingVoucher} onPress={applyVoucher} variant="secondary" />
      </View>

      <SectionHeader title="Metode pembayaran" />
      <View style={styles.paymentGrid}>
        {paymentMethods.map(({ id, label, helper, icon: Icon }) => (
          <PaymentMethodOption
            key={id}
            icon={Icon}
            helper={helper}
            label={label}
            onPress={() => { setPaymentMethod(id); setError(null); }}
            selected={paymentMethod === id}
          />
        ))}
      </View>

      {paymentMethod === 'cash' ? (
        <GlassCard style={styles.cashCard} contentStyle={styles.cashCardInner}>
          <Field keyboardType="number-pad" label="Uang diterima" leftIcon={Banknote} onChangeText={(value) => { setAmountPaid(value.replace(/\D/g, '')); setError(null); }} placeholder="0" value={amountPaid} />
          <View style={styles.suggestions}>{suggestions.map((value) => <Button key={value} compact label={value === totals.total ? 'Uang pas' : formatCurrency(value)} onPress={() => setAmountPaid(String(value))} style={styles.suggestion} variant={numericPaid === value ? 'primary' : 'secondary'} />)}</View>
          <View style={styles.changeRow}><Text style={styles.changeLabel}>Kembalian</Text><Text style={[styles.changeValue, numericPaid < totals.total && styles.changeNegative]}>{formatCurrency(Math.max(0, numericPaid - totals.total))}</Text></View>
        </GlassCard>
      ) : null}

      {paymentMethod === 'transfer' ? (
        <BcaTransferDetails
          helper="Transfer sebesar total pembayaran, lalu konfirmasi sebelum menyelesaikan transaksi."
          style={styles.transferCard}
        />
      ) : null}

      <SectionHeader title="Ringkasan pembayaran" />
      <GlassCard contentStyle={styles.totalCard}>
        <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
        {totals.discount ? <SummaryRow label="Diskon" tone="success" value={`− ${formatCurrency(totals.discount)}`} /> : null}
        {totals.service ? <SummaryRow label="Biaya layanan" value={formatCurrency(totals.service)} /> : null}
        <Divider />
        <View style={styles.grandRow}><Text style={styles.grandLabel}>Total bayar</Text><Text style={styles.grandValue}>{formatCurrency(totals.total)}</Text></View>
      </GlassCard>

      {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
      <View style={styles.checkoutAction}>
        <Button icon={paymentMethods.find((item) => item.id === paymentMethod)?.icon ?? CreditCard} label={`Bayar ${formatCurrency(totals.total)}`} loading={processing} onPress={handlePayment} />
        <Text style={styles.offlineHelper}>Pastikan nominal pembayaran sudah benar sebelum menyelesaikan transaksi.</Text>
      </View>
    </Screen>
  );
}

function PaymentMethodOption({ label, helper, icon: Icon, selected, onPress }: {
  label: string;
  helper: string;
  icon: typeof Banknote;
  selected: boolean;
  onPress: () => void;
}) {
  const accessibilityLabel = `${label}, ${helper}`;
  return (
    <ScalePressable
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.paymentButton, selected && styles.paymentButtonSelected]}
    >
      <Icon color={selected ? palette.white : palette.cocoa} size={20} strokeWidth={2} />
      <Text style={[styles.paymentButtonText, selected && styles.paymentButtonTextSelected]}>{label} · {helper}</Text>
    </ScalePressable>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, tone === 'success' && styles.summarySuccess]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  pricingCard: { marginBottom: spacing.xs },
  pricingCardInner: { minHeight: 66, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.76)' },
  pricingIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoaDark },
  pricingCopy: { flex: 1 },
  pricingTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  pricingText: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  orderCard: { paddingHorizontal: spacing.md },
  voucherRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  voucherField: { flex: 1 },
  paymentGrid: { gap: spacing.xs },
  paymentButton: { width: '100%', minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: palette.glassStrong, borderColor: palette.line, borderWidth: 1 },
  paymentButtonSelected: { backgroundColor: palette.cocoaDark, borderColor: palette.cocoaDark },
  paymentButtonText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 15 },
  paymentButtonTextSelected: { color: palette.white },
  cashCard: { marginTop: spacing.md },
  transferCard: { marginTop: spacing.md },
  cashCardInner: { padding: spacing.md, gap: spacing.md },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  suggestion: { flexGrow: 1 },
  changeRow: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.successSoft },
  changeLabel: { color: palette.success, fontFamily: type.semibold, fontSize: 12 },
  changeValue: { color: palette.success, fontFamily: type.bold, fontSize: 18 },
  changeNegative: { color: palette.danger },
  totalCard: { padding: spacing.lg, gap: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 12 },
  summaryValue: { color: palette.ink, fontFamily: type.semibold, fontSize: 12 },
  summarySuccess: { color: palette.success },
  grandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs },
  grandLabel: { color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  grandValue: { color: palette.cocoa, fontFamily: type.display, fontSize: 25 },
  error: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 18, marginVertical: spacing.md, textAlign: 'center' },
  checkoutAction: { marginTop: spacing.md },
  offlineHelper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: spacing.sm },
  emptyState: { flex: 1, minHeight: 500, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon: { width: 72, height: 72, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  emptyTitle: { color: palette.ink, fontFamily: type.display, fontSize: 24 },
  emptyText: { color: palette.muted, fontFamily: type.regular, fontSize: 13, textAlign: 'center' },
});
