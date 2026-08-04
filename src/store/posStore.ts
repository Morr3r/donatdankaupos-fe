import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem, PricingMode, Product, ProductCategory, ProductOption } from '../types/domain';
import { selectedVariantIds } from '../utils/cartOptions';
import { createLocalId, getProductPrice } from '../utils/format';

interface ProductSelection {
  quantity: number;
  variants?: ProductOption[];
  toppings?: ProductOption[];
  note?: string;
}

const optionKey = (ids: string[]) => [...ids].sort().join('\u001f');

interface POSState {
  cart: CartItem[];
  search: string;
  category: ProductCategory;
  pricingMode: PricingMode;
  setSearch: (search: string) => void;
  setCategory: (category: ProductCategory) => void;
  setPricingMode: (pricingMode: PricingMode) => void;
  addProduct: (product: Product, selection?: ProductSelection) => void;
  changeQuantity: (lineId: string, delta: number) => void;
  setLineNote: (lineId: string, note: string) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  resetSale: () => void;
}

export const usePOSStore = create<POSState>()(
  persist(
    (set) => ({
      cart: [],
      search: '',
      category: 'Semua',
      pricingMode: 'customer',
      setSearch: (search) => set({ search }),
      setCategory: (category) => set({ category }),
      setPricingMode: (pricingMode) => set({ pricingMode }),
      addProduct: (product, selection) =>
        set((state) => {
          const resolvedSelection = selection ?? { quantity: Math.max(product.minimumOrderQuantity ?? 1, 1) };
          const variants = resolvedSelection.variants ?? [];
          const variantIds = variants.map((item) => item.id);
          const toppings = resolvedSelection.toppings ?? [];
          const toppingIds = toppings.map((item) => item.id).sort();
          const existing = state.cart.find((item) => (
            item.productId === product.id
            && optionKey(selectedVariantIds(item)) === optionKey(variantIds)
            && optionKey(item.selectedToppingIds ?? []) === optionKey(toppingIds)
            && (item.note ?? '') === (resolvedSelection.note ?? '')
          ));
          if (existing) {
            return { cart: state.cart.map((item) => item.lineId === existing.lineId ? { ...item, quantity: item.quantity + resolvedSelection.quantity } : item) };
          }
          const optionPrice = variants.reduce((sum, item) => sum + item.priceDelta, 0)
            + toppings.reduce((sum, item) => sum + item.priceDelta, 0);
          return {
            cart: [...state.cart, {
              lineId: createLocalId('line'),
              productId: product.id,
              name: product.name,
              price: getProductPrice(product, state.pricingMode) + optionPrice,
              quantity: resolvedSelection.quantity,
              minimumOrderQuantity: Math.max(product.minimumOrderQuantity ?? 1, 1),
              piecesPerUnit: Math.max(product.piecesPerUnit ?? 1, 1),
              note: resolvedSelection.note?.trim() || undefined,
              selectedVariantIds: variantIds,
              selectedVariantNames: variants.map((item) => item.name),
              selectedToppingIds: toppingIds,
              selectedToppingNames: toppings.map((item) => item.name),
            }],
          };
        }),
      changeQuantity: (lineId, delta) =>
        set((state) => ({
          cart: state.cart
            .map((item) => item.lineId === lineId
              ? { ...item, quantity: Math.max(item.minimumOrderQuantity ?? 1, item.quantity + delta) }
              : item),
        })),
      setLineNote: (lineId, note) => set((state) => ({ cart: state.cart.map((item) => item.lineId === lineId ? { ...item, note } : item) })),
      removeLine: (lineId) => set((state) => ({ cart: state.cart.filter((item) => item.lineId !== lineId) })),
      clearCart: () => set({ cart: [] }),
      resetSale: () => set({ cart: [], pricingMode: 'customer', search: '', category: 'Semua' }),
    }),
    {
      name: 'donat-dankau-cart-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ cart: state.cart, pricingMode: state.pricingMode }),
    },
  ),
);
