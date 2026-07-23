import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import ThermalPrinterModule from '../../modules/thermal-printer/src/ThermalPrinterModule';
import type {
  ThermalPrinterDevice,
  UsbThermalPrinterDevice,
} from '../../modules/thermal-printer/src/ThermalPrinter.types';
import type { Transaction } from '../types/domain';
import { selectedOptionSummary } from './cartOptions';
import { formatDateTime, orderTypeLabels, paymentLabels, pricingModeLabels } from './format';

const PRINTER_STORAGE_KEY = 'donatdankau.thermal-printer.v2';
const LEGACY_PRINTER_STORAGE_KEY = 'donatdankau.thermal-printer.v1';
const PAPER_COLUMNS: Record<PrinterPaperWidth, number> = { 58: 32, 80: 48 };

export type PrinterConnectionType = 'bluetooth' | 'usb' | 'network';
export type PrinterPaperWidth = 58 | 80;

interface SavedPrinterBase {
  name: string;
  paperWidth: PrinterPaperWidth;
}

export interface SavedBluetoothPrinter extends SavedPrinterBase {
  connection: 'bluetooth';
  address: string;
}

export interface SavedUsbPrinter extends SavedPrinterBase {
  connection: 'usb';
  deviceId: number;
  vendorId: number;
  productId: number;
}

export interface SavedNetworkPrinter extends SavedPrinterBase {
  connection: 'network';
  host: string;
  port: number;
}

export type SavedThermalPrinter = SavedBluetoothPrinter | SavedUsbPrinter | SavedNetworkPrinter;

export class ThermalPrinterError extends Error {
  constructor(
    public readonly code:
      | 'android_only'
      | 'native_build_required'
      | 'permission_denied'
      | 'not_configured'
      | 'bluetooth_unavailable'
      | 'invalid_configuration',
    message: string,
  ) {
    super(message);
    this.name = 'ThermalPrinterError';
  }
}

export async function getSavedThermalPrinter(): Promise<SavedThermalPrinter | null> {
  const stored = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (isSavedThermalPrinter(parsed)) return parsed;
    } catch {
      // Invalid printer settings are cleared below.
    }
    await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
  }

  const legacyStored = await AsyncStorage.getItem(LEGACY_PRINTER_STORAGE_KEY);
  if (!legacyStored) return null;

  try {
    const parsed = JSON.parse(legacyStored) as Partial<ThermalPrinterDevice>;
    if (typeof parsed.name === 'string' && typeof parsed.address === 'string') {
      const migrated: SavedBluetoothPrinter = {
        connection: 'bluetooth',
        name: parsed.name,
        address: parsed.address,
        paperWidth: 58,
      };
      await saveThermalPrinter(migrated);
      return migrated;
    }
  } catch {
    // Invalid or obsolete printer settings are cleared below.
  }

  await AsyncStorage.removeItem(LEGACY_PRINTER_STORAGE_KEY);
  return null;
}

function isSavedThermalPrinter(value: unknown): value is SavedThermalPrinter {
  if (!value || typeof value !== 'object') return false;
  const printer = value as Record<string, unknown>;
  if (typeof printer.name !== 'string' || (printer.paperWidth !== 58 && printer.paperWidth !== 80)) return false;

  if (printer.connection === 'bluetooth') return typeof printer.address === 'string';
  if (printer.connection === 'usb') {
    return (
      typeof printer.deviceId === 'number' &&
      typeof printer.vendorId === 'number' &&
      typeof printer.productId === 'number'
    );
  }
  if (printer.connection === 'network') {
    return (
      typeof printer.host === 'string' &&
      typeof printer.port === 'number' &&
      printer.port >= 1 &&
      printer.port <= 65535
    );
  }
  return false;
}

export async function saveThermalPrinter(printer: SavedThermalPrinter): Promise<void> {
  await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(printer));
  await AsyncStorage.removeItem(LEGACY_PRINTER_STORAGE_KEY);
}

export async function clearSavedThermalPrinter(): Promise<void> {
  await AsyncStorage.multiRemove([PRINTER_STORAGE_KEY, LEGACY_PRINTER_STORAGE_KEY]);
}

export function bluetoothPrinterTarget(
  printer: ThermalPrinterDevice,
  paperWidth: PrinterPaperWidth,
): SavedBluetoothPrinter {
  return { connection: 'bluetooth', name: printer.name, address: printer.address, paperWidth };
}

export function usbPrinterTarget(
  printer: UsbThermalPrinterDevice,
  paperWidth: PrinterPaperWidth,
): SavedUsbPrinter {
  return {
    connection: 'usb',
    name: printer.name,
    deviceId: printer.deviceId,
    vendorId: printer.vendorId,
    productId: printer.productId,
    paperWidth,
  };
}

