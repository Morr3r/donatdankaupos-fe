import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowUpRight, ReceiptText, RefreshCw, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { saleService } from '../api/services';
import { DateRangePicker } from '../components/date-range-picker';
import { Button, Chip, GlassCard, Header, ScalePressable, Screen, SearchField, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { Transaction, TransactionStatus } from '../types/domain';
import { type DateRangeSelection, makeDateRange, toSalesQuery } from '../utils/date';
import { formatCurrency, formatDateTime, getPaymentLabel } from '../utils/format';
import { useResponsiveLayout } from '../utils/responsive';

type Filter = 'all' | TransactionStatus;
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Bayar nanti' },
  { id: 'paid', label: 'Berhasil' },
  { id: 'refunded', label: 'Refund' },
];

export function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isLandscapePhone, width } = useResponsiveLayout();
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
  const showingPending = filter === 'pending';
  const summaryTransactions = filtered.filter((item) => item.status === (showingPending ? 'pending' : 'paid'));
  const total = summaryTransactions.reduce((sum, item) => sum + item.total, 0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setTransactions(await saleService.list(filter === 'pending' ? 'status=pending&limit=1000' : toSalesQuery(range)));
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Transaksi tidak dapat dimuat.';
      setError(message);
      throw refreshError;
    } finally {
      setRefreshing(false);
    }
  }, [filter, range]);

  useFocusEffect(useCallback(() => {
    refresh().catch(() => undefined);
  }, [refresh]));

  const listHeader = (
    <View style={styles.listHeader}>
      <Header eyebrow="Penjualan" subtitle={showingPending ? 'Menampilkan seluruh tagihan yang belum dilunasi' : 'Telusuri pembayaran dan refund berdasarkan tanggal'} title="Transaksi" />
      <View style={[styles.summaryPeriod, isLandscapePhone && styles.summaryPeriodLandscape]}>
        <GlassCard style={isLandscapePhone ? styles.summaryShellLandscape : undefined} contentStyle={[styles.summaryCard, isLandscapePhone && styles.summaryCardLandscape]}>
          <View><Text style={styles.summaryLabel}>{showingPending ? 'Total tagihan belum lunas' : 'Nilai transaksi berhasil'}</Text><Text style={[styles.summaryValue, isLandscapePhone && styles.summaryValueLandscape]}>{formatCurrency(total)}</Text></View>
          <View style={styles.summaryCount}><ReceiptText color={palette.cocoa} size={18} /><Text style={styles.summaryCountText}>{summaryTransactions.length} struk</Text></View>
        </GlassCard>
        <View style={isLandscapePhone ? styles.periodLandscape : undefined}>
          {showingPending
            ? <GlassCard contentStyle={styles.pendingRangeNote}><Text style={styles.pendingRangeTitle}>Seluruh periode</Text><Text style={styles.pendingRangeText}>Tagihan pending tetap tampil sampai dilunasi.</Text></GlassCard>
            : <DateRangePicker onChange={setRange} value={range} />}
        </View>
      </View>
      <View style={[styles.searchFilters, isLandscapePhone && styles.searchFiltersLandscape]}>
        <View style={[styles.searchWrap, isLandscapePhone && styles.searchWrapLandscape]}><SearchField onChangeText={setSearch} placeholder="No. struk atau pelanggan" value={search} /></View>
        <View style={[styles.filterRow, isLandscapePhone && styles.filterRowLandscape]}>{filters.map((item) => <Chip key={item.id} label={item.label} onPress={() => setFilter(item.id)} selected={filter === item.id} />)}</View>
      </View>
      {error ? <View style={styles.errorPanel}><Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text><Button compact icon={RefreshCw} label="Coba lagi" onPress={() => refresh().catch(() => undefined)} variant="secondary" /></View> : null}
      {!isWide ? (
        <View style={styles.sectionHeading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Daftar transaksi</Text>
          <Text style={styles.sectionCount}>{filtered.length} transaksi</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen contentStyle={styles.screen} scroll={false}>
      {isWide ? (
        <>
          {listHeader}
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
        </>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={filtered}
          keyboardDismissMode={process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<EmptyTransactions />}
          renderItem={({ item }) => (
            <ScalePressable accessibilityLabel={`Buka transaksi ${item.receiptNo}`} onPress={() => navigation.navigate('OrderDetail', { transactionId: item.id })}>
              <GlassCard style={styles.transactionCard} contentStyle={styles.transactionInner}>
                <View style={styles.transactionTop}>
                  <View style={styles.transactionIcon}><ReceiptText color={palette.cocoa} size={20} /></View>
                  <View style={styles.transactionCopy}><Text numberOfLines={1} style={styles.receiptNo}>{item.receiptNo}</Text><Text style={styles.transactionDate}>{formatDateTime(item.createdAt)}</Text></View>
                  <StatusPill label={item.status === 'paid' ? 'Berhasil' : item.status === 'pending' ? 'Bayar nanti' : 'Refund'} tone={item.status === 'paid' ? 'success' : item.status === 'pending' ? 'warning' : 'danger'} />
                </View>
                <View style={styles.transactionBottom}>
                  <View style={styles.transactionMeta}><Text style={styles.metaLabel}>{item.itemCount} item · {getPaymentLabel(item.paymentMethod)}</Text><Text numberOfLines={1} style={styles.customer}>{item.customerName ?? 'Pelanggan umum'}</Text></View>
                  <View style={styles.amountSection}>
                    <View style={styles.amountWrap}><Text style={styles.amount}>{formatCurrency(item.total)}</Text><Text style={[styles.profitAmount, item.status !== 'paid' && styles.refundedProfit]}>{item.status === 'pending' ? 'Belum masuk pendapatan' : `Profit ${formatCurrency(item.netProfit)}`}</Text></View>
                    <View style={styles.openIcon}><ArrowUpRight color={palette.muted} size={17} /></View>
                  </View>
                </View>
              </GlassCard>
            </ScalePressable>
          )}
          refreshing={refreshing}
          onRefresh={() => refresh().catch(() => undefined)}
          showsVerticalScrollIndicator={false}
          style={styles.mobileList}
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
      <Text style={[styles.tableText, styles.methodColumn]}>{getPaymentLabel(item.paymentMethod)}</Text>
      <Text style={[styles.tableText, styles.itemColumn]}>{item.itemCount}</Text>
      <View style={styles.totalColumn}><Text style={styles.tableAmount}>{formatCurrency(item.total)}</Text><Text style={[styles.tableProfit, item.status !== 'paid' && styles.refundedProfit]}>{item.status === 'pending' ? 'Belum diakui' : `Profit ${formatCurrency(item.netProfit)}`}</Text></View>
      <View style={styles.stateColumn}><StatusPill label={item.status === 'paid' ? 'Berhasil' : item.status === 'pending' ? 'Bayar nanti' : 'Refund'} tone={item.status === 'paid' ? 'success' : item.status === 'pending' ? 'warning' : 'danger'} /></View>
      <View style={styles.openColumn}><ArrowUpRight color={palette.muted} size={17} /></View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mobileList: { flex: 1, minHeight: 0 },
  listHeader: { width: '100%' },
  summaryPeriod: { width: '100%' },
  summaryPeriodLandscape: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.xs, marginBottom: spacing.xs },
  summaryShellLandscape: { width: 250, minWidth: 250, maxWidth: 250, flexShrink: 0 },
  periodLandscape: { flex: 1, minWidth: 0 },
  pendingRangeNote: { minHeight: 60, paddingHorizontal: spacing.md, justifyContent: 'center' },
  pendingRangeTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 11 },
  pendingRangeText: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 2 },
  summaryCard: { marginBottom: spacing.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryCardLandscape: { minHeight: 52, marginBottom: 0, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  summaryLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  summaryValue: { color: palette.ink, fontFamily: type.bold, fontSize: 20, marginTop: 3 },
  summaryValueLandscape: { fontSize: 16 },
  summaryCount: { minHeight: 36, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: palette.roseSoft },
  summaryCountText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 11 },
  searchFilters: { width: '100%' },
  searchFiltersLandscape: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  searchWrap: { minWidth: 0 },
  searchWrapLandscape: { flex: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.md },
  filterRowLandscape: { flexWrap: 'nowrap', paddingVertical: 0 },
  errorPanel: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: palette.dangerSoft },
  errorText: { flex: 1, color: palette.danger, fontFamily: type.medium, fontSize: 11, lineHeight: 17 },
  sectionHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { flex: 1, color: palette.ink, fontFamily: type.bold, fontSize: 16, lineHeight: 22 },
  sectionCount: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  list: { gap: spacing.sm, paddingBottom: 120 },
  transactionCard: { width: '100%' },
  transactionInner: { padding: spacing.md },
  transactionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  transactionIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  transactionCopy: { flex: 1, minWidth: 0 },
  receiptNo: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  transactionDate: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  transactionBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.line },
  transactionMeta: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  metaLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  customer: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 12, marginTop: 3 },
  amountSection: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amountWrap: { alignItems: 'flex-end', gap: 3 },
  amount: { color: palette.cocoa, fontFamily: type.bold, fontSize: 15 },
  profitAmount: { color: palette.success, fontFamily: type.semibold, fontSize: 9 },
  refundedProfit: { color: palette.muted },
  openIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: 'rgba(107,63,42,0.06)' },
  empty: { minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15, marginTop: spacing.md },
  emptyText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17, marginTop: spacing.xs, textAlign: 'center' },
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
