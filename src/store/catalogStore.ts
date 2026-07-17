import { create } from 'zustand';
import { catalogService } from '../api/services';
import type { Product } from '../types/domain';

interface CatalogState {
  products: Product[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  replaceProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  reset: () => void;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  products: [],
  categories: [],
  isLoading: false,
  error: null,
  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const [products, categories] = await Promise.all([catalogService.list(), catalogService.categories()]);
      const categoryNames = categories.map((item) => item.name);
      const categoryOrder = new Map(categoryNames.map((name, index) => [name, index]));
      const sortedProducts = [...products].sort((left, right) => {
        const categoryDifference = (categoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER)
          - (categoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER);
        if (categoryDifference) return categoryDifference;
        const leftSourceOrder = Number(left.sourceProductId ?? Number.MAX_SAFE_INTEGER);
        const rightSourceOrder = Number(right.sourceProductId ?? Number.MAX_SAFE_INTEGER);
        if (leftSourceOrder !== rightSourceOrder) return leftSourceOrder - rightSourceOrder;
        return left.name.localeCompare(right.name, 'id-ID');
      });
      set({ products: sortedProducts, categories: categoryNames, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Katalog tidak dapat dimuat.',
      });
      throw error;
    }
  },
  replaceProduct: (product) => set((state) => ({
    products: state.products.some((item) => item.id === product.id)
      ? state.products.map((item) => item.id === product.id ? product : item)
      : [...state.products, product],
    categories: state.categories.includes(product.category) ? state.categories : [...state.categories, product.category],
  })),
  removeProduct: (id) => set((state) => ({ products: state.products.filter((item) => item.id !== id) })),
  reset: () => set({ products: [], categories: [], isLoading: false, error: null }),
}));