export function networkPrinterTarget(
  name: string,
  host: string,
  port: number,
  paperWidth: PrinterPaperWidth,
): SavedNetworkPrinter {
  const normalizedHost = host.trim();
  if (!normalizedHost || /\s/.test(normalizedHost) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ThermalPrinterError(
      'invalid_configuration',
      'Alamat printer wajib diisi dan port harus berupa angka 1-65535.',
    );
  }
  return {
    connection: 'network',
    name: name.trim() || `Printer ${normalizedHost}`,
    host: normalizedHost,
    port,
    paperWidth,
  };
}

export function printerConnectionLabel(printer: SavedThermalPrinter): string {
  if (printer.connection === 'bluetooth') return 'Bluetooth Classic';
  if (printer.connection === 'usb') return 'USB';
  return 'LAN / Wi-Fi';
}

export function printerConnectionDetail(printer: SavedThermalPrinter): string {
  if (printer.connection === 'bluetooth') return printer.address;
  if (printer.connection === 'usb') {
    return `USB ${toHexId(printer.vendorId)}:${toHexId(printer.productId)} · ID ${printer.deviceId}`;
  }
  return `${printer.host}:${printer.port}`;
}

function toHexId(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, '0');
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

export async function listUsbThermalPrinters(): Promise<UsbThermalPrinterDevice[]> {
  const module = await getReadyModule();
  return module.getUsbDevicesAsync();
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
  const payload = bytesToBase64(buildInvoiceEscPosPayload(transaction, printer.paperWidth));
  await sendPayload(module, printer, payload);
  return printer;
}

export async function printThermalTestPage(printer: SavedThermalPrinter): Promise<void> {
  const module = await getReadyModule();
  await sendPayload(module, printer, bytesToBase64(buildTestEscPosPayload(printer)));
}

async function sendPayload(
  module: NonNullable<typeof ThermalPrinterModule>,
  printer: SavedThermalPrinter,
  base64Payload: string,
): Promise<void> {
  if (printer.connection === 'bluetooth') {
    await requestBluetoothConnectPermission();
    await module.printBase64Async(printer.address, base64Payload);
    return;
  }
  if (printer.connection === 'usb') {
    await module.printUsbBase64Async(
      printer.deviceId,
      printer.vendorId,
      printer.productId,
      base64Payload,
    );
    return;
  }
  await module.printNetworkBase64Async(printer.host, printer.port, base64Payload);
}

export function buildInvoiceEscPosPayload(
  transaction: Transaction,
  paperWidth: PrinterPaperWidth = 58,
): Uint8Array {
  const receiptWidth = PAPER_COLUMNS[paperWidth];
  const bytes: number[] = [];
  appendReceiptCopy(bytes, transaction, 'KONSUMEN', receiptWidth);
  appendManualTearMarker(bytes, receiptWidth);
  appendReceiptCopy(bytes, transaction, 'TOKO', receiptWidth);
  feed(bytes, 5);
  return Uint8Array.from(bytes);
}

