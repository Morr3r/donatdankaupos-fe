import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShoppingBag, Sparkles, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartFloatingBar, CartRow, PricingModeSelector, ProductCard } from '../components/pos';
import { ProductSelectionModal, type ProductSelectionValue } from '../components/product-selection-modal';
import { TERMINAL_ID } from '../api/client';
import { Button, Chip, Divider, GlassCard, Header, IconButton, Screen, SearchField } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useCatalogStore } from '../store/catalogStore';
import { usePOSStore } from '../store/posStore';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { PricingMode, Product, ProductCategory } from '../types/domain';
import { formatCurrency, getCartTotals } from '../utils/format';

export function POSScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 880;
  const isPhone = width < 600;
  const numColumns = isTablet ? 3 : isPhone ? 1 : 2;
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const products = useCatalogStore((state) => state.products);
  const catalogCategories = useCatalogStore((state) => state.categories);
  const isLoading = useCatalogStore((state) => state.isLoading);
  const loadCatalog = useCatalogStore((state) => state.load);
  const user = useSessionStore((state) => state.user);
  const cart = usePOSStore((state) => state.cart);
  const search = usePOSStore((state) => state.search);
  const category = usePOSStore((state) => state.category);
  const pricingMode = usePOSStore((state) => state.pricingMode);
  const setSearch = usePOSStore((state) => state.setSearch);
  const setCategory = usePOSStore((state) => state.setCategory);
  const setPricingMode = usePOSStore((state) => state.setPricingMode);
  const addProduct = usePOSStore((state) => state.addProduct);
  const changeQuantity = usePOSStore((state) => state.changeQuantity);
  const removeLine = usePOSStore((state) => state.removeLine);
  const clearCart = usePOSStore((state) => state.clearCart);
  const totals = useMemo(() => getCartTotals(
    cart,
    0,
    'takeaway',
    user?.dineInServiceRateBps ?? 0,
  ), [cart, user?.dineInServiceRateBps]);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const productQuantities = useMemo(() => cart.reduce<Record<string, number>>((counts, item) => {
    counts[item.productId] = (counts[item.productId] ?? 0) + item.quantity;
    return counts;
  }, {}), [cart]);
  const resellerProductCount = useMemo(() => products.filter((product) => product.resellerPrice != null).length, [products]);
  const modeProducts = useMemo(
    () => pricingMode === 'reseller'
      ? products.filter((product) => product.resellerPrice != null)
      : products.filter((product) => !product.isResellerOnly),
    [pricingMode, products],
  );
  const categories: ProductCategory[] = useMemo(() => {
    const availableCategories = new Set(modeProducts.map((product) => product.category));
    return ['Semua', ...catalogCategories.filter((item) => availableCategories.has(item))];
  }, [catalogCategories, modeProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return modeProducts.filter((product) => {
      const inCategory = category === 'Semua' || product.category === category;
      const matchesQuery = !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
      return inCategory && matchesQuery;
    });
  }, [category, modeProducts, search]);

  useFocusEffect(useCallback(() => {
    void loadCatalog().catch(() => undefined);
  }, [loadCatalog]));

  const handleAdd = useCallback(async (product: Product) => {
    setSelectedProduct(product);
    await Haptics.selectionAsync();
  }, []);

  const confirmAdd = useCallback(async (product: Product, selection: ProductSelectionValue) => {
    addProduct(product, selection);
    setLastAdded(product.name);
    await Haptics.selectionAsync();
    setTimeout(() => setLastAdded(null), 1300);
  }, [addProduct]);

  const applyPricingMode = useCallback((nextMode: PricingMode) => {
    if (nextMode === pricingMode) return;
    if (cart.length) clearCart();
    setPricingMode(nextMode);
    setCategory('Semua');
    setSelectedProduct(null);
    setLastAdded(null);
    Haptics.selectionAsync().catch(() => undefined);
  }, [cart.length, clearCart, pricingMode, setCategory, setPricingMode]);

  const confirmPricingMode = useCallback((nextMode: PricingMode) => {
    if (nextMode === pricingMode) return;
    if (!cart.length) {
      applyPricingMode(nextMode);
      return;
    }
    const nextLabel = nextMode === 'reseller' ? 'reseller' : 'pelanggan';
    const message = `${itemCount} item di keranjang akan dikosongkan agar harga tidak tercampur.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Ganti ke harga ${nextLabel}?\n\n${message}`)) applyPricingMode(nextMode);
      return;
    }
    Alert.alert(`Ganti ke harga ${nextLabel}?`, message, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ganti harga', style: 'destructive', onPress: () => applyPricingMode(nextMode) },
    ]);
  }, [applyPricingMode, cart.length, itemCount, pricingMode]);

  const performClearCart = useCallback(() => {
    clearCart();
    setLastAdded(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [clearCart]);

  const confirmClearCart = useCallback(() => {
    const message = `${itemCount} item akan dihapus dari keranjang.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Kosongkan keranjang?\n\n${message}`)) performClearCart();
      return;
    }
    Alert.alert('Kosongkan keranjang?', message, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Kosongkan', style: 'destructive', onPress: performClearCart },
    ]);
  }, [itemCount, performClearCart]);

  const catalogHeader = (
    <View>
      <PricingModeSelector onChange={confirmPricingMode} resellerCount={resellerProductCount} value={pricingMode} />
      <View style={styles.toolsRow}>
        <View style={styles.searchWrap}><SearchField onChangeText={setSearch} value={search} /></View>
      </View>
      <ScrollView contentContainerStyle={styles.categories} horizontal showsHorizontalScrollIndicator={false}>
        {categories.map((item) => <Chip key={item} label={item} onPress={() => setCategory(item)} selected={category === item} />)}
      </ScrollView>
      <View style={styles.listHeading}>
        <Text style={styles.resultText}>{filteredProducts.length} produk · harga {pricingMode === 'reseller' ? 'reseller' : 'pelanggan'}</Text>
        {lastAdded ? <View style={styles.addedPill}><Sparkles color={palette.success} size={14} /><Text style={styles.addedText}>{lastAdded} ditambahkan</Text></View> : null}
      </View>
    </View>
  );

  const productList = (
    <FlatList
      key={`grid-${numColumns}`}
      columnWrapperStyle={numColumns > 1 ? styles.productRow : undefined}
      contentContainerStyle={[styles.productList, { paddingBottom: isTablet ? spacing.lg : 190 + insets.bottom }]}
      data={filteredProducts}
      initialNumToRender={8}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<EmptyCatalog search={search} />}
      ListHeaderComponent={catalogHeader}
      numColumns={numColumns}
      renderItem={({ item }) => <ProductCard cartQuantity={productQuantities[item.id] ?? 0} horizontal={isPhone} onPress={handleAdd} pricingMode={pricingMode} product={item} style={[styles.productCell, isPhone ? styles.productCellPhone : { maxWidth: `${100 / numColumns - 2}%` }]} />}
      refreshing={isLoading}
      onRefresh={loadCatalog}
      showsVerticalScrollIndicator={false}
      windowSize={7}
    />
  );

  return (
    <Screen bottomInset={0} contentStyle={styles.screen} scroll={false}>
      <Header eyebrow={`Terminal ${TERMINAL_ID || '-'}`} subtitle="Pilih produk, opsi, lalu jumlahnya" title="Kasir" />
      {isTablet ? (
        <View style={[styles.tabletLayout, { paddingBottom: 102 + insets.bottom }]}>
          <View style={styles.catalogPane}>{productList}</View>
          <CartPanel cart={cart} itemCount={itemCount} onChange={changeQuantity} onCheckout={() => navigation.navigate('Checkout')} onClear={confirmClearCart} onRemove={removeLine} pricingMode={pricingMode} total={totals.total} />
        </View>
      ) : (
        <>
          <View style={styles.mobileList}>{productList}</View>
          {itemCount > 0 ? (
            <View style={[styles.floatingWrap, { bottom: 94 + insets.bottom }]}><CartFloatingBar compact={width < 360} count={itemCount} onClear={confirmClearCart} onPress={() => navigation.navigate('Checkout')} pricingMode={pricingMode} total={totals.total} /></View>
          ) : null}
        </>
      )}
      <ProductSelectionModal onAdd={confirmAdd} onClose={() => setSelectedProduct(null)} pricingMode={pricingMode} product={selectedProduct} />
    </Screen>
  );
}

