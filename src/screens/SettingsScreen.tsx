import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bluetooth, Printer, RefreshCw, Server, ShieldCheck, TabletSmartphone, Trash2, Wifi } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { TERMINAL_ID } from '../api/client';
import { healthService } from '../api/services';
import { Button, GlassCard, Header, ScalePressable, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { palette, radius, spacing, type } from '../theme/tokens';
import type { ThermalPrinterDevice } from '../../modules/thermal-printer/src/ThermalPrinter.types';
import {
  clearSavedThermalPrinter,
  getSavedThermalPrinter,
  listPairedThermalPrinters,
  openBluetoothPrinterSettings,
  printThermalTestPage,
  saveThermalPrinter,
  type SavedThermalPrinter,
} from '../utils/thermal-printer';

type ServerStatus = 'unknown' | 'checking' | 'online' | 'offline';
type PrinterStatus = 'idle' | 'loading' | 'testing';

export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Settings'>) {
  const [serverStatus, setServerStatus] = useState<ServerStatus>('unknown');
  const [serverMessage, setServerMessage] = useState('Belum diperiksa');
  const [savedPrinter, setSavedPrinter] = useState<SavedThermalPrinter | null>(null);
  const [pairedPrinters, setPairedPrinters] = useState<ThermalPrinterDevice[]>([]);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>('idle');
  const [printerMessage, setPrinterMessage] = useState(
    Platform.OS === 'android'
      ? 'Pasangkan Iware C58BT di pengaturan Bluetooth Android, lalu pilih perangkatnya di sini.'
      : 'Konfigurasi printer thermal tersedia di aplikasi Android.',
  );
  const [printerTone, setPrinterTone] = useState<'neutral' | 'success' | 'danger'>('neutral');

  useEffect(() => {
    getSavedThermalPrinter()
      .then((printer) => {
        setSavedPrinter(printer);
        if (printer) {
          setPrinterMessage(`${printer.name} siap mencetak dua salinan berurutan. Sobek manual pada penanda antar-salinan.`);
          setPrinterTone('success');
        }
      })
      .catch(() => {
        setPrinterMessage('Pengaturan printer belum dapat dimuat.');
        setPrinterTone('danger');
      });
  }, []);

  const testConnection = async () => {
    setServerStatus('checking');
    setServerMessage('Memeriksa koneksi…');
    try {
      const health = await healthService.check();
      setServerStatus('online');
      setServerMessage(`Siap digunakan · diperiksa ${new Date(health.timestamp).toLocaleString('id-ID')}`);
    } catch (error) {
      setServerStatus('offline');
      setServerMessage(error instanceof Error ? error.message : 'Layanan tidak dapat dijangkau.');
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
        setPrinterMessage('Belum ada perangkat terpasang. Pasangkan Iware C58BT di pengaturan Bluetooth Android.');
        setPrinterTone('danger');
      } else {
        setPrinterMessage(`Ditemukan ${devices.length} perangkat terpasang. Pilih Iware C58BT.`);
      }
    } catch (error) {
      setPrinterMessage(error instanceof Error ? error.message : 'Daftar perangkat Bluetooth belum dapat dimuat.');
      setPrinterTone('danger');
    } finally {
      setPrinterStatus('idle');
    }
  };

  const selectPrinter = async (printer: ThermalPrinterDevice) => {
    await saveThermalPrinter(printer);
    setSavedPrinter(printer);
    setPrinterMessage(`${printer.name} dipilih. Setiap invoice dicetak dua salinan berurutan: KONSUMEN dan TOKO.`);
    setPrinterTone('success');
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
            <Text style={styles.cardTitle}>{savedPrinter?.name ?? 'Iware C58BT'}</Text>
            <Text style={styles.cardSubtitle}>Thermal Bluetooth 58 mm · 2 salinan berurutan</Text>
          </View>
          <StatusPill label={savedPrinter ? 'Dipilih' : 'Belum dipilih'} tone={savedPrinter ? 'success' : 'warning'} />
        </View>

        {savedPrinter ? <Text selectable style={styles.printerAddress}>{savedPrinter.address}</Text> : null}
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

        <Button
          icon={RefreshCw}
          label="Muat printer terpasang"
          loading={printerStatus === 'loading'}
          onPress={loadPairedPrinters}
          variant="secondary"
        />
        <Button icon={Bluetooth} label="Buka pengaturan Bluetooth" onPress={openBluetoothSettings} variant="ghost" />

        {pairedPrinters.length > 0 ? (
          <View style={styles.printerList}>
            {pairedPrinters.map((printer) => {
              const selected = savedPrinter?.address === printer.address;
              return (
                <ScalePressable
                  key={printer.address}
                  accessibilityLabel={`Pilih printer ${printer.name}`}
                  accessibilityState={{ selected }}
                  onPress={() => selectPrinter(printer)}
                  style={[styles.printerRow, selected && styles.printerRowSelected]}
                >
                  <View style={[styles.bluetoothIcon, selected && styles.bluetoothIconSelected]}>
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

        {savedPrinter ? (
          <>
            <Button icon={Printer} label="Cetak halaman tes" loading={printerStatus === 'testing'} onPress={testPrinter} />
            <Button icon={Trash2} label="Hapus pilihan printer" onPress={forgetPrinter} variant="ghost" />
          </>
        ) : null}
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
  printerList: { gap: spacing.xs },
  printerRow: { minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.porcelain, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  printerRowSelected: { borderColor: 'rgba(38,122,85,0.32)', backgroundColor: palette.successSoft },
  bluetoothIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.infoSoft },
  bluetoothIconSelected: { backgroundColor: palette.white },
  securityBanner: { minHeight: 60, borderRadius: radius.md, padding: spacing.md, backgroundColor: palette.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  securityText: { flex: 1, color: palette.success, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
});