function appendReceiptCopy(
  bytes: number[],
  transaction: Transaction,
  copyLabel: 'KONSUMEN' | 'TOKO',
  receiptWidth: number,
) {
  const rule = '-'.repeat(receiptWidth);
  const doubleRule = '='.repeat(receiptWidth);
  command(bytes, 0x1b, 0x40); // Initialize printer.
  command(bytes, 0x1b, 0x74, 0x00); // Common CP437-compatible code page.
  setAlign(bytes, 1);
  setBold(bytes, true);
  setSize(bytes, 0x11);
  textLine(bytes, 'DONAT DANKAU');
  setSize(bytes, 0x00);
  textLine(bytes, `SALINAN ${copyLabel}`);
  setBold(bytes, false);
  textLine(bytes, doubleRule);
  setAlign(bytes, 0);

  appendKeyValue(bytes, 'No.', transaction.receiptNo, receiptWidth);
  appendKeyValue(bytes, 'Tanggal', formatDateTime(transaction.createdAt), receiptWidth);
  appendKeyValue(bytes, 'Kasir', transaction.cashierName, receiptWidth);
  appendKeyValue(bytes, 'Pelanggan', transaction.customerName ?? 'Pelanggan umum', receiptWidth);
  textLine(bytes, rule);

  transaction.items.forEach((item) => {
    wrapText(item.name, receiptWidth).forEach((line) => textLine(bytes, line));
    const optionSummary = selectedOptionSummary(item);
    if (optionSummary) {
      wrapText(`  ${optionSummary}`, receiptWidth).forEach((line) => textLine(bytes, line));
    }
    appendAmountRow(
      bytes,
      `${item.quantity} x ${formatReceiptMoney(item.price)}`,
      formatReceiptMoney(item.price * item.quantity),
      receiptWidth,
    );
  });

  textLine(bytes, rule);
  appendAmountRow(bytes, 'Subtotal', formatReceiptMoney(transaction.subtotal), receiptWidth);
  if (transaction.discount > 0) {
    appendAmountRow(bytes, 'Diskon', `-${formatReceiptMoney(transaction.discount)}`, receiptWidth);
  }
  if (transaction.tax > 0) appendAmountRow(bytes, 'Pajak', formatReceiptMoney(transaction.tax), receiptWidth);
  if (transaction.service > 0) {
    appendAmountRow(bytes, 'Biaya layanan', formatReceiptMoney(transaction.service), receiptWidth);
  }
  textLine(bytes, doubleRule);
  setBold(bytes, true);
  setSize(bytes, 0x01);
  appendAmountRow(bytes, 'TOTAL', formatReceiptMoney(transaction.total), receiptWidth);
  setSize(bytes, 0x00);
  setBold(bytes, false);
  textLine(bytes, doubleRule);

  appendKeyValue(bytes, 'Metode', paymentLabels[transaction.paymentMethod], receiptWidth);
  appendKeyValue(bytes, 'Pesanan', orderTypeLabels[transaction.orderType], receiptWidth);
  appendKeyValue(bytes, 'Harga', pricingModeLabels[transaction.pricingMode], receiptWidth);
  if (transaction.paymentMethod === 'cash') {
    appendAmountRow(bytes, 'Uang diterima', formatReceiptMoney(transaction.amountPaid), receiptWidth);
    appendAmountRow(bytes, 'Kembalian', formatReceiptMoney(transaction.change), receiptWidth);
  }

  textLine(bytes, rule);
  setAlign(bytes, 1);
  textLine(bytes, 'Terima kasih sudah berbelanja');
  textLine(bytes, 'di Donat Dankau.');
  setBold(bytes, true);
  textLine(bytes, `*** ${copyLabel} ***`);
  setBold(bytes, false);
}

function appendManualTearMarker(bytes: number[], receiptWidth: number) {
  feed(bytes, 2);
  setAlign(bytes, 1);
  setBold(bytes, true);
  textLine(bytes, centerText('SOBEK DI SINI', receiptWidth, '-'));
  setBold(bytes, false);
  feed(bytes, 2);
}

function buildTestEscPosPayload(printer: SavedThermalPrinter): Uint8Array {
  const receiptWidth = PAPER_COLUMNS[printer.paperWidth];
  const rule = '-'.repeat(receiptWidth);
  const bytes: number[] = [];
  command(bytes, 0x1b, 0x40);
  setAlign(bytes, 1);
  setBold(bytes, true);
  textLine(bytes, 'DONAT DANKAU POS');
  setBold(bytes, false);
  textLine(bytes, `TES PRINTER ESC/POS ${printer.paperWidth} MM`);
  textLine(bytes, rule);
  wrapText(printer.name, receiptWidth).forEach((line) => textLine(bytes, line));
  textLine(bytes, printerConnectionLabel(printer));
  wrapText(printerConnectionDetail(printer), receiptWidth).forEach((line) => textLine(bytes, line));
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

function appendKeyValue(bytes: number[], label: string, value: string, receiptWidth: number) {
  const normalizedLabel = normalizeText(label);
  const normalizedValue = normalizeText(value);
  const prefix = `${normalizedLabel}: `;
  const available = receiptWidth - prefix.length;
  const lines = wrapText(normalizedValue, Math.max(8, available));

  textLine(bytes, `${prefix}${lines[0] ?? ''}`);
  lines.slice(1).forEach((line) => textLine(bytes, `${' '.repeat(prefix.length)}${line}`));
}

function appendAmountRow(bytes: number[], label: string, amount: string, receiptWidth: number) {
  const safeLabel = normalizeText(label);
  const safeAmount = normalizeText(amount);
  if (safeLabel.length + safeAmount.length + 1 <= receiptWidth) {
    textLine(bytes, `${safeLabel}${' '.repeat(receiptWidth - safeLabel.length - safeAmount.length)}${safeAmount}`);
    return;
  }

  wrapText(safeLabel, receiptWidth).forEach((line) => textLine(bytes, line));
  textLine(bytes, safeAmount.padStart(receiptWidth));
}

function centerText(value: string, width: number, fill: string): string {
  const safeValue = ` ${normalizeText(value)} `;
  if (safeValue.length >= width) return safeValue.slice(0, width);
  const remaining = width - safeValue.length;
  const left = Math.floor(remaining / 2);
  return `${fill.repeat(left)}${safeValue}${fill.repeat(remaining - left)}`;
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
