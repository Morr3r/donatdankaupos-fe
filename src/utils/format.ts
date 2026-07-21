import type { CartItem, CartTotals, OrderType, PaymentMethod, PricingMode, Product } from '../types/domain';

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const compactNumber = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percentage = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
});

const dateTime = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const packageSizePattern = /\bIsi\s+(\d+)\b/i;

export const formatCurrency = (value: number) => currency.format(value);
export const formatCompact = (value: number) => compactNumber.format(value);
export const formatPercent = (value: number) => `${percentage.format(value)}%`;
export const formatDateTime = (value: string | Date) => dateTime.format(new Date(value));
export const numericInputDigits = (value: string | number) => String(value).replace(/\D/g, '');

export const formatNumericInput = (value: string | number) => {
  const digits = numericInputDigits(value);
  if (!digits) return '';
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseNumericInput = (value: string | number) => Number(numericInputDigits(value) || 0);
export const getProductPrice = (product: Product, pricingMode: PricingMode) =>
  pricingMode === 'reseller' ? product.resellerPrice ?? product.price : product.price;

export const resolvePiecesPerUnit = (explicitValue: number | null | undefined, ...labels: (string | null | undefined)[]) => {
  if (explicitValue && explicitValue >= 1) return Math.floor(explicitValue);
  const match = labels.filter(Boolean).join(' ').match(packageSizePattern);
  return match ? Math.max(1, Number(match[1])) : 1;
};

export const formatPackagingLabel = (packaging: string | null | undefined, piecesPerUnit: number) => {
  const cleanPackaging = packaging?.trim();
  if (!cleanPackaging) return piecesPerUnit > 1 ? `Isi ${piecesPerUnit} pcs` : '';
  return piecesPerUnit > 1 && !/\bpcs\b/i.test(cleanPackaging) ? `${cleanPackaging} pcs` : cleanPackaging;
};

export const formatClock = (value: string | Date) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export const getCartTotals = (
  items: CartItem[],
  discount: number,
  orderType: OrderType,
  dineInServiceRateBps: number,
): CartTotals => {
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const discountAmount = Math.min(Math.max(discount, 0), subtotal);
  const taxable = subtotal - discountAmount;
  const tax = 0;
  const service = orderType === 'dine_in' ? Math.round((taxable * dineInServiceRateBps) / 10_000) : 0;

  return {
    subtotal,
    discount: discountAmount,
    tax,
    service,
    total: taxable + tax + service,
  };
};

export const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  card: 'Kartu',
  transfer: 'Transfer',
};

export const orderTypeLabels: Record<OrderType, string> = {
  takeaway: 'Bawa pulang',
  dine_in: 'Makan di tempat',
  delivery: 'Delivery',
};

export const pricingModeLabels: Record<PricingMode, string> = {
  customer: 'Pelanggan',
  reseller: 'Reseller',
};

export const createLocalId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
};
