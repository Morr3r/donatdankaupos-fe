import type {
  LoginPayload,
  LoginResponse,
  Product,
  SaleRequest,
  Shift,
  ShiftOpeningBalances,
  Transaction,
  ProductOption,
  InventoryItem,
  ExpenseOverview,
  ExpenseFundingSource,
  NotificationFeed,
  PushTestResult,
} from '../types/domain';
import { apiFileRequest, apiRequest } from './client';

export const authService = {
  login: (payload: LoginPayload) => apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: payload }),
  refresh: (refreshToken: string) => apiRequest<LoginResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    skipAuthRefresh: true,
  }),
  logout: (refreshToken: string) => apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),
};

export interface ProductInput {
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  resellerPrice?: number | null;
  isResellerOnly?: boolean;
  stock?: number | null;
  trackInventory: boolean;
  lowStockThreshold?: number;
  minimumOrderQuantity?: number;
  piecesPerUnit?: number;
  inventoryItemId?: string | null;
  imageUrl?: string | null;
  color?: string;
  accent?: string;
  isFavorite?: boolean;
  isActive?: boolean;
  sourcePackaging?: string | null;
  variants?: ProductOption[];
  toppings?: ProductOption[];
}

export const catalogService = {
  list: () => apiRequest<Product[]>('/products?active=true'),
  categories: () => apiRequest<{ id: string; name: string; slug: string; sortOrder: number }[]>('/products/categories'),
  create: (payload: ProductInput) => apiRequest<Product>('/products', { method: 'POST', body: payload }),
  update: (id: string, payload: Partial<ProductInput>) => apiRequest<Product>(`/products/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => apiRequest<void>(`/products/${id}`, { method: 'DELETE' }),
};

export const saleService = {
  create: (payload: SaleRequest) => apiRequest<Transaction>('/sales', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': payload.idempotencyKey },
  }),
  list: (query = '') => apiRequest<Transaction[]>(`/sales${query ? `?${query}` : ''}`),
  get: (id: string) => apiRequest<Transaction>(`/sales/${id}`),
  refund: (id: string, reason: string, managerPin?: string) => apiRequest<Transaction>(`/sales/${id}/refunds`, {
    method: 'POST',
    body: { reason, managerPin },
  }),
  settle: (id: string, shiftId: string, paymentMethod: NonNullable<Transaction['paymentMethod']>, amountPaid: number) =>
    apiRequest<Transaction>(`/sales/${id}/settlement`, {
      method: 'POST',
      body: { shiftId, paymentMethod, amountPaid },
    }),
};

export const shiftService = {
  current: () => apiRequest<Shift | null>('/shifts/current'),
  nextOpeningBalances: (terminalId: string) => apiRequest<ShiftOpeningBalances>(`/shifts/opening-balances/next?terminalId=${encodeURIComponent(terminalId)}`),
  open: (openingCash: number, openingBankBalance: number, terminalId: string, carryOverBalances = true) => apiRequest<Shift>('/shifts', {
    method: 'POST',
    body: { carryOverBalances, openingBankBalance, openingCash, terminalId },
  }),
  updateOpeningBalances: (id: string, openingCash: number, openingBankBalance: number) =>
    apiRequest<Shift>(`/shifts/${id}/opening-balances`, {
      method: 'PATCH',
      body: { openingBankBalance, openingCash },
    }),
  close: (id: string, closingCash: number) => apiRequest<Shift>(`/shifts/${id}/close`, {
    method: 'POST',
    body: { closingCash },
  }),
};

export const expenseService = {
  list: (shiftId: string) => apiRequest<ExpenseOverview>(`/expenses?shiftId=${encodeURIComponent(shiftId)}`),
  create: (payload: { idempotencyKey: string; shiftId: string; name: string; amount: number; fundingSource: ExpenseFundingSource }) =>
    apiRequest<ExpenseOverview>('/expenses', {
      method: 'POST',
      body: payload,
      headers: { 'Idempotency-Key': payload.idempotencyKey },
    }),
  cancel: (id: string, reason: string) => apiRequest<ExpenseOverview>(`/expenses/${id}/cancellations`, {
    method: 'POST',
    body: { reason },
  }),
};

export const inventoryService = {
  list: () => apiRequest<InventoryItem[]>('/inventory-items'),
  adjust: (inventoryItemId: string, quantity: number, reason: string, mode: 'delta' | 'absolute' = 'absolute') =>
    apiRequest<InventoryItem>('/inventory-adjustments', {
      method: 'POST',
      body: { inventoryItemId, quantity, reason, mode },
    }),
};

export const notificationService = {
  list: (kind?: 'sale_created' | 'stock_adjusted') => apiRequest<NotificationFeed>(
    `/notifications?limit=100${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`,
  ),
  read: (id: string) => apiRequest<NotificationFeed['items'][number]>(`/notifications/${id}/read`, {
    method: 'POST',
  }),
  readAll: () => apiRequest<{ updatedCount: number; unreadCount: number }>('/notifications/read-all', {
    method: 'POST',
  }),
  registerDevice: (payload: { expoPushToken: string; platform: 'android' | 'ios'; deviceName?: string | null }) =>
    apiRequest<{ id: string; isActive: boolean }>('/notification-devices', { method: 'POST', body: payload }),
  unregisterDevice: (expoPushToken: string) => apiRequest<void>('/notification-devices/unregister', {
    method: 'POST',
    body: { expoPushToken },
  }),
  testPush: () => apiRequest<PushTestResult>('/notification-devices/test', { method: 'POST' }),
};

export interface SalesSummary {
  fromDate: string;
  toDate: string;
  revenue: number;
  transactionCount: number;
  itemCount: number;
  pieceCount: number;
  averageOrderValue: number;
  costPerItem: number;
  costOfGoodsSold: number;
  netProfit: number;
  netMarginPercent: number | null;
  previousPeriodGrowthPercent: number | null;
  series: { label: string; value: number }[];
  paymentBreakdown: { method: NonNullable<Transaction['paymentMethod']>; value: number; transactionCount: number }[];
  topProducts: { productId: string; name: string; sold: number; revenue: number }[];
}

export const reportService = {
  summary: (from: string, to: string) => apiRequest<SalesSummary>(
    `/reports/sales-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  ),
  exportXlsx: (from: string, to: string) => apiFileRequest(
    `/reports/sales-export.xlsx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  ),
};

export const healthService = {
  check: () => apiRequest<{ status: string; service: string; version: string; timestamp: string }>('/health', {
    timeoutMs: 15_000,
  }),
};
