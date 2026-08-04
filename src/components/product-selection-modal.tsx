import { Minus, Plus, ShoppingBag } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { PricingMode, Product, ProductOption } from '../types/domain';
import { formatCurrency, getProductPrice, resolvePiecesPerUnit } from '../utils/format';
import { Button, Chip, Field, FormModal, ScalePressable } from './ui';

export interface ProductSelectionValue {
  quantity: number;
  variants: ProductOption[];
  toppings: ProductOption[];
  note?: string;
}

export function ProductSelectionModal({ product, pricingMode, onClose, onAdd }: {
  product: Product | null;
  pricingMode: PricingMode;
  onClose: () => void;
  onAdd: (product: Product, selection: ProductSelectionValue) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [variantIds, setVariantIds] = useState<string[]>([]);
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    setQuantity(Math.max(product?.minimumOrderQuantity ?? 1, 1));
    setVariantIds([]);
    setToppingIds([]);
    setNote('');
  }, [product]);

  const variants = product?.variants ?? [];
  const toppings = product?.toppings ?? [];
  const selectedVariants = variants.filter((item) => variantIds.includes(item.id));
  const selectedToppings = toppings.filter((item) => toppingIds.includes(item.id));
  const unitPrice = (product ? getProductPrice(product, pricingMode) : 0)
    + selectedVariants.reduce((sum, item) => sum + item.priceDelta, 0)
    + selectedToppings.reduce((sum, item) => sum + item.priceDelta, 0);
  const minimumQuantity = Math.max(product?.minimumOrderQuantity ?? 1, 1);
  const piecesPerUnit = resolvePiecesPerUnit(product?.piecesPerUnit, product?.name, product?.sourcePackaging);
  const availableUnits = product?.trackInventory ? Math.floor((product.stock ?? 0) / piecesPerUnit) : 10_000;
  const maxQuantity = Math.max(availableUnits, minimumQuantity);
  const hasEnoughStock = !product?.trackInventory || availableUnits >= minimumQuantity;
  const optionSummary = [...selectedVariants, ...selectedToppings].map((item) => item.name).join(' · ');

  const toggleVariant = (id: string) => {
    setVariantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleTopping = (id: string) => {
    setToppingIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  if (!product) return null;

  return (
    <FormModal
      footer={(
        <View style={styles.footer}>
          <View style={styles.totalCopy}>
            <Text style={styles.totalLabel}>{quantity} {piecesPerUnit > 1 ? `paket · ${quantity * piecesPerUnit} pcs` : 'pcs'}{minimumQuantity > 1 ? ` (min. ${minimumQuantity})` : ''}{optionSummary ? ` · ${optionSummary}` : ''}</Text>
            <Text style={styles.totalValue}>{formatCurrency(unitPrice * quantity)}</Text>
          </View>
          <Button
            compact
            disabled={!hasEnoughStock}
            icon={ShoppingBag}
            label={hasEnoughStock ? 'Tambah' : 'Stok tidak cukup'}
            onPress={() => {
              onAdd(product, { quantity, variants: selectedVariants, toppings: selectedToppings, note: note.trim() || undefined });
              onClose();
            }}
          />
        </View>
      )}
      onClose={onClose}
      subtitle={product.description || product.category}
      title={product.name}
      visible
    >
      {product.imageUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: product.imageUrl }} style={styles.image} /> : null}
      <View style={styles.priceRow}>
        <View><Text style={styles.priceLabel}>Harga {pricingMode === 'reseller' ? 'reseller' : 'pelanggan'} per {piecesPerUnit > 1 ? 'paket' : 'pcs'}</Text><Text style={styles.price}>{formatCurrency(unitPrice)}</Text>{piecesPerUnit > 1 ? <Text style={styles.piecesNote}>1 paket = {piecesPerUnit} pcs donat</Text> : null}</View>
        <View style={styles.stepper}>
          <ScalePressable accessibilityLabel="Kurangi jumlah" disabled={quantity <= minimumQuantity} onPress={() => setQuantity((value) => Math.max(minimumQuantity, value - 1))} style={styles.stepButton}><Minus color={palette.cocoa} size={19} /></ScalePressable>
          <Text style={styles.quantity}>{quantity}</Text>
          <ScalePressable accessibilityLabel="Tambah jumlah" disabled={quantity >= maxQuantity} onPress={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} style={styles.stepButton}><Plus color={palette.cocoa} size={19} /></ScalePressable>
        </View>
      </View>

      {minimumQuantity > 1 ? <Text style={styles.minimumNote}>Minimal pembelian {minimumQuantity} {piecesPerUnit > 1 ? 'paket' : 'pcs'} untuk produk ini.</Text> : null}

      {variants.length ? <OptionSection helper="Bisa pilih lebih dari satu, termasuk semua varian." label="Pilih varian"><View style={styles.options}>{variants.map((item) => <Chip key={item.id} label={`${item.name}${item.priceDelta ? ` +${formatCurrency(item.priceDelta)}` : ''}`} onPress={() => toggleVariant(item.id)} selected={variantIds.includes(item.id)} />)}</View></OptionSection> : null}
      {toppings.length ? <OptionSection label="Tambah topping"><View style={styles.options}>{toppings.map((item) => <Chip key={item.id} label={`${item.name}${item.priceDelta ? ` +${formatCurrency(item.priceDelta)}` : ''}`} onPress={() => toggleTopping(item.id)} selected={toppingIds.includes(item.id)} />)}</View></OptionSection> : null}
      <Field label="Catatan (opsional)" multiline numberOfLines={3} onChangeText={setNote} placeholder="Contoh: topping dipisah" style={styles.noteInput} value={note} />
    </FormModal>
  );
}

function OptionSection({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionLabel}>{label}</Text>{helper ? <Text style={styles.sectionHelper}>{helper}</Text> : null}{children}</View>;
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 180, borderRadius: radius.lg, resizeMode: 'cover', backgroundColor: palette.roseSoft },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  priceLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  price: { color: palette.cocoa, fontFamily: type.bold, fontSize: 20, marginTop: 3 },
  piecesNote: { color: palette.muted, fontFamily: type.medium, fontSize: 9, marginTop: 3 },
  minimumNote: { color: palette.cocoa, fontFamily: type.semibold, fontSize: 11, lineHeight: 17 },
  stepper: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: 'rgba(255,255,255,0.8)', overflow: 'hidden' },
  stepButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 32, textAlign: 'center', color: palette.ink, fontFamily: type.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  section: { gap: spacing.xs },
  sectionLabel: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  sectionHelper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noteInput: { minHeight: 82, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalCopy: { flex: 1 },
  totalLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 9 },
  totalValue: { color: palette.ink, fontFamily: type.bold, fontSize: 16, marginTop: 2 },
});
