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
  Expense,
  ExpenseOverview,
  ExpenseRangeOverview,
  ExpenseFundingSource,
  NotificationFeed,
  PushTestResult,
  ChatContact,
  ChatConversation,
  ChatConversationKind,
  ChatConversationList,
  ChatMessage,
  ChatMessagePage,
  ChatSendPayload,
  ChatSyncResult,
  ChatSearchHit,
  ChatAttachmentPayload,
  ChatTransactionReceipt,
  ProfileUpdatePayload,
  User,
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
  updateProfile: (payload: ProfileUpdatePayload) => apiRequest<User>('/auth/me', { method: 'PATCH', body: payload, timeoutMs: 45_000 }),
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
  current: (terminalId?: string) => apiRequest<Shift | null>(
    `/shifts/current${terminalId ? `?terminalId=${encodeURIComponent(terminalId)}` : ''}`,
  ),
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
  listRange: (from: string, to: string) => apiRequest<ExpenseRangeOverview>(`/expenses/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  create: (payload: { idempotencyKey: string; shiftId: string; name: string; amount: number; fundingSource: ExpenseFundingSource }) =>
    apiRequest<ExpenseOverview>('/expenses', {
      method: 'POST',
      body: payload,
      headers: { 'Idempotency-Key': payload.idempotencyKey },
    }),
  update: (id: string, payload: { name: string; amount: number; fundingSource: ExpenseFundingSource }) =>
    apiRequest<Expense>(`/expenses/${id}`, {
      method: 'PATCH',
      body: payload,
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
  productionCost: number;
  costOfGoodsSold: number;
  contributionMargin: number;
  contributionMarginPercent: number | null;
  monthlyFixedCost: number;
  periodFixedCost: number;
  boxCount: number;
  fixedCostPerBox: number | null;
  netBusinessProfit: number;
  netBusinessMarginPercent: number | null;
  baselineTargetBoxes: number;
  recommendedTargetBoxesMin: number;
  recommendedTargetBoxesMax: number;
  /** Kompatibilitas API lama; gunakan netBusinessProfit. */
  netProfit: number;
  netMarginPercent: number | null;
  previousPeriodGrowthPercent: number | null;
  totalExpenses: number;
  expenseCount: number;
  cashExpenses: number;
  bankExpenses: number;
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


export const chatService = {
  contacts: (query?: string) => apiRequest<{ items: ChatContact[] }>(
    `/chat/contacts${query ? `?query=${encodeURIComponent(query)}` : ''}`,
  ),
  conversations: (archived = false) => apiRequest<ChatConversationList>(
    `/chat/conversations${archived ? '?archived=true' : ''}`,
  ),
  createConversation: (payload: { kind: ChatConversationKind; memberIds: string[]; title?: string; description?: string }) =>
    apiRequest<ChatConversation>('/chat/conversations', { method: 'POST', body: payload }),
  conversation: (id: string) => apiRequest<ChatConversation>(`/chat/conversations/${id}`),
  updateConversation: (id: string, payload: { title?: string; description?: string }) =>
    apiRequest<ChatConversation>(`/chat/conversations/${id}`, { method: 'PATCH', body: payload }),
  addMembers: (id: string, memberIds: string[]) =>
    apiRequest<ChatConversation>(`/chat/conversations/${id}/members`, { method: 'POST', body: { memberIds } }),
  removeMember: (id: string, userId: string) =>
    apiRequest<{ ok: boolean }>(`/chat/conversations/${id}/members/${userId}`, { method: 'DELETE' }),
  leave: (id: string) => apiRequest<{ ok: boolean }>(`/chat/conversations/${id}/leave`, { method: 'POST' }),
  setState: (id: string, payload: { isMuted?: boolean; isPinned?: boolean; isArchived?: boolean }) =>
    apiRequest<ChatConversation>(`/chat/conversations/${id}/state`, { method: 'PATCH', body: payload }),
  markRead: (id: string, seq: number) =>
    apiRequest<ChatConversation>(`/chat/conversations/${id}/read`, { method: 'POST', body: { seq } }),
  setTyping: (id: string) =>
    apiRequest<{ ok: boolean }>(`/chat/conversations/${id}/typing`, { method: 'POST' }),
  clearHistory: (id: string) =>
    apiRequest<{ ok: boolean }>(`/chat/conversations/${id}/clear`, { method: 'POST' }),
  messages: (id: string, params: { beforeSeq?: number; afterSeq?: number; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.beforeSeq !== undefined) search.set('before_seq', String(params.beforeSeq));
    if (params.afterSeq !== undefined) search.set('after_seq', String(params.afterSeq));
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const suffix = search.toString();
    return apiRequest<ChatMessagePage>(`/chat/conversations/${id}/messages${suffix ? `?${suffix}` : ''}`);
  },
  send: (id: string, payload: ChatSendPayload) => apiRequest<ChatMessage>(
    `/chat/conversations/${id}/messages`,
    // Image uploads carry a base64 blob, so they need more headroom than a text send.
    { method: 'POST', body: payload, timeoutMs: payload.attachment ? 45_000 : 12_000 },
  ),
  edit: (messageId: string, body: string) =>
    apiRequest<ChatMessage>(`/chat/messages/${messageId}`, { method: 'PATCH', body: { body } }),
  remove: (messageId: string) =>
    apiRequest<ChatMessage>(`/chat/messages/${messageId}`, { method: 'DELETE' }),
  forward: (messageId: string, targetConversationIds: string[], clientMessageId: string) =>
    apiRequest<{ items: ChatMessage[] }>(`/chat/messages/${messageId}/forward`, {
      method: 'POST',
      body: { targetConversationIds, clientMessageId },
      timeoutMs: 45_000,
    }),
  react: (messageId: string, emoji: string) =>
    apiRequest<ChatMessage>(`/chat/messages/${messageId}/reactions`, { method: 'POST', body: { emoji } }),
  attachment: (attachmentId: string) =>
    apiRequest<ChatAttachmentPayload>(`/chat/attachments/${attachmentId}`, { timeoutMs: 45_000 }),
  transaction: (messageId: string) =>
    apiRequest<ChatTransactionReceipt>(`/chat/messages/${messageId}/transaction`),
  sync: (cursor?: string | null) => apiRequest<ChatSyncResult>(
    `/chat/sync${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  ),
  search: (query: string) => apiRequest<{ items: ChatSearchHit[] }>(
    `/chat/search?query=${encodeURIComponent(query)}`,
  ),
};
