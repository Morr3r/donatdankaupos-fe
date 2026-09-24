export type UserRole = 'cashier' | 'staff' | 'manager' | 'owner';

export type CatalogViewMode =
  | 'extra-large-icons'
  | 'large-icons'
  | 'medium-icons'
  | 'small-icons'
  | 'list'
  | 'details'
  | 'tiles'
  | 'content';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  outletId: string;
  outletName: string;
  taxRateBps: number;
  dineInServiceRateBps: number;
  avatarUpdatedAt?: string | null;
}

export interface ProfileUpdatePayload {
  name: string;
  avatar?: {
    data: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  } | null;
  removeAvatar?: boolean;
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

export interface ExpenseRangeOverview {
  fromDate: string;
  toDate: string;
  expenses: Expense[];
  expenseCount: number;
  totalExpenses: number;
  bankExpenses: number;
  cashExpenses: number;
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
  deliveryFee: number;
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
  discount: number;
  deliveryFee: number;
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
  deliveryFee: number;
  tax: number;
  service: number;
  total: number;
  amountPaid: number;
  change: number;
  costPerItem: number;
  productionCost?: number;
  fixedCostAllocation?: number;
  costOfGoodsSold: number;
  netProfit: number;
  netMarginPercent: number | null;
  syncStatus: 'synced';
}

export type ChatTransactionReceipt = Omit<
  Transaction,
  'costPerItem' | 'productionCost' | 'fixedCostAllocation' | 'costOfGoodsSold' | 'netProfit' | 'netMarginPercent'
>;

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


export type ChatConversationKind = 'direct' | 'group';
export type ChatMessageKind = 'text' | 'image' | 'audio' | 'transaction' | 'system';
export type ChatMemberRole = 'member' | 'admin';
/** Lifecycle of a message the device is still trying to hand to the server. */
export type ChatOutboxStatus = 'sending' | 'failed';

export interface ChatContact {
  id: string;
  name: string;
  role: UserRole;
  outletId: string;
  outletName: string;
  initials: string;
  accent: string;
  isOnline: boolean;
  lastSeenAt?: string | null;
  avatarUpdatedAt?: string | null;
  conversationId?: string | null;
}

export interface ChatMember {
  userId: string;
  name: string;
  role: UserRole;
  memberRole: ChatMemberRole;
  outletName: string;
  initials: string;
  accent: string;
  lastReadSeq: number;
  lastDeliveredSeq: number;
  isOnline: boolean;
  isTyping: boolean;
  lastSeenAt?: string | null;
  avatarUpdatedAt?: string | null;
  leftAt?: string | null;
}

export interface ChatAttachmentMeta {
  id: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  thumbnail?: string | null;
}

export interface ChatAttachmentPayload extends ChatAttachmentMeta {
  data: string;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
  reactedByMe: boolean;
}

export interface ChatReplyPreview {
  id: string;
  seq: number;
  senderName: string;
  kind: ChatMessageKind;
  preview: string;
  isDeleted: boolean;
}

export interface ChatTransactionSummary {
  id: string;
  receiptNo: string;
  createdAt: string;
  cashierName: string;
  customerName?: string | null;
  itemCount: number;
  pieceCount: number;
  total: number;
  status: TransactionStatus;
  paymentMethod: PaymentMethod | null;
  orderType: OrderType;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  seq: number;
  senderId?: string | null;
  senderName: string;
  kind: ChatMessageKind;
  body: string;
  clientMessageId?: string | null;
  replyTo?: ChatReplyPreview | null;
  attachment?: ChatAttachmentMeta | null;
  transaction?: ChatTransactionSummary | null;
  reactions: ChatReaction[];
  systemData: Record<string, unknown>;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  readByCount: number;
  isReadByAll: boolean;
  deliveredToCount: number;
  isDeliveredToAll: boolean;
  /** Present only while the message lives in the local outbox. */
  outboxStatus?: ChatOutboxStatus;
  /** Local preview URI so an image renders before the upload finishes. */
  localImageUri?: string;
  /** Local URI so a freshly recorded VN can be played while it uploads. */
  localAudioUri?: string;
}

export interface ChatConversation {
  id: string;
  kind: ChatConversationKind;
  title: string;
  subtitle: string;
  description?: string | null;
  accent: string;
  initials: string;
  counterpartId?: string | null;
  counterpartRole?: UserRole | null;
  avatarUserId?: string | null;
  avatarUpdatedAt?: string | null;
  lastSeenAt?: string | null;
  memberCount: number;
  members: ChatMember[];
  myMemberRole: ChatMemberRole;
  lastSeq: number;
  lastReadSeq: number;
  unreadCount: number;
  lastMessage?: ChatMessage | null;
  lastMessageAt?: string | null;
  isOnline: boolean;
  typingNames: string[];
  mutedUntil?: string | null;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
}

export interface ChatConversationList {
  items: ChatConversation[];
  totalUnread: number;
  cursor: string;
}

export interface ChatMessagePage {
  items: ChatMessage[];
  hasMoreBefore: boolean;
  oldestSeq?: number | null;
  latestSeq?: number | null;
}

export interface ChatSyncResult {
  cursor: string;
  conversations: ChatConversation[];
  messages: ChatMessage[];
  removedConversationIds: string[];
  totalUnread: number;
  serverTime: string;
}

export interface ChatSearchHit {
  conversationId: string;
  conversationTitle: string;
  accent: string;
  initials: string;
  message: ChatMessage;
}

export interface ChatAttachmentUpload {
  data: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  thumbnail?: string | null;
}

export interface ChatSendPayload {
  body: string;
  clientMessageId: string;
  replyToId?: string | null;
  attachment?: ChatAttachmentUpload | null;
  transactionId?: string | null;
}
