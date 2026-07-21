import { create } from 'zustand';
import { saleService, shiftService } from '../api/services';
import type { Shift, Transaction } from '../types/domain';

interface OperationsState {
  hasHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  shift: Shift | null;
  transactions: Transaction[];
  hydrate: () => Promise<void>;
  refreshShift: () => Promise<Shift | null>;
  refreshTransactions: () => Promise<void>;
  openShift: (openingCash: number, openingBankBalance: number, terminalId: string) => Promise<Shift>;
  closeShift: (closingCash: number) => Promise<Shift>;
  addTransaction: (transaction: Transaction) => void;
  refundTransaction: (id: string, reason: string, managerPin?: string) => Promise<Transaction>;
  reset: () => void;
}

export const useOperationsStore = create<OperationsState>((set, get) => ({
  hasHydrated: false,
  isLoading: false,
  error: null,
  shift: null,
  transactions: [],
  hydrate: async () => {
    set({ isLoading: true, error: null });
    try {
      const shift = await shiftService.current();
      const transactions = await saleService.list(shift ? `shiftId=${encodeURIComponent(shift.id)}&limit=1000` : 'limit=200');
      set({ shift, transactions, hasHydrated: true, isLoading: false });
    } catch (error) {
      set({
        hasHydrated: true,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Data operasional tidak dapat dimuat.',
      });
      throw error;
    }
  },
  refreshShift: async () => {
    const shift = await shiftService.current();
    set({ shift });
    return shift;
  },
  refreshTransactions: async () => {
    const shift = get().shift;
    const transactions = await saleService.list(shift ? `shiftId=${encodeURIComponent(shift.id)}&limit=1000` : 'limit=200');
    set({ transactions });
  },
  openShift: async (openingCash, openingBankBalance, terminalId) => {
    const shift = await shiftService.open(openingCash, openingBankBalance, terminalId);
    set({ shift });
    return shift;
  },
  closeShift: async (closingCash) => {
    const current = get().shift;
    if (!current) throw new Error('Shift aktif tidak ditemukan.');
    const shift = await shiftService.close(current.id, closingCash);
    set({ shift });
    return shift;
  },
  addTransaction: (transaction) => set((state) => ({
    transactions: [transaction, ...state.transactions.filter((item) => item.id !== transaction.id)],
  })),
  refundTransaction: async (id, reason, managerPin) => {
    const transaction = await saleService.refund(id, reason, managerPin);
    set((state) => ({
      transactions: state.transactions.some((item) => item.id === id)
        ? state.transactions.map((item) => item.id === id ? transaction : item)
        : [transaction, ...state.transactions],
    }));
    return transaction;
  },
  reset: () => set({
    hasHydrated: false,
    isLoading: false,
    error: null,
    shift: null,
    transactions: [],
  }),
}));
