import { BlurView } from 'expo-blur';
import {
  Check,
  ChevronDown,
  Grid2X2,
  Grid3X3,
  Handshake,
  LayoutGrid,
  LayoutList,
  List,
  ListTree,
  Minus,
  PanelsTopLeft,
  Plus,
  Rows3,
  ShoppingBag,
  Trash2,
  UserRound,
  type LucideProps,
} from 'lucide-react-native';
import { memo, useState, type ComponentType } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CatalogViewMode, CartItem, PricingMode, Product } from '../types/domain';
import { palette, radius, shadow, spacing, type } from '../theme/tokens';
import { selectedOptionSummary } from '../utils/cartOptions';
import { formatCurrency, formatPackagingLabel, getProductPrice, isProductAvailable, resolvePiecesPerUnit } from '../utils/format';
import { useResponsiveLayout } from '../utils/responsive';
import { GlassCard, ScalePressable, StatusPill } from './ui';

interface ProductCardProps {
  product: Product;
  cartQuantity?: number;
  onPress: (product: Product) => void;
  style?: StyleProp<ViewStyle>;
  viewMode?: CatalogViewMode;
  compactDetails?: boolean;
  pricingMode?: PricingMode;
}

export const ProductCard = memo(function ProductCard({
  product,
  cartQuantity = 0,
  onPress,
  style,
  viewMode = 'details',
  compactDetails = false,
  pricingMode = 'customer',
}: ProductCardProps) {
  const minimumQuantity = Math.max(product.minimumOrderQuantity ?? 1, 1);
  const piecesPerUnit = resolvePiecesPerUnit(product.piecesPerUnit, product.name, product.sourcePackaging);
  const packagingLabel = formatPackagingLabel(product.sourcePackaging, piecesPerUnit);
  const soldOut = !isProductAvailable(product);
  const stockLabel = product.trackInventory ? `stok ${product.inventoryItemName ?? 'donat'} ${product.stock ?? 0} pcs` : 'tersedia';
  const cartLabel = cartQuantity > 0 ? `, ${cartQuantity} item di keranjang` : '';
  const activePrice = getProductPrice(product, pricingMode);
  const isReseller = pricingMode === 'reseller';
  const stockStatusLabel = product.trackInventory
    ? (product.stock ?? 0) <= product.lowStockThreshold ? `Sisa ${product.stock ?? 0} pcs` : `Stok ${product.stock ?? 0} pcs`
    : minimumQuantity > 1 ? `Min. ${minimumQuantity} unit` : piecesPerUnit > 1 ? `${piecesPerUnit} pcs / paket` : 'Tersedia';
  const stockTone = product.trackInventory && (product.stock ?? 0) <= product.lowStockThreshold ? 'warning' : minimumQuantity > 1 ? 'info' : 'success';
  const accessibilityLabel = `${product.name}, harga ${isReseller ? 'reseller' : 'pelanggan'} ${formatCurrency(activePrice)}, ${stockLabel}${cartLabel}`;

  if (viewMode === 'details') {
    return (
      <ScalePressable
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={soldOut ? 'Produk sedang habis' : 'Tambahkan ke keranjang'}
        containerStyle={style}
        disabled={soldOut}
        onPress={() => onPress(product)}
        style={styles.productCardDetails}
      >
        <ProductArtwork cartQuantity={cartQuantity} compactDetails={compactDetails} mode="details" product={product} />
        <View style={styles.detailsIdentity}>
          <Text numberOfLines={2} style={styles.detailsName}>{product.name}</Text>
          <Text numberOfLines={1} style={styles.detailsSku}>{product.sku}</Text>
        </View>
        <View style={[styles.detailsPriceColumn, compactDetails && styles.detailsPriceColumnCompact]}>
          <Text numberOfLines={1} style={styles.detailsPrice}>{formatCurrency(activePrice)}</Text>
          {isReseller && product.price !== activePrice ? <Text numberOfLines={1} style={styles.detailsOriginalPrice}>{formatCurrency(product.price)}</Text> : null}
        </View>
        <Text numberOfLines={2} style={[styles.detailsStock, compactDetails && styles.detailsStockCompact]}>{product.trackInventory ? `${product.stock ?? 0} pcs` : 'Tersedia'}</Text>
        {!compactDetails ? <Text numberOfLines={2} style={styles.detailsCategory}>{product.category}</Text> : null}
      </ScalePressable>
    );
  }

  if (viewMode === 'list') {
    return (
      <ScalePressable
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={soldOut ? 'Produk sedang habis' : 'Tambahkan ke keranjang'}
        containerStyle={style}
        disabled={soldOut}
        onPress={() => onPress(product)}
        style={styles.productCardList}
      >
        <ProductArtwork cartQuantity={cartQuantity} mode="list" product={product} />
        <View style={styles.listIdentity}>
          <Text numberOfLines={1} style={styles.listName}>{product.name}</Text>
          <Text numberOfLines={1} style={styles.listMeta}>{product.sku} · {product.category}</Text>
        </View>
        <Text numberOfLines={1} style={styles.listPrice}>{formatCurrency(activePrice)}</Text>
      </ScalePressable>
    );
  }

  const horizontal = viewMode === 'tiles' || viewMode === 'content';
  const showDescription = viewMode === 'extra-large-icons'
    || viewMode === 'large-icons'
    || viewMode === 'medium-icons'
    || viewMode === 'content';
  const showStatus = viewMode !== 'small-icons';

  return (
    <ScalePressable
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={soldOut ? 'Produk sedang habis' : 'Tambahkan ke keranjang'}
      containerStyle={style}
      disabled={soldOut}
      onPress={() => onPress(product)}
      style={[
        styles.productCard,
        horizontal && styles.productCardHorizontal,
        viewMode === 'tiles' && styles.productCardTiles,
        viewMode === 'content' && styles.productCardContent,
        viewMode === 'small-icons' && styles.productCardSmallIcons,
      ]}
    >
      <ProductArtwork cartQuantity={cartQuantity} mode={viewMode} product={product} />
      <View style={[styles.productCopy, horizontal && styles.productCopyHorizontal, viewMode === 'small-icons' && styles.productCopySmallIcons]}>
        <Text numberOfLines={2} style={[styles.productName, viewMode === 'small-icons' && styles.productNameSmallIcons]}>{product.name}</Text>
        {packagingLabel ? <Text style={styles.productPackaging}>{packagingLabel}</Text> : null}
        {horizontal ? <Text numberOfLines={1} style={styles.productMeta}>{product.sku} · {product.category}</Text> : null}
        {showDescription ? <Text numberOfLines={viewMode === 'content' ? 3 : 2} style={styles.productDescription}>{product.description}</Text> : null}
        <View style={[styles.productFooter, horizontal && styles.productFooterHorizontal]}>
          <View style={styles.productPriceGroup}>
            {viewMode !== 'small-icons' ? <Text style={styles.productPriceLabel}>Harga {isReseller ? 'reseller' : 'pelanggan'}</Text> : null}
            <View style={styles.productPriceLine}>
              <Text numberOfLines={1} style={[styles.productPrice, viewMode === 'small-icons' && styles.productPriceSmallIcons]}>{formatCurrency(activePrice)}</Text>
              {isReseller && product.price !== activePrice ? <Text style={styles.productOriginalPrice}>{formatCurrency(product.price)}</Text> : null}
            </View>
          </View>
          {showStatus ? <StatusPill label={stockStatusLabel} tone={stockTone} /> : null}
        </View>
      </View>
    </ScalePressable>
  );
});

