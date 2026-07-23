import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import ThermalPrinterModule from '../../modules/thermal-printer/src/ThermalPrinterModule';
import type { ThermalPrinterDevice } from '../../modules/thermal-printer/src/ThermalPrinter.types';
import type { Transaction } from '../types/domain';
import { selectedOptionSummary } from './cartOptions';
import { formatDateTime, orderTypeLabels, paymentLabels, pricingModeLabels } from './format';

const PRINTER_STORAGE_KEY = 'donatdankau.thermal-printer.v1';
const RECEIPT_WIDTH = 32;
const RULE = '-'.repeat(RECEIPT_WIDTH);
const DOUBLE_RULE = '='.repeat(RECEIPT_WIDTH);
const TEAR_MARKER = '------- SOBEK DI SINI -------';

export type SavedThermalPrinter = ThermalPrinterDevice;

export class ThermalPrinterError extends Error {
  constructor(
    public readonly code:
      | 'android_only'
      | 'native_build_required'
      | 'permission_denied'
      | 'not_configured'
      | 'bluetooth_unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'ThermalPrinterError';
  }
}

export async function getSavedThermalPrinter(): Promise<SavedThermalPrinter | null> {
  const stored = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<SavedThermalPrinter>;
    if (typeof parsed.name === 'string' && typeof parsed.address === 'string') {
      return { name: parsed.name, address: parsed.address };
    }
  } catch {
    // Invalid or obsolete printer settings are cleared below.
  }

  await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
  return null;
}

export async function saveThermalPrinter(printer: SavedThermalPrinter): Promise<void> {
  await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(printer));
}

export async function clearSavedThermalPrinter(): Promise<void> {
  await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
}

export async function listPairedThermalPrinters(): Promise<ThermalPrinterDevice[]> {
  const module = await getReadyModule();
  await requestBluetoothConnectPermission();

  const enabled = await module.isBluetoothEnabledAsync();
  if (!enabled) {
    throw new ThermalPrinterError('bluetooth_unavailable', 'Bluetooth belum aktif. Aktifkan Bluetooth lalu coba lagi.');
  }

  return module.getPairedDevicesAsync();
}

export async function openBluetoothPrinterSettings(): Promise<void> {
  const module = await getReadyModule();
  await module.openBluetoothSettingsAsync();
}

export async function printThermalInvoice(transaction: Transaction): Promise<SavedThermalPrinter> {
  const printer = await getSavedThermalPrinter();
  if (!printer) {
    throw new ThermalPrinterError(
      'not_configured',
      'Printer belum dipilih. Buka Pengaturan > Printer invoice terlebih dahulu.',
    );
  }

  const module = await getReadyModule();
  await requestBluetoothConnectPermission();
  await module.printBase64Async(printer.address, bytesToBase64(buildInvoiceEscPosPayload(transaction)));
  return printer;
}

export async function printThermalTestPage(printer: SavedThermalPrinter): Promise<void> {
  const module = await getReadyModule();
  await requestBluetoothConnectPermission();
  await module.printBase64Async(printer.address, bytesToBase64(buildTestEscPosPayload(printer)));
}

export function buildInvoiceEscPosPayload(transaction: Transaction): Uint8Array {
  const bytes: number[] = [];
  appendReceiptCopy(bytes, transaction, 'KONSUMEN');
  appendManualTearMarker(bytes);
  appendReceiptCopy(bytes, transaction, 'TOKO');
  feed(bytes, 5);
  return Uint8Array.from(bytes);
}

