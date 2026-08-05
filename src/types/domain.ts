export type UserRole = 'cashier' | 'staff' | 'manager' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  outletId: string;
  outletName: string;
  taxRateBps: number;
  dineInServiceRateBps: number;
}

export interface Shift {
  id: string;
  openedAt: string;
  openingCash: number;
  openingBankBalance: number;
  status: 'open' | 'closed';
  cashierId: string;
  terminalId: string;
  closedAt?: string;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
}

export interface ShiftOpeningBalances {
  openingCash: number;
  openingBankBalance: number;
  sourceShiftId: string | null;
}

export type ExpenseFundingSource = 'bank' | 'cash';

export interface Expense {
  id: string;
  shiftId: string;
  name: string;
  amount: number;
  bankAmount: number;
  cashAmount: number;
  fundingSource: ExpenseFundingSource | 'mixed';
  status: 'active' | 'cancelled';
  createdAt: string;
  createdByName: string;
  cancelledAt?: string;
  cancelReason?: string;
  cancelledByName?: string;
}

export interface ExpenseOverview {
  expenses: Expense[];
  cashSales: number;
  nonCashSales: number;
  totalExpenses: number;
  bankExpenses: number;
  cashExpenses: number;
  bankBalance: number;
  cashBalance: number;
  totalBalance: number;
}

export type ProductCategory = string;

export interface ProductOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  resellerPrice: number | null;
  isResellerOnly: boolean;
  stock: number | null;
  trackInventory: boolean;
  lowStockThreshold: number;
  minimumOrderQuantity: number;
  piecesPerUnit: number;
  inventoryItemId?: string | null;
  inventoryItemName?: string | null;
  imageUrl?: string;
  color: string;
  accent: string;
  isFavorite?: boolean;
  isActive: boolean;
  sourceUrl?: string;
  sourceProductId?: string;
  sourceVariant?: string;
  sourcePackaging?: string;
  variants: ProductOption[];
  toppings: ProductOption[];
}

export interface InventoryItem {
  id: string;
  outletId: string;
  code: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  sortOrder: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  minimumOrderQuantity?: number;
  piecesPerUnit?: number;
  note?: string;
  selectedVariantIds?: string[];
  selectedVariantNames?: string[];
  /** Kompatibilitas dengan keranjang/transaksi versi lama. */
  selectedVariantId?: string;
  /** Kompatibilitas dengan keranjang/transaksi versi lama. */
  selectedVariantName?: string;
  selectedToppingIds?: string[];
  selectedToppingNames?: string[];
}

export type OrderType = 'takeaway' | 'dine_in' | 'delivery';
export type PaymentMethod = 'cash' | 'qris' | 'card' | 'transfer';
export type PricingMode = 'customer' | 'reseller';
export type TransactionStatus = 'pending' | 'paid' | 'refunded';

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  service: number;
  total: number;
}

export interface SaleRequest {
  idempotencyKey: string;
  shiftId: string;
  items: CartItem[];
  orderType: OrderType;
  paymentMethod?: PaymentMethod;
  deferPayment?: boolean;
  pricingMode: PricingMode;
  customerName?: string;
  notes?: string;
  voucherCode?: string;
  discount: number;
  amountPaid: number;
  totals: CartTotals;
}

export interface Transaction {
  id: string;
  shiftId: string;
  paymentShiftId?: string | null;
  receiptNo: string;
  createdAt: string;
  paidAt?: string | null;
  cashierName: string;
  customerName?: string;
  items: CartItem[];
  itemCount: number;
  pieceCount: number;
  paymentMethod: PaymentMethod | null;
  orderType: OrderType;
  pricingMode: PricingMode;
  status: TransactionStatus;
  subtotal: number;
  discount: number;
  tax: number;
  service: number;
  total: number;
  amountPaid: number;
  change: number;
  costPerItem: number;
  costOfGoodsSold: number;
  netProfit: number;
  netMarginPercent: number | null;
  syncStatus: 'synced';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type NotificationKind = 'sale_created' | 'stock_adjusted';
export type NotificationPushStatus = 'pending' | 'sent' | 'partial' | 'failed' | 'no_device';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  actorName: string;
  data: Record<string, unknown>;
  pushStatus: NotificationPushStatus;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
}

export type PushPermissionState = 'unknown' | 'registering' | 'granted' | 'denied' | 'unsupported' | 'error';

export interface PushTestResult {
  requestedDevices: number;
  acceptedDevices: number;
  failedDevices: number;
  message: string;
}