function ProductArtwork({ product, cartQuantity, mode, compactDetails = false }: { product: Product; cartQuantity: number; mode: CatalogViewMode; compactDetails?: boolean }) {
  const compact = mode === 'small-icons' || mode === 'list' || mode === 'details';
  const extraLarge = mode === 'extra-large-icons';
  return (
    <View style={[
      styles.productVisual,
      mode === 'extra-large-icons' && styles.productVisualExtraLarge,
      mode === 'large-icons' && styles.productVisualLarge,
      mode === 'small-icons' && styles.productVisualSmall,
      mode === 'list' && styles.productVisualList,
      mode === 'details' && styles.productVisualDetails,
      mode === 'details' && compactDetails && styles.productVisualDetailsCompact,
      mode === 'tiles' && styles.productVisualTiles,
      mode === 'content' && styles.productVisualContent,
      { backgroundColor: product.color },
    ]}>
      {product.imageUrl ? <Image accessibilityIgnoresInvertColors accessible={false} source={{ uri: product.imageUrl }} style={styles.productImage} /> : (
        <View style={[styles.donut, compact && styles.donutCompact, extraLarge && styles.donutExtraLarge, { backgroundColor: product.accent }]}>
          <View style={[styles.donutGlaze, compact && styles.donutGlazeCompact, extraLarge && styles.donutGlazeExtraLarge]} />
          <View style={[styles.donutHole, compact && styles.donutHoleCompact, extraLarge && styles.donutHoleExtraLarge, { backgroundColor: product.color }]} />
        </View>
      )}
      {cartQuantity > 0 ? <View style={[styles.cartQuantityBadge, compact && styles.cartQuantityBadgeCompact]}><Text style={styles.cartQuantityText}>{cartQuantity}</Text></View> : null}
      {product.isFavorite && !compact ? <View style={styles.favoriteBadge}><Text style={styles.favoriteText}>BEST</Text></View> : null}
    </View>
  );
}

