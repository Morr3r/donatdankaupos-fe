import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Plus, Save, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { catalogService, inventoryService, type ProductInput } from '../api/services';
import { Button, Chip, Field, GlassCard, Header, IconButton, Screen, SectionHeader } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useCatalogStore } from '../store/catalogStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { InventoryItem, ProductOption } from '../types/domain';
import { createLocalId, resolvePiecesPerUnit } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductEditor'>;

export function ProductEditorScreen({ navigation, route }: Props) {
  const productId = route.params?.productId;
  const existing = useCatalogStore((state) => state.products.find((item) => item.id === productId));
  const replaceProduct = useCatalogStore((state) => state.replaceProduct);
  const [name, setName] = useState(existing?.name ?? '');
  const [sku, setSku] = useState(existing?.sku ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'Donat');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '');
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(existing?.inventoryItemId ?? null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoadError, setInventoryLoadError] = useState<string | null>(null);
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(String(existing?.minimumOrderQuantity ?? 1));
  const [piecesPerUnit, setPiecesPerUnit] = useState(String(resolvePiecesPerUnit(existing?.piecesPerUnit, existing?.name, existing?.sourcePackaging)));
  const [sourcePackaging, setSourcePackaging] = useState(existing?.sourcePackaging ?? '');
  const [variants, setVariants] = useState<ProductOption[]>(existing?.variants ?? []);
  const [toppings, setToppings] = useState<ProductOption[]>(existing?.toppings ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = existing ? 'Edit produk' : 'Produk baru';
  const numericPrice = Number(price.replace(/\D/g, '') || 0);
  const numericMinimumOrderQuantity = Number(minimumOrderQuantity);
  const numericPiecesPerUnit = Number(piecesPerUnit);
  const isValid = useMemo(
    () => name.trim().length >= 2
      && sku.trim().length >= 2
      && category.trim().length >= 2
      && Number.isInteger(numericMinimumOrderQuantity)
      && numericMinimumOrderQuantity >= 1
      && Number.isInteger(numericPiecesPerUnit)
      && numericPiecesPerUnit >= 1,
    [category, name, numericMinimumOrderQuantity, numericPiecesPerUnit, sku],
  );

  useEffect(() => {
    let active = true;
    inventoryService.list()
      .then((items) => {
        if (active) setInventoryItems(items);
      })
      .catch((loadError) => {
        if (active) setInventoryLoadError(loadError instanceof Error ? loadError.message : 'Kelompok stok tidak dapat dimuat.');
      });
    return () => { active = false; };
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
      mediaTypes: ['images'],
      quality: 0.55,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset?.base64) {
      if (asset.base64.length > 2_400_000) {
        Alert.alert('Foto terlalu besar', 'Pilih foto berukuran lebih kecil agar produk tetap cepat dimuat.');
        return;
      }
      setImageUrl(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    }
  };

  const save = async () => {
    if (!isValid) {
      setError('Nama, SKU, dan kategori minimal 2 karakter.');
      return;
    }
    if (!Number.isInteger(numericMinimumOrderQuantity) || numericMinimumOrderQuantity < 1) {
      setError('Minimal pembelian harus berupa angka satu atau lebih.');
      return;
    }
    if (!Number.isInteger(numericPiecesPerUnit) || numericPiecesPerUnit < 1) {
      setError('Isi per unit harus berupa angka satu atau lebih.');
      return;
    }
    if ([...variants, ...toppings].some((item) => !item.name.trim())) {
      setError('Nama varian dan topping tidak boleh kosong.');
      return;
    }
    const payload: ProductInput = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      price: numericPrice,
      stock: null,
      trackInventory: false,
      inventoryItemId,
      minimumOrderQuantity: numericMinimumOrderQuantity,
      piecesPerUnit: numericPiecesPerUnit,
      imageUrl: imageUrl.trim() || null,
      color: existing?.color ?? '#F5E6CF',
      accent: existing?.accent ?? '#B88952',
      isFavorite: existing?.isFavorite ?? false,
      isActive: true,
      sourcePackaging: sourcePackaging.trim() || null,
      variants: variants.map((item) => ({ ...item, name: item.name.trim(), priceDelta: Math.max(0, item.priceDelta) })),
      toppings: toppings.map((item) => ({ ...item, name: item.name.trim(), priceDelta: Math.max(0, item.priceDelta) })),
    };
    setSaving(true);
    setError(null);
    try {
      const saved = existing ? await catalogService.update(existing.id, payload) : await catalogService.create(payload);
      replaceProduct(saved);
      navigation.goBack();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Produk belum dapat disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen bottomInset={spacing.xl} contentStyle={styles.screen}>
      <Header onBack={navigation.goBack} subtitle="Informasi ini langsung dipakai di menu kasir" title={title} />

      <SectionHeader title="Informasi produk" />
      <GlassCard contentStyle={styles.card}>
        {imageUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: imageUrl }} style={styles.preview} /> : <View style={[styles.preview, styles.previewEmpty]}><ImagePlus color={palette.muted} size={34} /><Text style={styles.previewText}>Belum ada foto</Text></View>}
        <Button icon={ImagePlus} label="Pilih foto dari galeri" onPress={pickImage} variant="secondary" />
        {imageUrl ? <Button icon={Trash2} label="Hapus foto" onPress={() => setImageUrl('')} variant="danger" /> : null}
        <Field autoCapitalize="none" label="Atau alamat foto" onChangeText={setImageUrl} placeholder="https://..." value={imageUrl.startsWith('data:') ? '' : imageUrl} />
        <Field autoCapitalize="words" label="Nama produk" onChangeText={setName} placeholder="Contoh: Donat Cokelat" value={name} />
        <Field autoCapitalize="characters" label="SKU" onChangeText={setSku} placeholder="DDK-001" value={sku} />
        <Field label="Kategori" onChangeText={setCategory} placeholder="Donat" value={category} />
        <Field keyboardType="number-pad" label="Harga dasar" onChangeText={(value) => setPrice(value.replace(/\D/g, ''))} placeholder="0" value={price} />
        <Field label="Kemasan atau ukuran" onChangeText={setSourcePackaging} placeholder="Contoh: Isi 12 pcs, 35 gram, atau per pcs" value={sourcePackaging} />
        <Field keyboardType="number-pad" label="Isi per unit (pcs)" onChangeText={(value) => setPiecesPerUnit(value.replace(/\D/g, ''))} placeholder="1" value={piecesPerUnit} />
        <Field keyboardType="number-pad" label="Minimal unit pembelian" onChangeText={(value) => setMinimumOrderQuantity(value.replace(/\D/g, ''))} placeholder="1" value={minimumOrderQuantity} />
        <Field label="Deskripsi" multiline numberOfLines={4} onChangeText={setDescription} placeholder="Deskripsi singkat produk" style={styles.multiline} value={description} />
      </GlassCard>

      <OptionEditor label="Varian" onChange={setVariants} options={variants} />
      <OptionEditor label="Topping" onChange={setToppings} options={toppings} />

      <SectionHeader title="Stok" />
      <GlassCard contentStyle={styles.card}>
        <View><Text style={styles.switchTitle}>Ambil dari kelompok stok</Text><Text style={styles.switchSubtitle}>Setiap penjualan mengurangi stok pilihan ini sesuai jumlah pcs dalam produk.</Text></View>
        <View style={styles.stockChoices}>
          <Chip label="Tidak mengurangi stok" onPress={() => setInventoryItemId(null)} selected={inventoryItemId === null} />
          {inventoryItems.map((item) => <Chip key={item.id} label={item.name} onPress={() => setInventoryItemId(item.id)} selected={inventoryItemId === item.id} />)}
        </View>
        {inventoryItemId ? <Text style={styles.stockHelper}>Contoh: produk isi {numericPiecesPerUnit || 1} akan mengurangi stok sebanyak {numericPiecesPerUnit || 1} pcs untuk setiap 1 unit yang terjual.</Text> : null}
        {inventoryLoadError ? <Text style={styles.error}>{inventoryLoadError}</Text> : null}
      </GlassCard>

      {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
      <View style={styles.formAction}>
        <Button disabled={!isValid} icon={Save} label="Simpan produk" loading={saving} onPress={save} />
      </View>
    </Screen>
  );
}

