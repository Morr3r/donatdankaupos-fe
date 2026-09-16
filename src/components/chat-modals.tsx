import { Check, Forward, ReceiptText, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { saleService } from '../api/services';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { ChatConversation, ChatMessage, Transaction } from '../types/domain';
import { formatCurrency, formatDateTime } from '../utils/format';
import { Button, FormModal, ScalePressable } from './ui';

interface TransactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (transaction: Transaction) => void;
}

const transactionStatusLabel = (status: Transaction['status']): string => {
  if (status === 'pending') return 'Bayar nanti';
  if (status === 'refunded') return 'Refund';
  return 'Lunas';
};

export function TransactionPicker({ visible, onClose, onSelect }: TransactionPickerProps) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    void saleService
      .list('limit=200')
      .then(setItems)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Transaksi belum dapat dimuat.'),
      )
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.receiptNo, item.customerName, item.cashierName].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [items, query]);

  return (
    <FormModal
      onClose={onClose}
      subtitle="Pilih transaksi lunas, bayar nanti, atau refund untuk dibagikan sebagai kartu."
      title="Bagikan transaksi"
      visible={visible}
    >
      <View style={styles.searchField}>
        <Search color={palette.muted} size={18} />
        <TextInput
          accessibilityLabel="Cari transaksi"
          onChangeText={setQuery}
          placeholder="Cari nomor struk atau pelanggan"
          placeholderTextColor={palette.muted}
          style={styles.searchInput}
          value={query}
        />
      </View>
      {loading ? <ActivityIndicator color={palette.cocoa} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && !filtered.length ? (
        <Text style={styles.empty}>Belum ada transaksi yang cocok.</Text>
      ) : null}
      <View style={styles.list}>
        {filtered.map((transaction) => (
          <ScalePressable
            accessibilityLabel={`Bagikan transaksi ${transaction.receiptNo}, ${formatCurrency(transaction.total)}, ${transactionStatusLabel(transaction.status)}`}
            key={transaction.id}
            onPress={() => onSelect(transaction)}
            style={styles.row}
          >
            <View style={styles.rowIcon}>
              <ReceiptText color={palette.cocoa} size={20} />
            </View>
            <View style={styles.rowCopy}>
              <Text numberOfLines={1} style={styles.rowTitle}>{transaction.receiptNo}</Text>
              <Text numberOfLines={1} style={styles.rowMeta}>
                {transaction.customerName || transaction.cashierName} · {formatDateTime(transaction.createdAt)}
              </Text>
            </View>
            <View style={styles.amountCopy}>
              <Text style={styles.amount}>{formatCurrency(transaction.total)}</Text>
              <Text
                style={[
                  styles.status,
                  transaction.status === 'pending' && styles.statusPending,
                  transaction.status === 'refunded' && styles.statusRefunded,
                ]}
              >
                {transactionStatusLabel(transaction.status)}
              </Text>
            </View>
          </ScalePressable>
        ))}
      </View>
    </FormModal>
  );
}

interface ForwardPickerProps {
  message: ChatMessage | null;
  conversations: ChatConversation[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (conversationIds: string[]) => void;
}

export function ForwardPicker({ message, conversations, loading, onClose, onSubmit }: ForwardPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!message) return;
    setSelected([]);
    setQuery('');
  }, [message]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((item) => !term || item.title.toLowerCase().includes(term));
  }, [conversations, query]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <FormModal
      footer={
        <Button
          disabled={!selected.length}
          icon={Forward}
          label={selected.length ? `Teruskan ke ${selected.length} obrolan` : 'Pilih obrolan'}
          loading={loading}
          onPress={() => onSubmit(selected)}
        />
      }
      onClose={onClose}
      subtitle="Pesan dapat diteruskan ke satu atau beberapa obrolan sekaligus."
      title="Teruskan pesan"
      visible={Boolean(message)}
    >
      <View style={styles.searchField}>
        <Search color={palette.muted} size={18} />
        <TextInput
          accessibilityLabel="Cari tujuan forward"
          onChangeText={setQuery}
          placeholder="Cari obrolan"
          placeholderTextColor={palette.muted}
          style={styles.searchInput}
          value={query}
        />
      </View>
      <View style={styles.list}>
        {filtered.map((conversation) => {
          const checked = selected.includes(conversation.id);
          return (
            <ScalePressable
              accessibilityLabel={`${checked ? 'Batalkan pilihan' : 'Pilih'} ${conversation.title}`}
              accessibilityState={{ selected: checked }}
              key={conversation.id}
              onPress={() => toggle(conversation.id)}
              style={[styles.row, checked && styles.rowSelected]}
            >
              <View style={[styles.check, checked && styles.checkSelected]}>
                {checked ? <Check color={palette.white} size={16} strokeWidth={2.8} /> : null}
              </View>
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.rowTitle}>{conversation.title}</Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {conversation.isArchived ? 'Diarsipkan' : conversation.subtitle}
                </Text>
              </View>
            </ScalePressable>
          );
        })}
      </View>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  searchField: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, color: palette.ink, fontFamily: type.regular, fontSize: 14 },
  loader: { paddingVertical: spacing.lg },
  error: { color: palette.danger, fontFamily: type.medium, fontSize: 13, paddingVertical: spacing.md },
  empty: { color: palette.muted, fontFamily: type.regular, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg },
  list: { gap: spacing.xxs },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  rowSelected: { backgroundColor: palette.roseSoft },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.champagneSoft,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 13.5 },
  rowMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 11.5 },
  amountCopy: { alignItems: 'flex-end', gap: 2 },
  amount: { color: palette.cocoa, fontFamily: type.bold, fontSize: 12.5 },
  status: { color: palette.success, fontFamily: type.semibold, fontSize: 10.5 },
  statusPending: { color: palette.cocoa },
  statusRefunded: { color: palette.danger },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
  },
  checkSelected: { backgroundColor: palette.cocoa, borderColor: palette.cocoa },
});
