import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowUpRight, ReceiptText, RefreshCw, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { saleService } from '../api/services';
import { DateRangePicker } from '../components/date-range-picker';
import { Button, Chip, GlassCard, Header, ScalePressable, Screen, SearchField, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { Transaction, TransactionStatus } from '../types/domain';
import { type DateRangeSelection, makeDateRange, toSalesQuery } from '../utils/date';
import { formatCurrency, formatDateTime, paymentLabels } from '../utils/format';

type Filter = 'all' | TransactionStatus;
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'paid', label: 'Berhasil' },
  { id: 'refunded', label: 'Refund' },
];

export function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRangeSelection>(() => makeDateRange('day'));
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesStatus = filter === 'all' || transaction.status === filter;
      const matchesSearch = !query || transaction.receiptNo.toLowerCase().includes(query) || transaction.customerName?.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [filter, search, transactions]);
  const total = filtered.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.total, 0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setTransactions(await saleService.list(toSalesQuery(range)));
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Transaksi tidak dapat dimuat.';
      setError(message);
      throw refreshError;
    } finally {
      setRefreshing(false);
    }
  }, [range]);

  useFocusEffect(useCallback(() => {
    refresh().catch(() => undefined);
  }, [refresh]));

  return (
    <Screen contentStyle={styles.screen} scroll={false}>
      <Header eyebrow="Penjualan" subtitle="Telusuri pembayaran dan refund berdasarkan tanggal" title="Transaksi" />
      <GlassCard contentStyle={styles.summaryCard}>
        <View><Text style={styles.summaryLabel}>Nilai transaksi berhasil</Text><Text style={styles.summaryValue}>{formatCurrency(total)}</Text></View>
        <View style={styles.summaryCount}><ReceiptText color={palette.cocoa} size={18} /><Text style={styles.summaryCountText}>{filtered.filter((item) => item.status === 'paid').length} struk</Text></View>
      </GlassCard>
      <DateRangePicker onChange={setRange} value={range} />
      <SearchField onChangeText={setSearch} placeholder="No. struk atau pelanggan" value={search} />
      <View style={styles.filterRow}>{filters.map((item) => <Chip key={item.id} label={item.label} onPress={() => setFilter(item.id)} selected={filter === item.id} />)}</View>
      {error ? <View style={styles.errorPanel}><Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text><Button compact icon={RefreshCw} label="Coba lagi" onPress={() => refresh().catch(() => undefined)} variant="secondary" /></View> : null}
      {isWide ? (
        <GlassCard style={styles.tableCard} contentStyle={styles.tableSurface}>
          <SalesTableHeader />
          <FlatList
            contentContainerStyle={styles.tableList}
            data={filtered}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<EmptyTransactions />}
            onRefresh={() => refresh().catch(() => undefined)}
            refreshing={refreshing}
            renderItem={({ item }) => <SalesTableRow item={item} onPress={() => navigation.navigate('OrderDetail', { transactionId: item.id })} />}
            showsVerticalScrollIndicator={false}
          />
        </GlassCard>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<EmptyTransactions />}
          renderItem={({ item }) => (
            <ScalePressable accessibilityLabel={`Buka transaksi ${item.receiptNo}`} onPress={() => navigation.navigate('OrderDetail', { transactionId: item.id })}>
              <GlassCard style={styles.transactionCard} contentStyle={styles.transactionInner}>
                <View style={styles.transactionTop}>
                  <View style={styles.transactionIcon}><ReceiptText color={palette.cocoa} size={20} /></View>
                  <View style={styles.transactionCopy}><Text style={styles.receiptNo}>{item.receiptNo}</Text><Text style={styles.transactionDate}>{formatDateTime(item.createdAt)}</Text></View>
                  <StatusPill label={item.status === 'paid' ? 'Berhasil' : 'Refund'} tone={item.status === 'paid' ? 'success' : 'danger'} />
                </View>
                <View style={styles.transactionBottom}>
                  <View style={styles.transactionMeta}><Text style={styles.metaLabel}>{item.itemCount} item · {paymentLabels[item.paymentMethod]}</Text><Text numberOfLines={1} style={styles.customer}>{item.customerName ?? 'Pelanggan umum'}</Text></View>
                  <View style={styles.amountWrap}><Text style={styles.amount}>{formatCurrency(item.total)}</Text><Text style={[styles.profitAmount, item.status === 'refunded' && styles.refundedProfit]}>Profit {formatCurrency(item.netProfit)}</Text><ArrowUpRight color={palette.muted} size={17} /></View>
                </View>
              </GlassCard>
            </ScalePressable>
          )}
          refreshing={refreshing}
          onRefresh={() => refresh().catch(() => undefined)}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

function EmptyTransactions() {
  return <View style={styles.empty}><Search color={palette.rose} size={31} /><Text style={styles.emptyTitle}>Transaksi tidak ditemukan</Text><Text style={styles.emptyText}>Ubah periode, status, atau kata kunci pencarian.</Text></View>;
}

function SalesTableHeader() {
  return (
    <View style={[styles.tableRow, styles.tableHeader]}>
      <Text style={[styles.tableHeaderText, styles.dateColumn]}>Waktu</Text>
      <Text style={[styles.tableHeaderText, styles.receiptColumn]}>No. transaksi</Text>
      <Text style={[styles.tableHeaderText, styles.cashierColumn]}>Kasir / pelanggan</Text>
      <Text style={[styles.tableHeaderText, styles.methodColumn]}>Metode</Text>
      <Text style={[styles.tableHeaderText, styles.itemColumn]}>Item</Text>
      <Text style={[styles.tableHeaderText, styles.totalColumn]}>Total</Text>
      <Text style={[styles.tableHeaderText, styles.stateColumn]}>Status</Text>
      <View style={styles.openColumn} />
    </View>
  );
}

function SalesTableRow({ item, onPress }: { item: Transaction; onPress: () => void }) {
  return (
    <ScalePressable accessibilityLabel={`Buka transaksi ${item.receiptNo}`} onPress={onPress} style={styles.tableRow}>
      <Text numberOfLines={2} style={[styles.tableText, styles.dateColumn]}>{formatDateTime(item.createdAt)}</Text>
      <Text numberOfLines={1} style={[styles.tableReceipt, styles.receiptColumn]}>{item.receiptNo}</Text>
      <View style={styles.cashierColumn}><Text numberOfLines={1} style={styles.tableTextStrong}>{item.cashierName}</Text><Text numberOfLines={1} style={styles.tableSubtext}>{item.customerName ?? 'Pelanggan umum'}</Text></View>
      <Text style={[styles.tableText, styles.methodColumn]}>{paymentLabels[item.paymentMethod]}</Text>
      <Text style={[styles.tableText, styles.itemColumn]}>{item.itemCount}</Text>
      <View style={styles.totalColumn}><Text style={styles.tableAmount}>{formatCurrency(item.total)}</Text><Text style={[styles.tableProfit, item.status === 'refunded' && styles.refundedProfit]}>Profit {formatCurrency(item.netProfit)}</Text></View>
      <View style={styles.stateColumn}><StatusPill label={item.status === 'paid' ? 'Berhasil' : 'Refund'} tone={item.status === 'paid' ? 'success' : 'danger'} /></View>
      <View style={styles.openColumn}><ArrowUpRight color={palette.muted} size={17} /></View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  summaryCard: { marginBottom: spacing.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  summaryValue: { color: palette.ink, fontFamily: type.bold, fontSize: 20, marginTop: 3 },
  summaryCount: { minHeight: 36, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: palette.roseSoft },
  summaryCountText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingVertical: spacing.md },
  errorPanel: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: palette.dangerSoft },
  errorText: { flex: 1, color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 17 },
  list: { gap: spacing.sm, paddingBottom: 120 },
  transactionCard: { marginBottom: spacing.sm },
  transactionInner: { padding: spacing.md },
  transactionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  transactionIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  transactionCopy: { flex: 1 },
  receiptNo: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  transactionDate: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  transactionBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.line },
  transactionMeta: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  metaLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  customer: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 12, marginTop: 3 },
  amountWrap: { alignItems: 'flex-end', gap: 3 },
  amount: { color: palette.cocoa, fontFamily: type.bold, fontSize: 15 },
  profitAmount: { color: palette.success, fontFamily: type.semibold, fontSize: 9 },
  refundedProfit: { color: palette.muted },
  empty: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15, marginTop: spacing.md },
  emptyText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, marginTop: spacing.xs },
  tableCard: { flex: 1, minHeight: 360 },
  tableSurface: { flex: 1 },
  tableList: { flexGrow: 1 },
  tableRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.line },
  tableHeader: { minHeight: 50, backgroundColor: 'rgba(107,63,42,0.05)' },
  tableHeaderText: { color: palette.muted, fontFamily: type.bold, fontSize: 9, letterSpacing: 0.45, textTransform: 'uppercase' },
  tableText: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
  tableTextStrong: { color: palette.ink, fontFamily: type.semibold, fontSize: 11 },
  tableSubtext: { color: palette.muted, fontFamily: type.regular, fontSize: 9, marginTop: 3 },
  tableReceipt: { color: palette.ink, fontFamily: type.bold, fontSize: 10 },
  tableAmount: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11, fontVariant: ['tabular-nums'] },
  tableProfit: { color: palette.success, fontFamily: type.semibold, fontSize: 9, marginTop: 3, textAlign: 'right' },
  dateColumn: { width: 132 },
  receiptColumn: { flex: 1.25, minWidth: 130 },
  cashierColumn: { flex: 1.15, minWidth: 130 },
  methodColumn: { width: 82 },
  itemColumn: { width: 42, textAlign: 'center' },
  totalColumn: { width: 112, textAlign: 'right' },
  stateColumn: { width: 94, alignItems: 'flex-start' },
  openColumn: { width: 24, alignItems: 'flex-end' },
});
