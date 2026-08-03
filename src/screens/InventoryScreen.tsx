import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertTriangle, CircleDot, PackageCheck, Plus, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { inventoryService } from '../api/services';
import { Button, Chip, Field, FormModal, GlassCard, Header, ScalePressable, Screen, SearchField, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { InventoryItem } from '../types/domain';
import { formatNumericInput, parseNumericInput } from '../utils/format';
import { useResponsiveLayout } from '../utils/responsive';

type StockFilter = 'Semua' | 'Menipis' | 'Aman';

const automaticAdjustmentReason = 'Penyesuaian stok manual';

const inventoryColors: Record<string, { background: string; accent: string }> = {
  medium: { background: palette.roseSoft, accent: palette.rose },
  large: { background: palette.honeySoft, accent: palette.honey },
  mini: { background: palette.infoSoft, accent: palette.info },
  bomboloni: { background: '#E5C9B9', accent: palette.cocoa },
};

export function InventoryScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Inventory'>) {
  const { isLandscapePhone } = useResponsiveLayout();
  const user = useSessionStore((state) => state.user);
  const canAdjust = user?.role === 'owner';
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('Semua');
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setItems(await inventoryService.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Stok tidak dapat dimuat.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadInventory();
  }, [loadInventory]));

  const filtered = useMemo(() => items.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || item.name.toLowerCase().includes(query) || item.code.includes(query);
    const low = item.stock <= item.lowStockThreshold;
    const matchesFilter = filter === 'Semua'
      || (filter === 'Menipis' && low)
      || (filter === 'Aman' && !low);
    return matchesQuery && matchesFilter;
  }), [filter, items, search]);
  const lowStock = items.filter((item) => item.stock <= item.lowStockThreshold).length;
  const safeStock = items.length - lowStock;

  const openAdjustment = (item: InventoryItem) => {
    if (!canAdjust) return;
    setSelected(item);
    setStockValue(formatNumericInput(item.stock));
    setFormError(null);
  };

  const saveAdjustment = async () => {
    if (!selected || !canAdjust) return;
    const quantity = parseNumericInput(stockValue);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setFormError('Stok harus berupa bilangan bulat nol atau lebih.');
      return;
    }
    setSaving(true);
    try {
      const saved = await inventoryService.adjust(selected.id, quantity, automaticAdjustmentReason, 'absolute');
      setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
      setSelected(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Stok tidak dapat diperbarui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen bottomInset={spacing.md} contentStyle={styles.screen} scroll={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyboardDismissMode={process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <Header
              onBack={navigation.goBack}
              subtitle={canAdjust ? 'Total donat fisik per ukuran, dihitung per pcs' : 'Mode lihat saja · hanya owner yang dapat mengubah stok'}
              title="Stok Donat"
            />
            <View style={[styles.topControls, isLandscapePhone && styles.topControlsLandscape]}>
              <View style={[styles.metrics, isLandscapePhone && styles.metricsLandscape]}>
                <GlassCard style={styles.metric} contentStyle={[styles.metricInner, isLandscapePhone && styles.metricInnerLandscape]}>
                  <PackageCheck color={palette.success} size={22} />
                  <Text style={[styles.metricValue, isLandscapePhone && styles.metricValueLandscape]}>{safeStock}</Text>
                  <Text style={styles.metricLabel}>Stok aman</Text>
                </GlassCard>
                <GlassCard style={styles.metric} contentStyle={[styles.metricInner, isLandscapePhone && styles.metricInnerLandscape]}>
                  <AlertTriangle color={palette.honey} size={22} />
                  <Text style={[styles.metricValue, isLandscapePhone && styles.metricValueLandscape]}>{lowStock}</Text>
                  <Text style={styles.metricLabel}>Perlu restock</Text>
                </GlassCard>
              </View>
              <View style={styles.filterControls}>
                <SearchField onChangeText={setSearch} placeholder="Cari ukuran donat" value={search} />
                <View style={[styles.filters, isLandscapePhone && styles.filtersLandscape]}>
                  {(['Semua', 'Menipis', 'Aman'] as StockFilter[]).map((item) => (
                    <Chip key={item} label={item} onPress={() => setFilter(item)} selected={filter === item} />
                  ))}
                </View>
              </View>
            </View>
            {loadError ? <Text accessibilityLiveRegion="assertive" style={styles.loadError}>{loadError}</Text> : null}
            <View style={styles.sectionHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Stok per ukuran</Text>
              <Text style={styles.sectionCount}>{filtered.length} ukuran</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<View style={styles.empty}><Search color={palette.rose} size={30} /><Text style={styles.emptyTitle}>{isLoading ? 'Memuat stok...' : 'Stok tidak ditemukan'}</Text></View>}
        onRefresh={loadInventory}
        refreshing={isLoading}
        renderItem={({ item }) => {
          const low = item.stock <= item.lowStockThreshold;
          const colors = inventoryColors[item.code] ?? inventoryColors.medium;
          return (
            <GlassCard style={styles.productCard} contentStyle={styles.productCardContent}>
              <View style={styles.productMainRow}>
                <View style={[styles.productVisual, { backgroundColor: colors.background }]}>
                  <CircleDot color={colors.accent} size={43} strokeWidth={3.5} />
                </View>
                <View style={styles.productCopy}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productMeta}>{item.productCount} menu kasir terhubung</Text>
                </View>
                <View style={styles.stockWrap}>
                  <Text style={styles.stockValue}>{item.stock}</Text>
                  <Text style={styles.stockLabel}>pcs tersedia</Text>
                </View>
              </View>
              <View style={styles.productFooter}>
                <StatusPill label={low ? 'Stok menipis' : 'Stok aman'} tone={low ? 'warning' : 'success'} />
                {canAdjust ? (
                  <ScalePressable
                    accessibilityHint="Membuka formulir untuk mengganti jumlah stok aktual"
                    accessibilityLabel={`Atur stok ${item.name}`}
                    onPress={() => openAdjustment(item)}
                    style={styles.adjustButton}
                  >
                    <Plus color={palette.cocoa} size={17} strokeWidth={2.5} />
                    <Text style={styles.adjustButtonText}>Atur stok</Text>
                  </ScalePressable>
                ) : null}
              </View>
            </GlassCard>
          );
        }}
        showsVerticalScrollIndicator={false}
        style={styles.inventoryList}
      />

      <FormModal
        footer={<View style={styles.modalActions}><Button compact label="Batal" onPress={() => setSelected(null)} variant="secondary" /><Button compact label="Simpan stok" loading={saving} onPress={saveAdjustment} /></View>}
        onClose={() => setSelected(null)}
        subtitle={selected ? 'Masukkan jumlah donat fisik yang tersedia saat ini.' : undefined}
        title={selected ? `Atur ${selected.name}` : 'Atur stok'}
        visible={selected !== null}
      >
        <Field keyboardType="number-pad" label="Jumlah stok aktual (pcs)" onChangeText={(value) => setStockValue(formatNumericInput(value))} placeholder="0" value={stockValue} />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      </FormModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  inventoryList: { flex: 1, minHeight: 0 },
  listHeader: { gap: spacing.sm },
  topControls: { width: '100%' },
  topControlsLandscape: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginBottom: spacing.xs },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metricsLandscape: { flex: 0.75, minWidth: 0, marginBottom: 0 },
  metric: { flex: 1 },
  metricInner: { minHeight: 116, padding: spacing.md },
  metricInnerLandscape: { minHeight: 108, padding: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: palette.ink, fontFamily: type.bold, fontSize: 22, marginTop: spacing.sm },
  metricValueLandscape: { fontSize: 18, marginTop: spacing.xxs },
  metricLabel: { color: palette.muted, fontFamily: type.medium, fontSize: 10, marginTop: 2 },
  filterControls: { flex: 1.25, minWidth: 0 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.sm },
  filtersLandscape: { flexWrap: 'nowrap', paddingVertical: spacing.xxs },
  sectionHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  sectionTitle: { flex: 1, color: palette.ink, fontFamily: type.bold, fontSize: 16, lineHeight: 22 },
  sectionCount: { color: palette.muted, fontFamily: type.medium, fontSize: 11 },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  productCard: { width: '100%' },
  productCardContent: { minHeight: 132, padding: spacing.md, gap: spacing.sm },
  productMainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  productVisual: { width: 68, height: 68, flexShrink: 0, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  productCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 },
  productName: { color: palette.ink, fontFamily: type.bold, fontSize: 15, lineHeight: 21 },
  productMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 11, lineHeight: 16 },
  stockWrap: { minWidth: 72, flexShrink: 0, alignItems: 'flex-end' },
  stockValue: { color: palette.cocoa, fontFamily: type.bold, fontSize: 24, lineHeight: 29 },
  stockLabel: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15 },
  productFooter: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  adjustButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: palette.roseSoft, paddingHorizontal: spacing.md },
  adjustButtonText: { color: palette.cocoa, fontFamily: type.bold, fontSize: 12 },
  empty: { minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14, marginTop: spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  formError: { color: palette.danger, fontFamily: type.medium, fontSize: 11 },
  loadError: { color: palette.danger, fontFamily: type.medium, fontSize: 11, marginBottom: spacing.sm },
});
