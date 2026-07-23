import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Printer, RotateCcw, Share2, ShieldAlert } from 'lucide-react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { saleService } from '../api/services';
import { BcaTransferDetails } from '../components/bca-transfer-details';
import { Button, Divider, Field, FormModal, GlassCard, Header, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import { selectedOptionSummary } from '../utils/cartOptions';
import { formatCurrency, formatDateTime, orderTypeLabels, paymentLabels, pricingModeLabels } from '../utils/format';
import { shareInvoiceImage } from '../utils/share-invoice';
import { useThermalInvoicePrinter } from '../utils/useThermalInvoicePrinter';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export function OrderDetailScreen({ navigation, route }: Props) {
  const cachedTransaction = useOperationsStore((state) => state.transactions.find((item) => item.id === route.params.transactionId));
  const refund = useOperationsStore((state) => state.refundTransaction);
  const user = useSessionStore((state) => state.user);
  const invoiceRef = useRef<ViewShotRef>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [loadedTransaction, setLoadedTransaction] = useState(cachedTransaction);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sharingInvoice, setSharingInvoice] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);
  const transaction = cachedTransaction ?? loadedTransaction;
  const { printFeedback, printInvoice, printingInvoice } = useThermalInvoicePrinter(transaction);

  useEffect(() => {
    if (cachedTransaction) {
      setLoadedTransaction(cachedTransaction);
      return;
    }
    saleService.get(route.params.transactionId)
      .then(setLoadedTransaction)
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Transaksi tidak ditemukan.'));
  }, [cachedTransaction, route.params.transactionId]);

  if (!transaction) return <Screen><Header onBack={navigation.goBack} title="Detail transaksi" /><Text style={styles.notFound}>{loadError ?? 'Memuat transaksi…'}</Text></Screen>;

  const safeReceiptNo = transaction.receiptNo.replace(/[^a-zA-Z0-9_-]/g, '-');

  const handleRefund = async () => {
    if (reason.trim().length < 5) {
      setRefundError('Alasan refund minimal 5 karakter.');
      return;
    }
    if (user?.role === 'cashier' && managerPin.length < 4) {
      setRefundError('Masukkan PIN manager.');
      return;
    }
    setRefunding(true);
    try {
      await refund(transaction.id, reason.trim(), managerPin || undefined);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRefundOpen(false);
    } catch (error) {
      setRefundError(error instanceof Error ? error.message : 'Refund tidak dapat diproses.');
    } finally {
      setRefunding(false);
    }
  };

  const shareInvoice = async () => {
    if (!invoiceRef.current || sharingInvoice) return;

    setSharingInvoice(true);
    setShareFeedback(null);
    try {
      const imageUri = await invoiceRef.current.capture();
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
      setSharingInvoice(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <Header onBack={navigation.goBack} subtitle={formatDateTime(transaction.createdAt)} title="Detail transaksi" />
      <ViewShot
        ref={invoiceRef}
        options={{
          fileName: `invoice-${safeReceiptNo}`,
          format: 'jpg',
          quality: 0.95,
          result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
        }}
        style={styles.invoiceSurface}
      >
      <GlassCard dark contentStyle={styles.heroCard}>
        <View style={styles.heroTop}><Text style={styles.receiptNo}>{transaction.receiptNo}</Text><StatusPill label={transaction.status === 'paid' ? 'Lunas' : 'Refund'} tone={transaction.status === 'paid' ? 'success' : 'danger'} /></View>
        <Text style={styles.heroLabel}>Total pembayaran</Text>
        <Text style={styles.heroTotal}>{formatCurrency(transaction.total)}</Text>
        <Text style={styles.heroMeta}>{pricingModeLabels[transaction.pricingMode]} · {paymentLabels[transaction.paymentMethod]} · {orderTypeLabels[transaction.orderType]} · {transaction.itemCount} item</Text>
      </GlassCard>

      <SectionHeader title="Rincian item" />
      <GlassCard contentStyle={styles.itemsCard}>
        {transaction.items.map((item, index) => (
          <View key={item.lineId}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.itemRow}><View style={styles.quantity}><Text style={styles.quantityText}>{item.quantity}×</Text></View><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text>{selectedOptionSummary(item) ? <Text style={styles.itemOptions}>{selectedOptionSummary(item)}</Text> : null}<Text style={styles.itemPrice}>{formatCurrency(item.price)} / item</Text></View><Text style={styles.itemTotal}>{formatCurrency(item.price * item.quantity)}</Text></View>
          </View>
        ))}
      </GlassCard>

      <SectionHeader title="Informasi transaksi" />
      <GlassCard contentStyle={styles.infoCard}>
        <InfoRow label="Pelanggan" value={transaction.customerName ?? 'Pelanggan umum'} />
        <InfoRow label="Kasir" value={transaction.cashierName} />
        <InfoRow label="Metode bayar" value={paymentLabels[transaction.paymentMethod]} />
        <InfoRow label="Jenis harga" value={pricingModeLabels[transaction.pricingMode]} />
        <InfoRow label="Uang diterima" value={formatCurrency(transaction.amountPaid)} />
        <InfoRow label="Kembalian" value={formatCurrency(transaction.change)} />
        <InfoRow label="Status pencatatan" value="Tersimpan" />
      </GlassCard>

      {transaction.paymentMethod === 'transfer' ? (
        <>
          <SectionHeader title="Rekening transfer" />
          <BcaTransferDetails helper="Rekening tujuan untuk pembayaran." />
        </>
      ) : null}
      </ViewShot>

      <SectionHeader title="Profit transaksi" />
      <GlassCard contentStyle={styles.profitCard}>
        <InfoRow label="Jumlah donat" value={`${transaction.pieceCount} pcs`} />
        <InfoRow label="HPP per pcs" value={formatCurrency(transaction.costPerItem)} />
        <InfoRow label="Total HPP" value={formatCurrency(transaction.costOfGoodsSold)} />
        <Divider />
        <View style={styles.profitRow}><Text style={styles.profitLabel}>Laba bersih</Text><Text style={[styles.profitValue, transaction.netProfit < 0 && styles.profitNegative]}>{formatCurrency(transaction.netProfit)}</Text></View>
        <Text style={styles.profitHelper}>{transaction.status === 'refunded' ? 'Transaksi refund tidak masuk profit.' : `Laba bersih = total transaksi − HPP ${transaction.pieceCount} pcs donat${transaction.netMarginPercent === null ? '.' : ` · margin ${transaction.netMarginPercent}%.`}`}</Text>
      </GlassCard>

      <View style={styles.actions}>
        <Button icon={Printer} label="Cetak invoice (2 salinan)" loading={printingInvoice} onPress={printInvoice} variant="secondary" />
        {printFeedback ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.shareFeedback, printFeedback.tone === 'success' ? styles.shareFeedbackSuccess : styles.shareFeedbackDanger]}
          >
            {printFeedback.message}
          </Text>
        ) : null}
        <Button icon={Share2} label="Bagikan invoice (JPG)" loading={sharingInvoice} onPress={shareInvoice} variant="secondary" />
        {transaction.status === 'paid' ? <Button icon={RotateCcw} label="Refund transaksi" onPress={() => { setRefundOpen(true); setRefundError(null); }} variant="danger" /> : null}
        {shareFeedback ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.shareFeedback, shareFeedback.tone === 'success' ? styles.shareFeedbackSuccess : styles.shareFeedbackDanger]}
          >
            {shareFeedback.message}
          </Text>
        ) : null}
      </View>
      <View style={styles.securityNote}><ShieldAlert color={palette.honey} size={17} /><Text style={styles.securityText}>Semua refund wajib memiliki alasan audit; kasir juga memerlukan PIN manager.</Text></View>

      <FormModal
        footer={<View style={styles.modalActions}><Button compact label="Batal" onPress={() => setRefundOpen(false)} variant="secondary" /><Button compact label="Konfirmasi refund" loading={refunding} onPress={handleRefund} variant="danger" /></View>}
        onClose={() => setRefundOpen(false)}
        subtitle="Stok terlacak akan dikembalikan dan perubahan ini tidak dapat dibatalkan."
        title={`Refund ${transaction.receiptNo}`}
        visible={refundOpen}
      >
        <Field label="Alasan refund" multiline numberOfLines={3} onChangeText={setReason} placeholder="Jelaskan alasan refund" style={styles.reasonInput} value={reason} />
        {user?.role === 'cashier' ? <Field keyboardType="number-pad" label="PIN manager" onChangeText={setManagerPin} secureTextEntry value={managerPin} /> : null}
        {refundError ? <Text style={styles.refundError}>{refundError}</Text> : null}
      </FormModal>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  invoiceSurface: { width: '100%', overflow: 'hidden', padding: spacing.sm, backgroundColor: palette.cream, borderRadius: radius.lg },
  heroCard: { padding: spacing.lg, minHeight: 180 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  receiptNo: { color: palette.white, fontFamily: type.bold, fontSize: 13 },
  heroLabel: { color: 'rgba(255,255,255,0.62)', fontFamily: type.medium, fontSize: 11, marginTop: spacing.lg },
  heroTotal: { color: palette.white, fontFamily: type.display, fontSize: 32, marginTop: 3 },
  heroMeta: { color: palette.honeySoft, fontFamily: type.medium, fontSize: 11, marginTop: spacing.sm },
  itemsCard: { paddingHorizontal: spacing.md },
  itemRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quantity: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  quantityText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 12 },
  itemCopy: { flex: 1 },
  itemName: { color: palette.ink, fontFamily: type.semibold, fontSize: 13 },
  itemPrice: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  itemOptions: { color: palette.cocoa, fontFamily: type.medium, fontSize: 10, marginTop: 3 },
  itemTotal: { color: palette.cocoa, fontFamily: type.bold, fontSize: 12 },
  infoCard: { padding: spacing.md, gap: spacing.sm },
  infoRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  infoLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  infoValue: { flex: 1, color: palette.ink, fontFamily: type.semibold, fontSize: 11, textAlign: 'right' },
  profitCard: { padding: spacing.md, gap: spacing.sm },
  profitRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  profitLabel: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  profitValue: { color: palette.success, fontFamily: type.bold, fontSize: 18 },
  profitNegative: { color: palette.danger },
  profitHelper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15 },
  actions: { gap: spacing.xs, marginTop: spacing.lg },
  shareFeedback: { fontFamily: type.medium, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: spacing.sm },
  shareFeedbackSuccess: { color: palette.success },
  shareFeedbackDanger: { color: palette.danger },
  securityNote: { minHeight: 52, borderRadius: radius.md, backgroundColor: palette.honeySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.md },
  securityText: { flex: 1, color: '#805307', fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
  notFound: { color: palette.danger, fontFamily: type.medium, textAlign: 'center', marginTop: spacing.xl },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  refundError: { color: palette.danger, fontFamily: type.medium, fontSize: 11 },
  reasonInput: { minHeight: 84, textAlignVertical: 'top' },
});
