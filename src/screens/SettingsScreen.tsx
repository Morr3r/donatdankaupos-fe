import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bluetooth, Printer, RefreshCw, Server, ShieldCheck, TabletSmartphone, Trash2, Wifi } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type {
  ThermalPrinterDevice,
  UsbThermalPrinterDevice,
} from '../../modules/thermal-printer/src/ThermalPrinter.types';
import { TERMINAL_ID } from '../api/client';
import { healthService } from '../api/services';
import { Button, Chip, Field, GlassCard, Header, ScalePressable, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { palette, radius, spacing, type } from '../theme/tokens';
import {
  bluetoothPrinterTarget,
  clearSavedThermalPrinter,
  getSavedThermalPrinter,
  listPairedThermalPrinters,
  listUsbThermalPrinters,
  networkPrinterTarget,
  openBluetoothPrinterSettings,
  printerConnectionDetail,
  printerConnectionLabel,
  printThermalTestPage,
  saveThermalPrinter,
  usbPrinterTarget,
  type PrinterConnectionType,
  type PrinterPaperWidth,
  type SavedThermalPrinter,
} from '../utils/thermal-printer';

type ServerStatus = 'unknown' | 'checking' | 'online' | 'offline';
type PrinterStatus = 'idle' | 'loading' | 'testing' | 'saving';

const connectionOptions: Array<{ id: PrinterConnectionType; label: string }> = [
  { id: 'bluetooth', label: 'Bluetooth' },
  { id: 'usb', label: 'USB' },
  { id: 'network', label: 'LAN / Wi-Fi' },
];

export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Settings'>) {
  const [serverStatus, setServerStatus] = useState<ServerStatus>('unknown');
  const [serverMessage, setServerMessage] = useState('Belum diperiksa');
  const [savedPrinter, setSavedPrinter] = useState<SavedThermalPrinter | null>(null);
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>('bluetooth');
  const [paperWidth, setPaperWidth] = useState<PrinterPaperWidth>(58);
  const [pairedPrinters, setPairedPrinters] = useState<ThermalPrinterDevice[]>([]);
  const [usbPrinters, setUsbPrinters] = useState<UsbThermalPrinterDevice[]>([]);
  const [networkName, setNetworkName] = useState('');
  const [networkHost, setNetworkHost] = useState('');
  const [networkPort, setNetworkPort] = useState('9100');
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>('idle');
  const [printerMessage, setPrinterMessage] = useState(
    Platform.OS === 'android'
      ? 'Pilih jenis koneksi dan printer ESC/POS yang akan digunakan.'
      : 'Konfigurasi printer thermal tersedia di aplikasi Android.',
  );
  const [printerTone, setPrinterTone] = useState<'neutral' | 'success' | 'danger'>('neutral');

  useEffect(() => {
    getSavedThermalPrinter()
      .then((printer) => {
        setSavedPrinter(printer);
        if (!printer) return;
        setConnectionType(printer.connection);
        setPaperWidth(printer.paperWidth);
        if (printer.connection === 'network') {
          setNetworkName(printer.name);
          setNetworkHost(printer.host);
          setNetworkPort(String(printer.port));
        }
        setPrinterMessage(
          `${printer.name} siap melalui ${printerConnectionLabel(printer)} untuk kertas ${printer.paperWidth} mm.`,
        );
        setPrinterTone('success');
      })
      .catch(() => {
        setPrinterMessage('Pengaturan printer belum dapat dimuat.');
        setPrinterTone('danger');
      });
  }, []);

  const testConnection = async () => {
    setServerStatus('checking');
    setServerMessage('Memeriksa koneksi...');
    try {
      const health = await healthService.check();
      setServerStatus('online');
      setServerMessage(`Siap digunakan · diperiksa ${new Date(health.timestamp).toLocaleString('id-ID')}`);
    } catch (error) {
      setServerStatus('offline');
      setServerMessage(error instanceof Error ? error.message : 'Layanan tidak dapat dijangkau.');
    }
  };

  const persistPrinter = async (printer: SavedThermalPrinter) => {
    setPrinterStatus('saving');
    setPrinterTone('neutral');
    setPrinterMessage(`Menyimpan ${printer.name}...`);
    try {
      await saveThermalPrinter(printer);
      setSavedPrinter(printer);
      setPaperWidth(printer.paperWidth);
      setPrinterMessage(
        `${printer.name} dipilih melalui ${printerConnectionLabel(printer)}. Cetak halaman tes sebelum digunakan.`,
      );
      setPrinterTone('success');
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Printer belum dapat disimpan.');
      setPrinterTone('danger');
    } finally {
      setPrinterStatus('idle');
    }
  };

  const loadPairedPrinters = async () => {
    if (printerStatus !== 'idle') return;
    setPrinterStatus('loading');
    setPrinterTone('neutral');
    setPrinterMessage('Memuat perangkat Bluetooth yang sudah dipasangkan...');
    try {
      const devices = await listPairedThermalPrinters();
      setPairedPrinters(devices);
      if (devices.length === 0) {
        setPrinterMessage('Belum ada perangkat. Pasangkan printer dari pengaturan Bluetooth Android.');
        setPrinterTone('danger');
      } else {
        setPrinterMessage(`Ditemukan ${devices.length} perangkat. Pilih printer ESC/POS Bluetooth Classic.`);
      }
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Daftar perangkat Bluetooth belum dapat dimuat.');
      setPrinterTone('danger');
    } finally {
      setPrinterStatus('idle');
    }
  };

  const loadUsbPrinters = async () => {
    if (printerStatus !== 'idle') return;
    setPrinterStatus('loading');
    setPrinterTone('neutral');
    setPrinterMessage('Mendeteksi perangkat USB yang tersambung...');
    try {
      const devices = await listUsbThermalPrinters();
      setUsbPrinters(devices);
      if (devices.length === 0) {
        setPrinterMessage('Belum ada perangkat USB. Sambungkan printer dengan kabel/adapter OTG lalu muat ulang.');
        setPrinterTone('danger');
      } else {
        setPrinterMessage(`Ditemukan ${devices.length} perangkat USB. Pilih printer ESC/POS.`);
      }
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Daftar perangkat USB belum dapat dimuat.');
      setPrinterTone('danger');
    } finally {
      setPrinterStatus('idle');
    }
  };

  const saveNetworkPrinter = async () => {
    try {
      const printer = networkPrinterTarget(networkName, networkHost, Number(networkPort), paperWidth);
      await persistPrinter(printer);
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Konfigurasi printer jaringan tidak valid.');
      setPrinterTone('danger');
    }
  };

  const changePaperWidth = async (width: PrinterPaperWidth) => {
    setPaperWidth(width);
    if (!savedPrinter || savedPrinter.paperWidth === width) return;
    const updated = { ...savedPrinter, paperWidth: width } as SavedThermalPrinter;
    try {
      await saveThermalPrinter(updated);
      setSavedPrinter(updated);
      setPrinterMessage(`Lebar kertas ${width} mm disimpan untuk ${updated.name}.`);
      setPrinterTone('success');
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Lebar kertas belum dapat disimpan.');
      setPrinterTone('danger');
    }
  };

  const testPrinter = async () => {
    if (!savedPrinter || printerStatus !== 'idle') return;
    setPrinterStatus('testing');
    setPrinterTone('neutral');
    setPrinterMessage(`Mengirim halaman tes ke ${savedPrinter.name}...`);
    try {
      await printThermalTestPage(savedPrinter);
      setPrinterMessage('Halaman tes berhasil dikirim. Printer siap digunakan.');
      setPrinterTone('success');
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Halaman tes belum dapat dicetak.');
      setPrinterTone('danger');
    } finally {
      setPrinterStatus('idle');
    }
  };

  const forgetPrinter = async () => {
    await clearSavedThermalPrinter();
    setSavedPrinter(null);
    setPrinterMessage('Pilihan printer dihapus. Pilih perangkat sebelum mencetak invoice.');
    setPrinterTone('neutral');
  };

  const openBluetoothSettings = async () => {
    try {
      await openBluetoothPrinterSettings();
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Pengaturan Bluetooth belum dapat dibuka.');
      setPrinterTone('danger');
    }
  };

  return (
    <Screen bottomInset={spacing.xl}>
      <Header onBack={navigation.goBack} subtitle="Kesiapan perangkat dan keamanan akun" title="Pengaturan" />

      <SectionHeader title="Koneksi" />
      <GlassCard contentStyle={styles.card}>
        <View style={styles.cardHeading}><View style={styles.headingIcon}><Server color={palette.cocoa} size={22} /></View><View style={styles.headingCopy}><Text style={styles.cardTitle}>Layanan kasir</Text><Text style={styles.cardSubtitle}>Periksa sebelum mulai berjualan</Text></View><StatusPill label={serverStatus === 'online' ? 'Siap' : serverStatus === 'offline' ? 'Terputus' : serverStatus === 'checking' ? 'Memeriksa' : 'Belum diperiksa'} tone={serverStatus === 'online' ? 'success' : serverStatus === 'offline' ? 'danger' : 'warning'} /></View>
        <Text style={styles.helper}>{serverMessage}</Text>
        <Button icon={Wifi} label="Periksa koneksi" loading={serverStatus === 'checking'} onPress={testConnection} variant="secondary" />
      </GlassCard>

      <SectionHeader title="Perangkat" />
      <GlassCard contentStyle={styles.card}>
        <View style={styles.deviceRow}><View style={styles.deviceIcon}><TabletSmartphone color={palette.info} size={23} /></View><View style={styles.deviceCopy}><Text style={styles.deviceName}>Perangkat kasir</Text><Text style={styles.deviceMeta}>{TERMINAL_ID || 'Belum diberi identitas perangkat'}</Text></View><StatusPill label={TERMINAL_ID ? 'Siap' : 'Perlu disiapkan'} tone={TERMINAL_ID ? 'success' : 'warning'} /></View>
      </GlassCard>

      <SectionHeader title="Printer invoice" />
      <GlassCard contentStyle={styles.card}>
        <View style={styles.cardHeading}>
          <View style={styles.printerIcon}><Printer color={palette.cocoa} size={23} /></View>
          <View style={styles.headingCopy}>
            <Text style={styles.cardTitle}>{savedPrinter?.name ?? 'Printer ESC/POS'}</Text>
            <Text style={styles.cardSubtitle}>
              {savedPrinter
                ? `${printerConnectionLabel(savedPrinter)} · ${savedPrinter.paperWidth} mm · 2 salinan`
                : 'Bluetooth, USB, atau LAN/Wi-Fi · 58/80 mm'}
            </Text>
          </View>
          <StatusPill label={savedPrinter ? 'Dipilih' : 'Belum dipilih'} tone={savedPrinter ? 'success' : 'warning'} />
        </View>

        {savedPrinter ? <Text selectable style={styles.printerAddress}>{printerConnectionDetail(savedPrinter)}</Text> : null}
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.helper,
            printerTone === 'success' && styles.printerMessageSuccess,
            printerTone === 'danger' && styles.printerMessageDanger,
          ]}
        >
          {printerMessage}
        </Text>

        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>Jenis koneksi</Text>
          <View style={styles.chipRow}>
            {connectionOptions.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                onPress={() => setConnectionType(option.id)}
                selected={connectionType === option.id}
              />
            ))}
          </View>
        </View>

        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>Lebar kertas</Text>
          <View style={styles.chipRow}>
            <Chip label="58 mm" onPress={() => changePaperWidth(58)} selected={paperWidth === 58} />
            <Chip label="80 mm" onPress={() => changePaperWidth(80)} selected={paperWidth === 80} />
          </View>
        </View>

        {connectionType === 'bluetooth' ? (
          <>
            <Text style={styles.helper}>Kompatibel dengan printer ESC/POS Bluetooth Classic/SPP. Pasangkan printer terlebih dahulu di Android.</Text>
            <Button
              icon={RefreshCw}
              label="Muat perangkat Bluetooth"
              loading={printerStatus === 'loading'}
              onPress={loadPairedPrinters}
              variant="secondary"
            />
            <Button icon={Bluetooth} label="Buka pengaturan Bluetooth" onPress={openBluetoothSettings} variant="ghost" />

            {pairedPrinters.length > 0 ? (
              <View style={styles.printerList}>
                {pairedPrinters.map((printer) => {
                  const selected = savedPrinter?.connection === 'bluetooth' && savedPrinter.address === printer.address;
                  return (
                    <ScalePressable
                      key={printer.address}
                      accessibilityLabel={`Pilih printer ${printer.name}`}
                      accessibilityState={{ selected }}
                      onPress={() => persistPrinter(bluetoothPrinterTarget(printer, paperWidth))}
                      style={[styles.printerRow, selected && styles.printerRowSelected]}
                    >
                      <View style={[styles.connectionIcon, selected && styles.connectionIconSelected]}>
                        <Bluetooth color={selected ? palette.success : palette.info} size={20} />
                      </View>
                      <View style={styles.deviceCopy}>
                        <Text style={styles.deviceName}>{printer.name}</Text>
                        <Text selectable style={styles.deviceMeta}>{printer.address}</Text>
                      </View>
                      {selected ? <StatusPill label="Aktif" tone="success" /> : null}
                    </ScalePressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}

        {connectionType === 'usb' ? (
          <>
            <Text style={styles.helper}>Sambungkan printer ESC/POS ke perangkat Android memakai USB atau adapter OTG. Izin USB diminta saat tes/cetak pertama.</Text>
            <Button
              icon={RefreshCw}
              label="Muat perangkat USB"
              loading={printerStatus === 'loading'}
              onPress={loadUsbPrinters}
              variant="secondary"
            />
            {usbPrinters.length > 0 ? (
              <View style={styles.printerList}>
                {usbPrinters.map((printer) => {
                  const selected = savedPrinter?.connection === 'usb' && savedPrinter.deviceId === printer.deviceId;
                  const usbId = `${printer.vendorId.toString(16).toUpperCase().padStart(4, '0')}:${printer.productId.toString(16).toUpperCase().padStart(4, '0')}`;
                  return (
                    <ScalePressable
                      key={printer.deviceId}
                      accessibilityLabel={`Pilih printer ${printer.name}`}
                      accessibilityState={{ selected }}
                      onPress={() => persistPrinter(usbPrinterTarget(printer, paperWidth))}
                      style={[styles.printerRow, selected && styles.printerRowSelected]}
                    >
                      <View style={[styles.connectionIcon, selected && styles.connectionIconSelected]}>
                        <Printer color={selected ? palette.success : palette.info} size={20} />
                      </View>
                      <View style={styles.deviceCopy}>
                        <Text style={styles.deviceName}>{printer.name}</Text>
                        <Text selectable style={styles.deviceMeta}>USB {usbId} · ID {printer.deviceId}</Text>
                      </View>
                      {selected ? <StatusPill label="Aktif" tone="success" /> : null}
                    </ScalePressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}

        {connectionType === 'network' ? (
          <View style={styles.networkFields}>
            <Text style={styles.helper}>Masukkan IP/hostname printer ESC/POS di jaringan yang sama. Port raw printing umumnya 9100.</Text>
            <Field
              autoCapitalize="words"
              label="Nama printer (opsional)"
              onChangeText={setNetworkName}
              placeholder="Printer kasir"
              value={networkName}
            />
            <Field
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              label="Alamat IP atau hostname"
              onChangeText={setNetworkHost}
              placeholder="192.168.1.50"
              value={networkHost}
            />
            <Field
              keyboardType="number-pad"
              label="Port"
              maxLength={5}
              onChangeText={setNetworkPort}
              placeholder="9100"
              value={networkPort}
            />
            <Button
              icon={Wifi}
              label="Simpan printer jaringan"
              loading={printerStatus === 'saving'}
              onPress={saveNetworkPrinter}
              variant="secondary"
            />
          </View>
        ) : null}

        {savedPrinter ? (
          <>
            <Button icon={Printer} label="Cetak halaman tes" loading={printerStatus === 'testing'} onPress={testPrinter} />
            <Button icon={Trash2} label="Hapus pilihan printer" onPress={forgetPrinter} variant="ghost" />
          </>
        ) : null}

        <Text style={styles.compatibilityNote}>
          Catatan: printer harus memahami perintah ESC/POS. Printer BLE atau model dengan protokol/driver khusus memerlukan integrasi SDK produsennya.
        </Text>
      </GlassCard>

      <SectionHeader title="Keamanan" />
      <GlassCard contentStyle={styles.card}>
        <View style={styles.securityBanner}><ShieldCheck color={palette.success} size={19} /><Text style={styles.securityText}>Sesi akun dan data penting dilindungi pada perangkat ini.</Text></View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.md },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headingIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  headingCopy: { flex: 1 },
  cardTitle: { color: palette.ink, fontFamily: type.bold, fontSize: 14 },
  cardSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  helper: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 15 },
  deviceRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deviceIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  deviceCopy: { flex: 1 },
  deviceName: { color: palette.ink, fontFamily: type.semibold, fontSize: 13 },
  deviceMeta: { color: palette.muted, fontFamily: type.regular, fontSize: 10, lineHeight: 14, marginTop: 3 },
  printerIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.honeySoft },
  printerAddress: { color: palette.muted, fontFamily: type.medium, fontSize: 10 },
  printerMessageSuccess: { color: palette.success },
  printerMessageDanger: { color: palette.danger },
  optionGroup: { gap: spacing.xs },
  optionLabel: { color: palette.inkSoft, fontFamily: type.semibold, fontSize: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  networkFields: { gap: spacing.sm },
  printerList: { gap: spacing.xs },
  printerRow: { minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.porcelain, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  printerRowSelected: { borderColor: 'rgba(38,122,85,0.32)', backgroundColor: palette.successSoft },
  connectionIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.infoSoft },
  connectionIconSelected: { backgroundColor: palette.white },
  compatibilityNote: { color: palette.muted, fontFamily: type.regular, fontSize: 9, lineHeight: 14, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: palette.line },
  securityBanner: { minHeight: 60, borderRadius: radius.md, padding: spacing.md, backgroundColor: palette.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  securityText: { flex: 1, color: palette.success, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
});