function appendReceiptCopy(bytes: number[], transaction: Transaction, copyLabel: 'KONSUMEN' | 'TOKO') {
  command(bytes, 0x1b, 0x40); // Initialize printer.
  command(bytes, 0x1b, 0x74, 0x00); // Common CP437-compatible code page.
  setAlign(bytes, 1);
  setBold(bytes, true);
  setSize(bytes, 0x11);
  textLine(bytes, 'DONAT DANKAU');
  setSize(bytes, 0x00);
  textLine(bytes, `SALINAN ${copyLabel}`);
  setBold(bytes, false);
  textLine(bytes, DOUBLE_RULE);
  setAlign(bytes, 0);

  appendKeyValue(bytes, 'No.', transaction.receiptNo);
  appendKeyValue(bytes, 'Tanggal', formatDateTime(transaction.createdAt));
  appendKeyValue(bytes, 'Kasir', transaction.cashierName);
  appendKeyValue(bytes, 'Pelanggan', transaction.customerName ?? 'Pelanggan umum');
  textLine(bytes, RULE);

  transaction.items.forEach((item) => {
    wrapText(item.name, RECEIPT_WIDTH).forEach((line) => textLine(bytes, line));
    const optionSummary = selectedOptionSummary(item);
    if (optionSummary) {
      wrapText(`  ${optionSummary}`, RECEIPT_WIDTH).forEach((line) => textLine(bytes, line));
    }
    appendAmountRow(
      bytes,
      `${item.quantity} x ${formatReceiptMoney(item.price)}`,
      formatReceiptMoney(item.price * item.quantity),
    );
  });

  textLine(bytes, RULE);
  appendAmountRow(bytes, 'Subtotal', formatReceiptMoney(transaction.subtotal));
  if (transaction.discount > 0) appendAmountRow(bytes, 'Diskon', `-${formatReceiptMoney(transaction.discount)}`);
  if (transaction.tax > 0) appendAmountRow(bytes, 'Pajak', formatReceiptMoney(transaction.tax));
  if (transaction.service > 0) appendAmountRow(bytes, 'Biaya layanan', formatReceiptMoney(transaction.service));
  textLine(bytes, DOUBLE_RULE);
  setBold(bytes, true);
  setSize(bytes, 0x01);
  appendAmountRow(bytes, 'TOTAL', formatReceiptMoney(transaction.total));
  setSize(bytes, 0x00);
  setBold(bytes, false);
  textLine(bytes, DOUBLE_RULE);

  appendKeyValue(bytes, 'Metode', paymentLabels[transaction.paymentMethod]);
  appendKeyValue(bytes, 'Pesanan', orderTypeLabels[transaction.orderType]);
  appendKeyValue(bytes, 'Harga', pricingModeLabels[transaction.pricingMode]);
  if (transaction.paymentMethod === 'cash') {
    appendAmountRow(bytes, 'Uang diterima', formatReceiptMoney(transaction.amountPaid));
    appendAmountRow(bytes, 'Kembalian', formatReceiptMoney(transaction.change));
  }

  textLine(bytes, RULE);
  setAlign(bytes, 1);
  textLine(bytes, 'Terima kasih sudah berbelanja');
  textLine(bytes, 'di Donat Dankau.');
  setBold(bytes, true);
  textLine(bytes, `*** ${copyLabel} ***`);
  setBold(bytes, false);
}

function appendManualTearMarker(bytes: number[]) {
  feed(bytes, 2);
  setAlign(bytes, 1);
  setBold(bytes, true);
  textLine(bytes, TEAR_MARKER);
  setBold(bytes, false);
  feed(bytes, 2);
}

function buildTestEscPosPayload(printer: SavedThermalPrinter): Uint8Array {
  const bytes: number[] = [];
  command(bytes, 0x1b, 0x40);
  setAlign(bytes, 1);
  setBold(bytes, true);
  textLine(bytes, 'DONAT DANKAU POS');
  setBold(bytes, false);
  textLine(bytes, 'TES PRINTER THERMAL 58 MM');
  textLine(bytes, RULE);
  wrapText(printer.name, RECEIPT_WIDTH).forEach((line) => textLine(bytes, line));
  textLine(bytes, printer.address);
  textLine(bytes, '');
  textLine(bytes, 'Printer siap digunakan.');
  textLine(bytes, 'Invoice akan tercetak 2 salinan:');
  textLine(bytes, 'KONSUMEN dan TOKO.');
  textLine(bytes, '');
  textLine(bytes, 'Sobek manual pada penanda');
  textLine(bytes, 'di antara kedua salinan.');
  feed(bytes, 5);
  return Uint8Array.from(bytes);
}