type CatalogViewOption = {
  id: CatalogViewMode;
  label: string;
  icon: ComponentType<LucideProps>;
};

const catalogViewOptions: CatalogViewOption[] = [
  { id: 'extra-large-icons', label: 'Ikon ekstra besar', icon: PanelsTopLeft },
  { id: 'large-icons', label: 'Ikon besar', icon: Grid2X2 },
  { id: 'medium-icons', label: 'Ikon sedang', icon: LayoutGrid },
  { id: 'small-icons', label: 'Ikon kecil', icon: Grid3X3 },
  { id: 'list', label: 'Daftar', icon: List },
  { id: 'details', label: 'Detail', icon: ListTree },
  { id: 'tiles', label: 'Ubin', icon: Rows3 },
  { id: 'content', label: 'Konten', icon: LayoutList },
];

export function CatalogViewSelector({ value, onChange, compact = false }: {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { height, isLandscapePhone, isPhone } = useResponsiveLayout();
  const selected = catalogViewOptions.find((option) => option.id === value) ?? catalogViewOptions[5];

  const selectMode = (mode: CatalogViewMode) => {
    onChange(mode);
    setOpen(false);
  };

  return (
    <>
      <ScalePressable
        accessibilityHint="Membuka pilihan ukuran dan susunan katalog"
        accessibilityLabel={`Atur tampilan produk, saat ini ${selected.label}`}
        onPress={() => setOpen(true)}
        style={[styles.viewSelectorTrigger, compact && styles.viewSelectorTriggerCompact]}
      >
        <LayoutGrid color={palette.cocoa} size={20} strokeWidth={2} />
        {!compact ? <Text numberOfLines={1} style={styles.viewSelectorTriggerText}>{selected.label}</Text> : null}
        <ChevronDown color={palette.muted} size={16} strokeWidth={2} />
      </ScalePressable>
      <Modal animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent transparent visible={open}>
        <View style={[
          styles.viewMenuRoot,
          isPhone ? styles.viewMenuRootPhone : styles.viewMenuRootWide,
          isLandscapePhone && styles.viewMenuRootLandscape,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingLeft: Math.max(insets.left, spacing.md),
            paddingRight: Math.max(insets.right, spacing.md),
            paddingTop: isPhone ? Math.max(insets.top, spacing.md) : Math.max(insets.top + 92, spacing.xl),
          },
        ]}>
          <Pressable accessible={false} onPress={() => setOpen(false)} style={styles.viewMenuBackdrop} />
          <GlassCard
            contentStyle={styles.viewMenuSurface}
            style={[styles.viewMenuPanel, { maxHeight: Math.max(260, height - insets.top - insets.bottom - spacing.xl) }]}
          >
            <View accessibilityViewIsModal style={styles.viewMenuContent}>
              <View style={styles.viewMenuHeader}>
                <Text style={styles.viewMenuTitle}>Tampilan produk</Text>
                <Text style={styles.viewMenuSubtitle}>Pilih ukuran dan detail katalog</Text>
              </View>
              <ScrollView bounces={false} contentContainerStyle={styles.viewMenuOptions} showsVerticalScrollIndicator={false} style={styles.viewMenuScroll}>
                {catalogViewOptions.map(({ id, label, icon: Icon }) => {
                  const active = id === value;
                  return (
                    <ScalePressable
                      key={id}
                      accessibilityLabel={`Gunakan tampilan ${label.toLowerCase()}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => selectMode(id)}
                      style={[styles.viewMenuOption, active && styles.viewMenuOptionActive]}
                    >
                      <View style={[styles.viewMenuIcon, active && styles.viewMenuIconActive]}>
                        <Icon color={active ? palette.white : palette.cocoa} size={19} strokeWidth={2} />
                      </View>
                      <Text style={[styles.viewMenuOptionText, active && styles.viewMenuOptionTextActive]}>{label}</Text>
                      <View style={[styles.viewMenuCheck, active && styles.viewMenuCheckActive]}>
                        {active ? <Check color={palette.white} size={13} strokeWidth={3} /> : null}
                      </View>
                    </ScalePressable>
                  );
                })}
              </ScrollView>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

export function ProductDetailsHeader({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.detailsHeader}>
      <View style={[styles.detailsArtworkSpacer, compact && styles.detailsArtworkSpacerCompact]} />
      <Text style={[styles.detailsHeaderText, styles.detailsIdentity]}>Produk / SKU</Text>
      <Text style={[styles.detailsHeaderText, styles.detailsPriceColumn, compact && styles.detailsPriceColumnCompact]}>Harga</Text>
      <Text style={[styles.detailsHeaderText, styles.detailsStock, compact && styles.detailsStockCompact]}>Stok</Text>
      {!compact ? <Text style={[styles.detailsHeaderText, styles.detailsCategory]}>Kategori</Text> : null}
    </View>
  );
}

export function PricingModeSelector({ value, resellerCount, onChange, compact = false }: {
  value: PricingMode;
  resellerCount: number;
  onChange: (mode: PricingMode) => void;
  compact?: boolean;
}) {
  const options: { id: PricingMode; label: string; helper: string; icon: typeof UserRound }[] = [
    { id: 'customer', label: 'Pelanggan', helper: 'Harga reguler', icon: UserRound },
    { id: 'reseller', label: 'Reseller', helper: 'Harga khusus', icon: Handshake },
  ];

  return (
    <BlurView intensity={74} tint="light" style={[styles.pricingModeShell, compact && styles.pricingModeShellCompact]}>
      {!compact ? <View style={styles.pricingModeHeading}>
        <View style={styles.pricingModeCopy}>
          <Text style={styles.pricingModeTitle}>Pilih jenis harga</Text>
          <Text style={styles.pricingModeSubtitle}>Satu pilihan berlaku untuk seluruh transaksi.</Text>
        </View>
        <View style={styles.pricingActiveMark}><Check color={palette.success} size={15} strokeWidth={2.5} /></View>
      </View> : null}
      <View accessibilityRole="tablist" style={[styles.pricingModeTrack, compact && styles.pricingModeTrackCompact]}>
        {options.map(({ id, label, helper, icon: Icon }) => {
          const selected = value === id;
          return (
            <ScalePressable
              key={id}
              accessibilityLabel={`Gunakan harga ${label.toLowerCase()}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              containerStyle={styles.pricingModeOptionContainer}
              onPress={() => onChange(id)}
              style={[styles.pricingModeOption, compact && styles.pricingModeOptionCompact, selected && styles.pricingModeOptionSelected]}
            >
              <View style={[styles.pricingModeIcon, compact && styles.pricingModeIconCompact, selected && styles.pricingModeIconSelected]}>
                <Icon color={selected ? palette.white : palette.cocoa} size={19} strokeWidth={2} />
              </View>
              <View style={styles.pricingModeOptionCopy}>
                <Text style={[styles.pricingModeOptionLabel, selected && styles.pricingModeOptionLabelSelected]}>{label}</Text>
                {!compact ? <Text style={[styles.pricingModeOptionHelper, selected && styles.pricingModeOptionHelperSelected]}>{helper}</Text> : null}
              </View>
            </ScalePressable>
          );
        })}
      </View>
      {!compact ? <Text accessibilityLiveRegion="polite" style={styles.pricingModeSummary}>
        {value === 'reseller' ? `${resellerCount} produk dengan harga reseller tersedia` : 'Seluruh katalog memakai harga pelanggan'}
      </Text> : null}
    </BlurView>
  );
}

interface CartRowProps {
  item: CartItem;
  onChange: (lineId: string, delta: number) => void;
  onRemove: (lineId: string) => void;
}

export const CartRow = memo(function CartRow({ item, onChange, onRemove }: CartRowProps) {
  const minimumQuantity = Math.max(item.minimumOrderQuantity ?? 1, 1);
  const piecesPerUnit = resolvePiecesPerUnit(item.piecesPerUnit, item.name);
  const salesUnit = piecesPerUnit > 1 ? 'paket' : 'pcs';
  const optionSummary = selectedOptionSummary(item);
  return (
    <View style={styles.cartRow}>
      <View style={styles.cartIndex}><Text style={styles.cartIndexText}>{item.quantity}</Text></View>
      <View style={styles.cartCopy}>
        <Text style={styles.cartName}>{item.name}</Text>
        {optionSummary ? <Text numberOfLines={2} style={styles.cartOptions}>{optionSummary}</Text> : null}
        <Text style={styles.cartPrice}>{formatCurrency(item.price)} / {salesUnit}</Text>
        {piecesPerUnit > 1 ? <Text style={styles.cartPieces}>{item.quantity} paket · {item.quantity * piecesPerUnit} pcs donat</Text> : null}
      </View>
      <View style={styles.quantityControl}>
        <ScalePressable accessibilityLabel={item.quantity <= minimumQuantity ? `Hapus ${item.name}` : `Kurangi ${item.name}`} onPress={() => item.quantity <= minimumQuantity ? onRemove(item.lineId) : onChange(item.lineId, -1)} style={styles.quantityButton}>
          {item.quantity <= minimumQuantity ? <Trash2 color={palette.danger} size={16} /> : <Minus color={palette.cocoa} size={16} />}
        </ScalePressable>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <ScalePressable accessibilityLabel={`Tambah ${item.name}`} onPress={() => onChange(item.lineId, 1)} style={styles.quantityButton}>
          <Plus color={palette.cocoa} size={16} />
        </ScalePressable>
      </View>
    </View>
  );
});

export function CartFloatingBar({ count, total, pricingMode, onPress, onClear, compact = false }: { count: number; total: number; pricingMode: PricingMode; onPress: () => void; onClear: () => void; compact?: boolean }) {
  return (
    <GlassCard style={[styles.cartFloating, compact && styles.cartFloatingCompact]} contentStyle={[styles.cartFloatingInner, compact && styles.cartFloatingInnerCompact]}>
      {!compact ? <View style={styles.cartIcon}><ShoppingBag color={palette.white} size={20} /></View> : null}
      <View style={styles.cartFloatingCopy}>
        <Text numberOfLines={1} style={styles.cartFloatingLabel}>{count} item · {pricingMode === 'reseller' ? 'Harga reseller' : 'Harga pelanggan'}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cartFloatingTotal}>{formatCurrency(total)}</Text>
      </View>
      <ScalePressable accessibilityHint="Menghapus semua item yang sudah dipilih" accessibilityLabel="Kosongkan keranjang" onPress={onClear} style={styles.cartClearAction}>
        <Trash2 color={palette.danger} size={20} />
      </ScalePressable>
      <ScalePressable accessibilityLabel="Buka keranjang dan checkout" onPress={onPress} style={[styles.cartAction, compact && styles.cartActionCompact]}>
        <Text style={styles.cartActionText}>Checkout</Text>
      </ScalePressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  productCard: { flex: 1, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  productCardHorizontal: { flexDirection: 'row' },
  productCardTiles: { minHeight: 118 },
  productCardContent: { minHeight: 160 },
  productCardSmallIcons: { borderRadius: radius.md },
  productCardList: { flex: 1, minHeight: 68, padding: spacing.xxs, paddingRight: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  productCardDetails: { flex: 1, minHeight: 76, padding: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.94)', overflow: 'hidden' },
  productVisual: { height: 112, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productVisualExtraLarge: { height: 220 },
  productVisualLarge: { height: 160 },
  productVisualSmall: { height: 72 },
  productVisualList: { width: 58, height: 58, flexShrink: 0, borderRadius: 14 },
  productVisualDetails: { width: 54, height: 54, flexShrink: 0, borderRadius: 14 },
  productVisualDetailsCompact: { width: 46, height: 46, borderRadius: 12 },
  productVisualTiles: { width: 96, height: '100%', minHeight: 118, flexShrink: 0 },
  productVisualContent: { width: 132, height: '100%', minHeight: 160, flexShrink: 0 },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  donut: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    ...(Platform.select({
      web: { boxShadow: '0 8px 12px rgba(86, 49, 31, 0.2)' },
      default: { shadowColor: '#56311F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
    }) ?? {}),
  },
  donutCompact: { width: 38, height: 38, borderRadius: 19 },
  donutExtraLarge: { width: 108, height: 108, borderRadius: 54 },
  donutGlaze: { position: 'absolute', width: 54, height: 22, top: 10, left: 9, backgroundColor: 'rgba(255,255,255,0.26)', borderRadius: radius.pill, transform: [{ rotate: '-10deg' }] },
  donutGlazeCompact: { width: 27, height: 11, top: 5, left: 5 },
  donutGlazeExtraLarge: { width: 78, height: 31, top: 15, left: 14 },
  donutHole: { width: 24, height: 24, borderRadius: 12, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  donutHoleCompact: { width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  donutHoleExtraLarge: { width: 34, height: 34, borderRadius: 17, borderWidth: 5 },
  cartQuantityBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoaDark, borderWidth: 2, borderColor: palette.white },
  cartQuantityBadgeCompact: { top: 4, left: 4, minWidth: 23, height: 23, paddingHorizontal: 5, borderWidth: 1 },
  cartQuantityText: { color: palette.white, fontFamily: type.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  favoriteBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, minHeight: 25, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: 'rgba(55,30,22,0.84)', justifyContent: 'center' },
  favoriteText: { color: palette.white, fontFamily: type.bold, fontSize: 9, letterSpacing: 0.8 },
  productCopy: { padding: spacing.sm, gap: 5 },
  productCopyHorizontal: { flex: 1, justifyContent: 'center', padding: spacing.sm },
  productCopySmallIcons: { padding: spacing.xs, gap: 3 },
  productName: { color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  productNameSmallIcons: { fontSize: 11, lineHeight: 15 },
  productPackaging: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 10, marginTop: -1 },
  productMeta: { color: palette.muted, fontFamily: type.medium, fontSize: 9 },
  productDescription: { minHeight: 34, color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16 },
  productFooter: { marginTop: 2, gap: spacing.xs, alignItems: 'flex-start' },
  productFooterHorizontal: { alignItems: 'flex-start' },
  productPriceGroup: { gap: 2 },
  productPriceLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 9 },
  productPriceLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  productPrice: { color: palette.cocoa, fontFamily: type.bold, fontSize: 14 },
  productPriceSmallIcons: { fontSize: 10 },
  productOriginalPrice: { color: palette.muted, fontFamily: type.medium, fontSize: 10, textDecorationLine: 'line-through' },
  listIdentity: { flex: 1, minWidth: 0 },
  listName: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  listMeta: { color: palette.muted, fontFamily: type.medium, fontSize: 9, marginTop: 3 },
  listPrice: { width: 92, color: palette.cocoa, fontFamily: type.bold, fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
  detailsHeader: { minHeight: 36, marginBottom: spacing.xxs, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: palette.line },
  detailsArtworkSpacer: { width: 54, flexShrink: 0 },
  detailsArtworkSpacerCompact: { width: 46 },
  detailsHeaderText: { color: palette.muted, fontFamily: type.bold, fontSize: 9, letterSpacing: 0.25, textTransform: 'uppercase' },
  detailsIdentity: { flex: 1.55, minWidth: 0 },
  detailsName: { color: palette.ink, fontFamily: type.bold, fontSize: 13, lineHeight: 17 },
  detailsSku: { color: palette.muted, fontFamily: type.medium, fontSize: 9, marginTop: 3 },
  detailsPriceColumn: { width: 96, flexShrink: 0 },
  detailsPriceColumnCompact: { width: 80 },
  detailsPrice: { color: palette.cocoa, fontFamily: type.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  detailsOriginalPrice: { color: palette.muted, fontFamily: type.medium, fontSize: 9, marginTop: 2, textDecorationLine: 'line-through' },
  detailsStock: { width: 72, flexShrink: 0, color: palette.inkSoft, fontFamily: type.semibold, fontSize: 10, fontVariant: ['tabular-nums'] },
  detailsStockCompact: { width: 54, fontSize: 9 },
  detailsCategory: { flex: 0.8, minWidth: 70, color: palette.inkSoft, fontFamily: type.medium, fontSize: 10 },
  viewSelectorTrigger: { minWidth: 168, minHeight: 48, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: palette.glassStrong, borderWidth: 1, borderColor: palette.line },
  viewSelectorTriggerCompact: { minWidth: 60, width: 60, paddingHorizontal: spacing.xs, gap: 4 },
  viewSelectorTriggerText: { flex: 1, color: palette.ink, fontFamily: type.semibold, fontSize: 11 },
  viewMenuRoot: { flex: 1 },
  viewMenuRootPhone: { justifyContent: 'flex-end', alignItems: 'stretch' },
  viewMenuRootWide: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  viewMenuRootLandscape: { alignItems: 'flex-end' },
  viewMenuBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.scrim },
  viewMenuPanel: { width: '100%', maxWidth: 340, zIndex: 1, borderRadius: radius.xl, ...shadow.floating },
  viewMenuSurface: { overflow: 'hidden', backgroundColor: 'rgba(255,253,249,0.98)' },
  viewMenuContent: { flexShrink: 1 },
  viewMenuHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.line },
  viewMenuTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 16 },
  viewMenuSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 2 },
  viewMenuScroll: { flexShrink: 1 },
  viewMenuOptions: { padding: spacing.xs },
  viewMenuOption: { minHeight: 50, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md },
  viewMenuOptionActive: { backgroundColor: palette.roseSoft },
  viewMenuIcon: { width: 34, height: 34, flexShrink: 0, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107,63,42,0.08)' },
  viewMenuIconActive: { backgroundColor: palette.cocoaDark },
  viewMenuOptionText: { flex: 1, color: palette.inkSoft, fontFamily: type.medium, fontSize: 13 },
  viewMenuOptionTextActive: { color: palette.cocoaDark, fontFamily: type.bold },
  viewMenuCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  viewMenuCheckActive: { backgroundColor: palette.cocoaDark, borderColor: palette.cocoaDark },
  pricingModeShell: { marginBottom: spacing.md, padding: spacing.sm, borderRadius: radius.xl, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', backgroundColor: 'rgba(255,255,255,0.38)' },
  pricingModeShellCompact: { marginBottom: 0, padding: spacing.xxs, borderRadius: radius.lg },
  pricingModeHeading: { minHeight: 42, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pricingModeCopy: { flex: 1 },
  pricingModeTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  pricingModeSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 2 },
  pricingActiveMark: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.successSoft, borderWidth: 1, borderColor: 'rgba(38,122,85,0.12)' },
  pricingModeTrack: { width: '100%', maxWidth: 540, flexDirection: 'row', gap: spacing.xs, padding: spacing.xxs, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: 'rgba(86,49,31,0.07)', borderWidth: 1, borderColor: 'rgba(86,49,31,0.08)' },
  pricingModeTrackCompact: { gap: spacing.xxs, padding: 2, borderRadius: radius.md },
  pricingModeOptionContainer: { flex: 1, minWidth: 0 },
  pricingModeOption: { flex: 1, minHeight: 62, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(255,255,255,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.46)' },
  pricingModeOptionCompact: { minHeight: 42, paddingHorizontal: spacing.xs, gap: 6, borderRadius: radius.sm },
  pricingModeOptionSelected: { backgroundColor: palette.cocoaDark, borderColor: 'rgba(255,255,255,0.18)' },
  pricingModeIcon: { width: 38, height: 38, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.68)' },
  pricingModeIconCompact: { width: 32, height: 32, borderRadius: 11 },
  pricingModeIconSelected: { backgroundColor: 'rgba(255,255,255,0.14)' },
  pricingModeOptionCopy: { flex: 1, minWidth: 0 },
  pricingModeOptionLabel: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  pricingModeOptionLabelSelected: { color: palette.white },
  pricingModeOptionHelper: { color: palette.muted, fontFamily: type.medium, fontSize: 9, marginTop: 2 },
  pricingModeOptionHelperSelected: { color: 'rgba(255,255,255,0.68)' },
  pricingModeSummary: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 10, lineHeight: 15, paddingHorizontal: spacing.xs, paddingTop: spacing.xs },
  cartRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  cartIndex: { width: 34, height: 34, borderRadius: 12, backgroundColor: palette.roseSoft, alignItems: 'center', justifyContent: 'center' },
  cartIndexText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 13 },
  cartCopy: { flex: 1 },
  cartName: { color: palette.ink, fontFamily: type.semibold, fontSize: 14 },
  cartPrice: { color: palette.muted, fontFamily: type.regular, fontSize: 11, marginTop: 2 },
  cartPieces: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 9, marginTop: 3 },
  cartOptions: { color: palette.cocoa, fontFamily: type.medium, fontSize: 10, lineHeight: 14, marginTop: 2 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, overflow: 'hidden', backgroundColor: palette.glassStrong },
  quantityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  quantityText: { minWidth: 24, color: palette.ink, textAlign: 'center', fontFamily: type.bold, fontSize: 13 },
  cartFloating: { marginTop: spacing.lg, borderRadius: radius.xl, ...shadow.floating },
  cartFloatingCompact: { marginTop: 0, borderRadius: radius.lg },
  cartFloatingInner: { minHeight: 76, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cartFloatingInnerCompact: { minHeight: 56, padding: spacing.xxs, gap: spacing.xs, backgroundColor: 'rgba(255,253,249,0.96)' },
  cartIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoaDark },
  cartFloatingCopy: { flex: 1, minWidth: 0 },
  cartFloatingLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  cartFloatingTotal: { color: palette.ink, fontFamily: type.bold, fontSize: 16, marginTop: 2 },
  cartClearAction: { width: 44, height: 48, flexShrink: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dangerSoft, borderWidth: 1, borderColor: 'rgba(185,62,72,0.16)' },
  cartAction: { minWidth: 104, minHeight: 48, flexShrink: 0, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoaDark },
  cartActionCompact: { minWidth: 92 },
  cartActionText: { color: palette.white, fontFamily: type.bold, fontSize: 13 },
});