function CartPanel({ cart, itemCount, total, pricingMode, onChange, onRemove, onClear, onCheckout }: {
  cart: ReturnType<typeof usePOSStore.getState>['cart'];
  itemCount: number;
  total: number;
  pricingMode: PricingMode;
  onChange: (lineId: string, delta: number) => void;
  onRemove: (lineId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}) {
  return (
    <GlassCard style={styles.cartPanel} contentStyle={styles.cartPanelInner}>
      <View style={styles.cartPanelHeader}>
        <View><Text style={styles.cartPanelTitle}>Keranjang</Text><Text style={styles.cartPanelMeta}>{itemCount} item · Harga {pricingMode === 'reseller' ? 'reseller' : 'pelanggan'}</Text></View>
        {cart.length ? <IconButton icon={Trash2} label="Kosongkan keranjang" onPress={onClear} tone="danger" /> : null}
      </View>
      <Divider />
      <ScrollView contentContainerStyle={styles.cartRows} showsVerticalScrollIndicator={false}>
        {cart.length ? cart.map((item) => <CartRow key={item.lineId} item={item} onChange={onChange} onRemove={onRemove} />) : (
          <View style={styles.emptyCart}><View style={styles.emptyCartIcon}><ShoppingBag color={palette.rose} size={28} /></View><Text style={styles.emptyCartTitle}>Keranjang masih kosong</Text><Text style={styles.emptyCartText}>Pilih produk dari katalog untuk memulai transaksi.</Text></View>
        )}
      </ScrollView>
      <Divider />
      <View style={styles.cartTotalRow}><Text style={styles.cartTotalLabel}>Estimasi total</Text><Text style={styles.cartTotal}>{formatCurrency(total)}</Text></View>
      <Button disabled={!cart.length} icon={ShoppingBag} label="Lanjut checkout" onPress={onCheckout} />
    </GlassCard>
  );
}

function EmptyCatalog({ search }: { search: string }) {
  return (
    <View style={styles.emptyCatalog}>
      <View style={styles.emptyCartIcon}><ShoppingBag color={palette.rose} size={28} /></View>
      <Text style={styles.emptyCartTitle}>Produk tidak ditemukan</Text>
      <Text style={styles.emptyCartText}>{search ? `Tidak ada hasil untuk “${search}”. Coba kata kunci lain.` : 'Belum ada produk pada kategori ini.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 0 },
  toolsRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  searchWrap: { flex: 1 },
  categories: { gap: spacing.xs, paddingVertical: spacing.md },
  listHeading: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  resultText: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  addedPill: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: palette.successSoft },
  addedText: { color: palette.success, fontFamily: type.bold, fontSize: 10 },
  mobileList: { flex: 1 },
  tabletLayout: { flex: 1, flexDirection: 'row', gap: spacing.md },
  catalogPane: { flex: 1.7 },
  productList: { flexGrow: 1 },
  productRow: { gap: spacing.sm, marginBottom: spacing.sm },
  productCell: { flex: 1, minWidth: 0 },
  productCellPhone: { marginBottom: spacing.sm },
  floatingWrap: { position: 'absolute', left: 0, right: 0 },
  cartPanel: { flex: 1, maxWidth: 420 },
  cartPanelInner: { flex: 1, padding: spacing.md },
  cartPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md },
  cartPanelTitle: { color: palette.ink, fontFamily: type.display, fontSize: 24 },
  cartPanelMeta: { color: palette.muted, fontFamily: type.medium, fontSize: 11, marginTop: 2 },
  cartRows: { flexGrow: 1 },
  emptyCart: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyCartIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  emptyCartTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 15, textAlign: 'center', marginTop: spacing.md },
  emptyCartText: { maxWidth: 280, color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: spacing.xs },
  cartTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  cartTotalLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 12 },
  cartTotal: { color: palette.ink, fontFamily: type.bold, fontSize: 18 },
  emptyCatalog: { minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
});