function appendKeyValue(bytes: number[], label: string, value: string) {
  const normalizedLabel = normalizeText(label);
  const normalizedValue = normalizeText(value);
  const prefix = `${normalizedLabel}: `;
  const available = RECEIPT_WIDTH - prefix.length;
  const lines = wrapText(normalizedValue, Math.max(8, available));

  textLine(bytes, `${prefix}${lines[0] ?? ''}`);
  lines.slice(1).forEach((line) => textLine(bytes, `${' '.repeat(prefix.length)}${line}`));
}

function appendAmountRow(bytes: number[], label: string, amount: string) {
  const safeLabel = normalizeText(label);
  const safeAmount = normalizeText(amount);
  if (safeLabel.length + safeAmount.length + 1 <= RECEIPT_WIDTH) {
    textLine(bytes, `${safeLabel}${' '.repeat(RECEIPT_WIDTH - safeLabel.length - safeAmount.length)}${safeAmount}`);
    return;
  }

  wrapText(safeLabel, RECEIPT_WIDTH).forEach((line) => textLine(bytes, line));
  textLine(bytes, safeAmount.padStart(RECEIPT_WIDTH));
}

function formatReceiptMoney(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function wrapText(value: string, width: number): string[] {
  const normalized = normalizeText(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const lines: string[] = [];
  let remaining = normalized;
  while (remaining.length > width) {
    const candidate = remaining.slice(0, width + 1);
    const breakAt = candidate.lastIndexOf(' ');
    const splitAt = breakAt > 0 ? breakAt : width;
    lines.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function command(bytes: number[], ...values: number[]) {
  bytes.push(...values);
}

function setAlign(bytes: number[], alignment: 0 | 1 | 2) {
  command(bytes, 0x1b, 0x61, alignment);
}

function setBold(bytes: number[], enabled: boolean) {
  command(bytes, 0x1b, 0x45, enabled ? 1 : 0);
}

function setSize(bytes: number[], size: number) {
  command(bytes, 0x1d, 0x21, size);
}

function textLine(bytes: number[], value: string) {
  const sanitized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ');
  for (let index = 0; index < sanitized.length; index += 1) {
    bytes.push(sanitized.charCodeAt(index));
  }
  bytes.push(0x0a);
}

function feed(bytes: number[], lines: number) {
  command(bytes, 0x1b, 0x64, lines);
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;

    output += alphabet[(combined >> 18) & 63];
    output += alphabet[(combined >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(combined >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? alphabet[combined & 63] : '=';
  }

  return output;
}

async function getReadyModule() {
  if (Platform.OS !== 'android') {
    throw new ThermalPrinterError('android_only', 'Printer thermal hanya tersedia di aplikasi Android.');
  }
  if (!ThermalPrinterModule) {
    throw new ThermalPrinterError(
      'native_build_required',
      'Fitur printer membutuhkan build Android terbaru, bukan Expo Go.',
    );
  }
  if (!(await ThermalPrinterModule.isSupportedAsync())) {
    throw new ThermalPrinterError('bluetooth_unavailable', 'Bluetooth tidak tersedia pada perangkat ini.');
  }
  return ThermalPrinterModule;
}

async function requestBluetoothConnectPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return;

  const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
  if (await PermissionsAndroid.check(permission)) return;

  const result = await PermissionsAndroid.request(permission, {
    title: 'Izinkan akses printer Bluetooth',
    message: 'Donat Dankau POS memerlukan akses ke perangkat Bluetooth yang sudah dipasangkan untuk mencetak invoice.',
    buttonPositive: 'Izinkan',
    buttonNegative: 'Batal',
  });
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new ThermalPrinterError(
      'permission_denied',
      'Izin perangkat Bluetooth ditolak. Aktifkan izin Perangkat di pengaturan aplikasi.',
    );
  }
}
