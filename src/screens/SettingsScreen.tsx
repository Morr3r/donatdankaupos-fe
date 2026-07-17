import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Server, ShieldCheck, TabletSmartphone, Wifi } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TERMINAL_ID } from '../api/client';
import { healthService } from '../api/services';
import { Button, GlassCard, Header, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { palette, radius, spacing, type } from '../theme/tokens';

type ServerStatus = 'unknown' | 'checking' | 'online' | 'offline';

export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Settings'>) {
  const [serverStatus, setServerStatus] = useState<ServerStatus>('unknown');
  const [serverMessage, setServerMessage] = useState('Belum diperiksa');

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
  securityBanner: { minHeight: 60, borderRadius: radius.md, padding: spacing.md, backgroundColor: palette.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  securityText: { flex: 1, color: palette.success, fontFamily: type.medium, fontSize: 10, lineHeight: 15 },
});