function OptionEditor({ label, options, onChange }: { label: string; options: ProductOption[]; onChange: (options: ProductOption[]) => void }) {
  const add = () => onChange([...options, { id: createLocalId(label.toLowerCase()), name: '', priceDelta: 0 }]);
  const update = (id: string, changes: Partial<ProductOption>) => onChange(options.map((item) => item.id === id ? { ...item, ...changes } : item));
  return (
    <>
      <SectionHeader actionLabel={`Tambah ${label.toLowerCase()}`} onAction={add} title={label} />
      <GlassCard contentStyle={styles.card}>
        {options.length ? options.map((item, index) => (
          <View key={item.id} style={styles.optionCard}>
            <View style={styles.optionHeading}><Text style={styles.optionTitle}>{label} {index + 1}</Text><IconButton icon={Trash2} label={`Hapus ${label} ${index + 1}`} onPress={() => onChange(options.filter((option) => option.id !== item.id))} tone="danger" /></View>
            <Field label="Nama" onChangeText={(value) => update(item.id, { name: value })} placeholder={label === 'Varian' ? 'Contoh: Isi 6' : 'Contoh: Keju'} value={item.name} />
            <Field keyboardType="number-pad" label="Tambahan harga" onChangeText={(value) => update(item.id, { priceDelta: Number(value.replace(/\D/g, '') || 0) })} placeholder="0" value={String(item.priceDelta)} />
          </View>
        )) : <View style={styles.emptyOptions}><Text style={styles.emptyOptionsText}>Belum ada {label.toLowerCase()}. Produk tetap bisa dijual dengan harga dasar.</Text><Button compact icon={Plus} label={`Tambah ${label.toLowerCase()}`} onPress={add} variant="secondary" /></View>}
      </GlassCard>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { maxWidth: 760, alignSelf: 'center' },
  card: { padding: spacing.md, gap: spacing.md },
  preview: { width: '100%', height: 220, borderRadius: radius.lg, resizeMode: 'cover', backgroundColor: palette.roseSoft },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  previewText: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  switchTitle: { color: palette.ink, fontFamily: type.semibold, fontSize: 13 },
  switchSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15, marginTop: 3 },
  stockChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stockHelper: { color: palette.success, fontFamily: type.medium, fontSize: 10, lineHeight: 16 },
  optionCard: { gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.line },
  optionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 13 },
  emptyOptions: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  emptyOptionsText: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  formAction: { marginTop: spacing.md },
  error: { color: palette.danger, fontFamily: type.medium, fontSize: 12, lineHeight: 18, paddingVertical: spacing.sm },
});
