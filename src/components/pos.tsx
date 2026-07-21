import { BlurView } from 'expo-blur';
import { Check, Handshake, Minus, Plus, ShoppingBag, Trash2, UserRound } from 'lucide-react-native';
import { memo } from 'react';
import { Image, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { CartItem, PricingMode, Product } from '../types/domain';
import { palette, radius, shadow, spacing, type } from '../theme/tokens';
import { selectedOptionSummary } from '../utils/cartOptions';
import { formatCurrency, formatPackagingLabel, getProductPrice, resolvePiecesPerUnit } from '../utils/format';
import { GlassCard, ScalePressable, StatusPill } from './ui';

interface ProductCardProps {
  product: Product;
  cartQuantity?: number;
  onPress: (product: Product) => void;
  style?: StyleProp<ViewStyle>;
  horizontal?: boolean;
  pricingMode?: PricingMode;
}

export const ProductCard = memo(function ProductCard({ product, cartQuantity = 0, onPress, style, horizontal = false, pricingMode = 'customer' }: ProductCardProps) {
  const minimumQuantity = Math.max(product.minimumOrderQuantity ?? 1, 1);
  const piecesPerUnit = resolvePiecesPerUnit(product.piecesPerUnit, product.name, product.sourcePackaging);
  const packagingLabel = formatPackagingLabel(product.sourcePackaging, piecesPerUnit);
  const minimumPieces = minimumQuantity * piecesPerUnit;
  const soldOut = product.trackInventory && (product.stock ?? 0) < minimumPieces;
  const stockLabel = product.trackInventory ? `stok ${product.inventoryItemName ?? 'donat'} ${product.stock ?? 0} pcs` : 'tersedia';
  const cartLabel = cartQuantity > 0 ? `, ${cartQuantity} item di keranjang` : '';
  const activePrice = getProductPrice(product, pricingMode);
  const isReseller = pricingMode === 'reseller';
  return (
    <ScalePressable
      accessibilityLabel={`${product.name}, harga ${isReseller ? 'reseller' : 'pelanggan'} ${formatCurrency(activePrice)}, ${stockLabel}${cartLabel}`}
      accessibilityHint={soldOut ? 'Produk sedang habis' : 'Tambahkan ke keranjang'}
      containerStyle={style}
      disabled={soldOut}
      onPress={() => onPress(product)}
      style={[styles.productCard, horizontal && styles.productCardHorizontal]}
    >
      <View style={[styles.productVisual, horizontal && styles.productVisualHorizontal, { backgroundColor: product.color }]}> 
        {product.imageUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: product.imageUrl }} style={styles.productImage} /> : (
          <View style={[styles.donut, { backgroundColor: product.accent }]}> 
            <View style={styles.donutGlaze} />
            <View style={[styles.donutHole, { backgroundColor: product.color }]} />
          </View>
        )}
        {cartQuantity > 0 ? <View style={styles.cartQuantityBadge}><Text style={styles.cartQuantityText}>{cartQuantity}</Text></View> : null}
        {product.isFavorite ? <View style={styles.favoriteBadge}><Text style={styles.favoriteText}>BEST</Text></View> : null}
      </View>
      <View style={[styles.productCopy, horizontal && styles.productCopyHorizontal]}>
        <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
        {packagingLabel ? <Text style={styles.productPackaging}>{packagingLabel}</Text> : null}
        <Text numberOfLines={2} style={styles.productDescription}>{product.description}</Text>
        <View style={[styles.productFooter, horizontal && styles.productFooterHorizontal]}>
          <View style={styles.productPriceGroup}>
            <Text style={styles.productPriceLabel}>Harga {isReseller ? 'reseller' : 'pelanggan'}</Text>
            <View style={styles.productPriceLine}>
              <Text style={styles.productPrice}>{formatCurrency(activePrice)}</Text>
              {isReseller && product.price !== activePrice ? <Text style={styles.productOriginalPrice}>{formatCurrency(product.price)}</Text> : null}
            </View>
          </View>
          <StatusPill
            label={product.trackInventory
              ? (product.stock ?? 0) <= product.lowStockThreshold ? `Sisa ${product.stock ?? 0} pcs` : `Stok ${product.stock ?? 0} pcs`
              : minimumQuantity > 1 ? `Min. ${minimumQuantity} unit` : piecesPerUnit > 1 ? `${piecesPerUnit} pcs / paket` : 'Tersedia'}
            tone={product.trackInventory && (product.stock ?? 0) <= product.lowStockThreshold ? 'warning' : minimumQuantity > 1 ? 'info' : 'success'}
          />
        </View>
      </View>
    </ScalePressable>
  );
});

