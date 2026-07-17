import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Home, ReceiptText, ShoppingBag } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Divider, GlassCard, Screen, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { gradients, palette, radius, shadow, spacing, type } from '../theme/tokens';
import { selectedOptionSummary } from '../utils/cartOptions';
import { formatCurrency, formatDateTime, orderTypeLabels, paymentLabels } from '../utils/format';
import { LinearGradient } from 'expo-linear-gradient';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentSuccess'>;

export function PaymentSuccessScreen({ navigation, route }: Props) {
  const transaction = useOperationsStore((state) => state.transactions.find((item) => item.id === route.params.transactionId));

  if (!transaction) return <Screen><Text style={styles.notFound}>Transaksi tidak ditemukan.</Text></Screen>;

  const newSale = () => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'POS' } }] });
  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Home' } }] });

  return (
    <Screen bottomInset={spacing.xl}>
      <View style={styles.successHero}>
        <LinearGradient colors={gradients.success} style={styles.checkCircle}><Check color={palette.white} size={42} strokeWidth={2.5} /></LinearGradient>
        <StatusPill label="Pembayaran berhasil" tone="success" />
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
        {transaction.customerName ? <DetailRow label="Pelanggan" value={transaction.customerName} /> : null}
        <DetailRow label="Kasir" value={transaction.cashierName} />
        <Divider />
        <DetailRow label="Jumlah donat" value={`${transaction.pieceCount} pcs`} />
        <DetailRow label="Total HPP" value={formatCurrency(transaction.costOfGoodsSold)} />
        <DetailRow label="Laba bersih" value={formatCurrency(transaction.netProfit)} />
      </GlassCard>

      <View style={styles.actions}>
        <Button icon={ShoppingBag} label="Transaksi baru" onPress={newSale} />
        <Button icon={Home} label="Kembali ke beranda" onPress={goHome} variant="ghost" />
      </View>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  successHero: { alignItems: 'center', paddingVertical: spacing.xl, maxWidth: 520, alignSelf: 'center' },
  checkCircle: { width: 86, height: 86, borderRadius: 31, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, ...shadow.floating },
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
  itemRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemQty: { width: 28, color: palette.cocoa, fontFamily: type.bold, fontSize: 12 },
  itemCopy: { flex: 1 },
  itemName: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 12 },
  itemOptions: { color: palette.cocoa, fontFamily: type.regular, fontSize: 9, marginTop: 2 },
  itemValue: { color: palette.ink, fontFamily: type.semibold, fontSize: 12 },
  detailRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  detailValue: { color: palette.ink, fontFamily: type.semibold, fontSize: 11 },
  actions: { maxWidth: 600, width: '100%', alignSelf: 'center', gap: spacing.xs, marginTop: spacing.lg },
  notFound: { color: palette.danger, fontFamily: type.medium, textAlign: 'center', marginTop: spacing.xxl },
});
