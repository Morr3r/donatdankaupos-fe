import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Edit3, ImageOff, Plus, Search, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, type ImageStyle, Platform, ScrollView, type StyleProp, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { catalogService } from '../api/services';
import { Button, Chip, GlassCard, Header, IconButton, Screen, SearchField, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useCatalogStore } from '../store/catalogStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { Product } from '../types/domain';
import { formatCurrency } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Products'>;

export function ProductManagementScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const products = useCatalogStore((state) => state.products);
  const isLoading = useCatalogStore((state) => state.isLoading);
  const loadError = useCatalogStore((state) => state.error);
  const load = useCatalogStore((state) => state.load);
  const removeProduct = useCatalogStore((state) => state.removeProduct);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua');
  const categories = useMemo(() => ['Semua', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => (
      (category === 'Semua' || product.category === category)
      && (!term || product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term))
    ));
  }, [category, products, query]);

  const deleteProduct = async (id: string) => {
    try {
      await catalogService.remove(id);
      removeProduct(id);
    } catch (error) {
      Alert.alert('Produk belum terhapus', error instanceof Error ? error.message : 'Silakan coba lagi.');
    }
  };

  const confirmDelete = (id: string, name: string) => {
    const message = `${name} tidak akan tampil lagi di menu kasir. Riwayat transaksi lama tetap aman.`;
    if (Platform.OS === 'web') {
      const confirm = (globalThis as typeof globalThis & { confirm?: (prompt: string) => boolean }).confirm;
      if (confirm?.(`Hapus produk?\n\n${message}`)) void deleteProduct(id);
      return;
    }
    Alert.alert('Hapus produk?', message, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => { void deleteProduct(id); },
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.screen} scroll={false}>
      <Header onBack={navigation.goBack} subtitle="Atur menu, harga, foto, varian, dan topping" title="Kelola produk" />
      <View style={[styles.toolbar, isWide && styles.toolbarWide]}>
        <View style={styles.search}><SearchField onChangeText={setQuery} placeholder="Cari nama atau SKU" value={query} /></View>
        <Button compact icon={Plus} label="Tambah produk" onPress={() => navigation.navigate('ProductEditor')} style={styles.addButton} />
      </View>
      <ScrollView contentContainerStyle={styles.categories} horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {categories.map((item) => <Chip key={item} label={item} onPress={() => setCategory(item)} selected={category === item} />)}
      </ScrollView>
      <View style={styles.resultBar}>
        <Text style={styles.resultText}>{filtered.length} dari {products.length} produk</Text>
        {loadError ? <Text accessibilityLiveRegion="polite" style={styles.loadError}>{loadError}</Text> : null}
      </View>
      {isWide ? (
        <GlassCard style={styles.tableCard} contentStyle={styles.tableSurface}>
          <ProductTableHeader />
          <FlatList
            contentContainerStyle={styles.tableList}
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            ListEmptyComponent={<EmptyProducts />}
            onRefresh={load}
            refreshing={isLoading}
            renderItem={({ item }) => (
              <ProductTableRow
                item={item}
                onDelete={() => confirmDelete(item.id, item.name)}
                onEdit={() => navigation.navigate('ProductEditor', { productId: item.id })}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        </GlassCard>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={<EmptyProducts />}
          onRefresh={load}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <ProductMobileCard
              item={item}
              onDelete={() => confirmDelete(item.id, item.name)}
              onEdit={() => navigation.navigate('ProductEditor', { productId: item.id })}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

function ProductImage({ item, style }: { item: Product; style: StyleProp<ImageStyle> }) {
  return item.imageUrl
    ? <Image accessibilityIgnoresInvertColors source={{ uri: item.imageUrl }} style={style} />
    : <View style={[style, styles.imageFallback]}><ImageOff color={palette.muted} size={22} /></View>;
}

function ProductBadges({ item }: { item: Product }) {
  return (
    <View style={styles.badges}>
      {item.minimumOrderQuantity > 1 ? <StatusPill label={`Min. ${item.minimumOrderQuantity} unit`} tone="warning" /> : null}
      {item.variants?.length ? <StatusPill label={`${item.variants.length} pilihan`} tone="info" /> : null}
      {item.toppings?.length ? <StatusPill label={`${item.toppings.length} topping`} tone="warning" /> : null}
      {!item.minimumOrderQuantity || item.minimumOrderQuantity === 1 ? <StatusPill label="Aktif" /> : null}
    </View>
  );
}

function ProductMobileCard({ item, onEdit, onDelete }: { item: Product; onEdit: () => void; onDelete: () => void }) {
  return (
    <GlassCard style={styles.card} contentStyle={styles.mobileCard}>
      <View style={styles.mobileTop}>
        <ProductImage item={item} style={styles.image} />
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{item.sku} · {item.category}</Text>
          <Text style={styles.packaging}>{item.sourcePackaging || 'Kemasan belum diisi'}</Text>
          <Text style={styles.price}>{formatCurrency(item.price)}</Text>
        </View>
      </View>
      <ProductBadges item={item} />
      <View style={styles.mobileActions}>
        <Button compact icon={Edit3} label="Edit" onPress={onEdit} style={styles.mobileAction} variant="secondary" />
        <Button compact icon={Trash2} label="Hapus" onPress={onDelete} style={styles.mobileAction} variant="danger" />
      </View>
    </GlassCard>
  );
}

function ProductTableHeader() {
  return (
    <View style={[styles.tableRow, styles.tableHeader]}>
      <Text style={[styles.tableHeaderText, styles.productColumn]}>Produk</Text>
      <Text style={[styles.tableHeaderText, styles.categoryColumn]}>Kategori</Text>
      <Text style={[styles.tableHeaderText, styles.packagingColumn]}>Kemasan</Text>
      <Text style={[styles.tableHeaderText, styles.priceColumn]}>Harga</Text>
      <Text style={[styles.tableHeaderText, styles.statusColumn]}>Status</Text>
      <Text style={[styles.tableHeaderText, styles.actionColumn]}>Aksi</Text>
    </View>
  );
}

function ProductTableRow({ item, onEdit, onDelete }: { item: Product; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.tableRow}>
      <View style={[styles.productColumn, styles.tableProduct]}>
        <ProductImage item={item} style={styles.tableImage} />
        <View style={styles.tableProductCopy}><Text numberOfLines={2} style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.sku}</Text></View>
      </View>
      <Text numberOfLines={2} style={[styles.tableCellText, styles.categoryColumn]}>{item.category}</Text>
      <Text numberOfLines={2} style={[styles.tableCellText, styles.packagingColumn]}>{item.sourcePackaging || '—'}</Text>
      <Text style={[styles.tablePrice, styles.priceColumn]}>{formatCurrency(item.price)}</Text>
      <View style={styles.statusColumn}><StatusPill label={item.minimumOrderQuantity > 1 ? `Min. ${item.minimumOrderQuantity}` : 'Aktif'} tone={item.minimumOrderQuantity > 1 ? 'warning' : 'success'} /></View>
      <View style={[styles.actionColumn, styles.tableActions]}><IconButton icon={Edit3} label={`Edit ${item.name}`} onPress={onEdit} /><IconButton icon={Trash2} label={`Hapus ${item.name}`} onPress={onDelete} tone="danger" /></View>
    </View>
  );
}

function EmptyProducts() {
  return <View style={styles.empty}><Search color={palette.rose} size={31} /><Text style={styles.emptyTitle}>Produk tidak ditemukan</Text><Text style={styles.emptyText}>Coba kategori atau kata kunci lain.</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minWidth: 0, gap: spacing.md },
  toolbar: { gap: spacing.sm },
  toolbarWide: { flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1 },
  addButton: { minWidth: 190 },
  categoryScroll: {
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    minHeight: 50,
    maxHeight: 52,
  },
  categories: { gap: spacing.xs, paddingRight: spacing.md },
  resultBar: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  resultText: { color: palette.muted, fontFamily: type.semibold, fontSize: 11 },
  loadError: { flex: 1, color: palette.danger, fontFamily: type.medium, fontSize: 10, textAlign: 'right' },
  list: { paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  mobileCard: { padding: spacing.md, gap: spacing.md },
  mobileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  image: { width: 82, height: 82, borderRadius: radius.md, resizeMode: 'cover' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  copy: { flex: 1, minWidth: 0 },
  name: { color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  meta: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  packaging: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 10, marginTop: 4 },
  price: { color: palette.cocoa, fontFamily: type.bold, fontSize: 13, marginTop: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  mobileActions: { flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.line },
  mobileAction: { flex: 1 },
  tableCard: { flex: 1, minHeight: 360 },
  tableSurface: { flex: 1 },
  tableList: { flexGrow: 1 },
  tableRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.line },
  tableHeader: { minHeight: 52, backgroundColor: 'rgba(107,63,42,0.05)' },
  tableHeaderText: { color: palette.muted, fontFamily: type.bold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableCellText: { color: palette.inkSoft, fontFamily: type.medium, fontSize: 11, lineHeight: 16 },
  productColumn: { flex: 2.2, minWidth: 220 },
  categoryColumn: { flex: 1.15, minWidth: 120 },
  packagingColumn: { flex: 0.8, minWidth: 90 },
  priceColumn: { width: 112 },
  statusColumn: { width: 100 },
  actionColumn: { width: 108 },
  tableProduct: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tableProductCopy: { flex: 1, minWidth: 0 },
  tableImage: { width: 54, height: 54, borderRadius: radius.sm, resizeMode: 'cover' },
  tablePrice: { color: palette.cocoa, fontFamily: type.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  tableActions: { flexDirection: 'row', gap: spacing.xs },
  empty: { minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15, marginTop: spacing.md },
  emptyText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, marginTop: spacing.xs, textAlign: 'center' },
});