export function PricingModeSelector({ value, resellerCount, onChange }: {
  value: PricingMode;
  resellerCount: number;
  onChange: (mode: PricingMode) => void;
}) {
  const options: { id: PricingMode; label: string; helper: string; icon: typeof UserRound }[] = [
    { id: 'customer', label: 'Pelanggan', helper: 'Harga reguler', icon: UserRound },
    { id: 'reseller', label: 'Reseller', helper: 'Harga khusus', icon: Handshake },
  ];

  return (
    <BlurView intensity={74} tint="light" style={styles.pricingModeShell}>
      <View style={styles.pricingModeHeading}>
        <View style={styles.pricingModeCopy}>
          <Text style={styles.pricingModeTitle}>Pilih jenis harga</Text>
          <Text style={styles.pricingModeSubtitle}>Satu pilihan berlaku untuk seluruh transaksi.</Text>
        </View>
        <View style={styles.pricingActiveMark}><Check color={palette.success} size={15} strokeWidth={2.5} /></View>
      </View>
      <View accessibilityRole="tablist" style={styles.pricingModeTrack}>
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
              style={[styles.pricingModeOption, selected && styles.pricingModeOptionSelected]}
            >
              <View style={[styles.pricingModeIcon, selected && styles.pricingModeIconSelected]}>
                <Icon color={selected ? palette.white : palette.cocoa} size={19} strokeWidth={2} />
              </View>
              <View style={styles.pricingModeOptionCopy}>
                <Text style={[styles.pricingModeOptionLabel, selected && styles.pricingModeOptionLabelSelected]}>{label}</Text>
                <Text style={[styles.pricingModeOptionHelper, selected && styles.pricingModeOptionHelperSelected]}>{helper}</Text>
              </View>
            </ScalePressable>
          );
        })}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.pricingModeSummary}>
        {value === 'reseller' ? `${resellerCount} produk dengan harga reseller tersedia` : 'Seluruh katalog memakai harga pelanggan'}
      </Text>
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
    <GlassCard style={styles.cartFloating} contentStyle={[styles.cartFloatingInner, compact && styles.cartFloatingInnerCompact]}>
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
  productCardHorizontal: { minHeight: 148, flexDirection: 'row' },
  productVisual: { height: 112, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productVisualHorizontal: { width: 124, height: '100%', minHeight: 148, flexShrink: 0 },
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
  donutGlaze: { position: 'absolute', width: 54, height: 22, top: 10, left: 9, backgroundColor: 'rgba(255,255,255,0.26)', borderRadius: radius.pill, transform: [{ rotate: '-10deg' }] },
  donutHole: { width: 24, height: 24, borderRadius: 12, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  cartQuantityBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoaDark, borderWidth: 2, borderColor: palette.white },
  cartQuantityText: { color: palette.white, fontFamily: type.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  favoriteBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, minHeight: 25, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: 'rgba(55,30,22,0.84)', justifyContent: 'center' },
  favoriteText: { color: palette.white, fontFamily: type.bold, fontSize: 9, letterSpacing: 0.8 },
  productCopy: { padding: spacing.sm, gap: 5 },
  productCopyHorizontal: { flex: 1, justifyContent: 'center', padding: spacing.md },
  productName: { color: palette.ink, fontFamily: type.bold, fontSize: 15 },
  productPackaging: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 10, marginTop: -1 },
  productDescription: { minHeight: 34, color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16 },
  productFooter: { marginTop: 2, gap: spacing.xs, alignItems: 'flex-start' },
  productFooterHorizontal: { alignItems: 'flex-start' },
  productPriceGroup: { gap: 2 },
  productPriceLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 9 },
  productPriceLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  productPrice: { color: palette.cocoa, fontFamily: type.bold, fontSize: 14 },
  productOriginalPrice: { color: palette.muted, fontFamily: type.medium, fontSize: 10, textDecorationLine: 'line-through' },
  pricingModeShell: { marginBottom: spacing.md, padding: spacing.sm, borderRadius: radius.xl, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', backgroundColor: 'rgba(255,255,255,0.38)' },
  pricingModeHeading: { minHeight: 42, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pricingModeCopy: { flex: 1 },
  pricingModeTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  pricingModeSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 2 },
  pricingActiveMark: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.successSoft, borderWidth: 1, borderColor: 'rgba(38,122,85,0.12)' },
  pricingModeTrack: { width: '100%', maxWidth: 540, flexDirection: 'row', gap: spacing.xs, padding: spacing.xxs, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: 'rgba(86,49,31,0.07)', borderWidth: 1, borderColor: 'rgba(86,49,31,0.08)' },
  pricingModeOptionContainer: { flex: 1, minWidth: 0 },
  pricingModeOption: { flex: 1, minHeight: 62, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(255,255,255,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.46)' },
  pricingModeOptionSelected: { backgroundColor: palette.cocoaDark, borderColor: 'rgba(255,255,255,0.18)' },
  pricingModeIcon: { width: 38, height: 38, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.68)' },
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
  cartFloatingInner: { minHeight: 76, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cartFloatingInnerCompact: { gap: spacing.xs },
  cartIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoaDark },
  cartFloatingCopy: { flex: 1, minWidth: 0 },
  cartFloatingLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  cartFloatingTotal: { color: palette.ink, fontFamily: type.bold, fontSize: 16, marginTop: 2 },
  cartClearAction: { width: 44, height: 48, flexShrink: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dangerSoft, borderWidth: 1, borderColor: 'rgba(185,62,72,0.16)' },
  cartAction: { minWidth: 104, minHeight: 48, flexShrink: 0, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cocoaDark },
  cartActionCompact: { minWidth: 92 },
  cartActionText: { color: palette.white, fontFamily: type.bold, fontSize: 13 },
});
