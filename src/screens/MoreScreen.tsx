import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BellRing, ChevronRight, Donut, LogOut, PackageOpen, ReceiptText, RefreshCw, Settings, ShieldCheck, Store, UserRound, WalletCards } from 'lucide-react-native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Button, GlassCard, Header, ScalePressable, Screen, SectionHeader, StatusPill } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { useOperationsStore } from '../store/operationsStore';
import { useCatalogStore } from '../store/catalogStore';
import { useSessionStore } from '../store/sessionStore';
import { palette, radius, spacing, type } from '../theme/tokens';
import { useNotificationStore } from '../store/notificationStore';

const roleLabels = {
  cashier: 'Kasir',
  staff: 'Staff',
  manager: 'Manager',
  owner: 'Owner',
} as const;

export function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useSessionStore((state) => state.user);
  const logout = useSessionStore((state) => state.logout);
  const shift = useOperationsStore((state) => state.shift);
  const refreshTransactions = useOperationsStore((state) => state.refreshTransactions);
  const loadCatalog = useCatalogStore((state) => state.load);
  const unreadNotifications = useNotificationStore((state) => state.unreadCount);
  const canManageProducts = user?.role === 'staff' || user?.role === 'manager' || user?.role === 'owner';

  const handleLogout = () => {
    if (shift?.status === 'open') {
      Alert.alert('Shift masih aktif', 'Tutup shift terlebih dahulu sebelum keluar dari akun.', [{ text: 'Batal' }, { text: 'Buka shift', onPress: () => navigation.navigate('Shift') }]);
      return;
    }
    logout();
  };

  return (
    <Screen>
      <Header eyebrow="Workspace" subtitle="Operasional, perangkat, dan akun" title="Lainnya" />

      <GlassCard dark contentStyle={styles.profileCard}>
        <View style={styles.avatar}><UserRound color={palette.white} size={27} /></View>
        <View style={styles.profileCopy}><Text style={styles.profileName}>{user?.name}</Text><Text style={styles.profileEmail}>{user?.email}</Text><View style={styles.profileBadges}><StatusPill label={user ? roleLabels[user.role] : 'Pengguna'} tone="info" /><StatusPill label={shift?.status === 'open' ? 'Shift aktif' : 'Shift tutup'} tone={shift?.status === 'open' ? 'success' : 'warning'} /></View></View>
      </GlassCard>

      <SectionHeader title="Operasional" />
      <GlassCard contentStyle={styles.menuCard}>
        <MenuRow icon={WalletCards} label="Shift & kas harian" onPress={() => navigation.navigate('Shift')} subtitle="Uang fisik, rekening, dan rekonsiliasi" />
        <MenuRow icon={ReceiptText} label="Pengeluaran" onPress={() => navigation.navigate('Expenses')} subtitle="Catat biaya dan pantau saldo kas" />
        <MenuRow icon={PackageOpen} label="Stok produk" onPress={() => navigation.navigate('Inventory')} subtitle="Pantau stok menipis dan habis" />
        <MenuRow icon={BellRing} label="Notification Center" onPress={() => navigation.navigate('Notifications')} subtitle={unreadNotifications ? `${unreadNotifications} sinyal baru menunggu perhatian` : 'Aktivitas owner dan staff tersinkron'} />
        {canManageProducts ? <MenuRow icon={Donut} label="Kelola produk" onPress={() => navigation.navigate('Products')} subtitle="Edit menu, harga, foto, varian, dan topping" /> : null}
        <MenuRow icon={RefreshCw} label="Segarkan data" onPress={async () => {
          try {
            await Promise.all([refreshTransactions(), loadCatalog()]);
            Alert.alert('Data diperbarui', 'Katalog dan transaksi terbaru berhasil dimuat.');
          } catch (error) {
            Alert.alert('Gagal memperbarui', error instanceof Error ? error.message : 'Periksa koneksi lalu coba lagi.');
          }
        }} subtitle="Ambil katalog dan transaksi terbaru" />
      </GlassCard>

      <SectionHeader title="Pengaturan" />
      <GlassCard contentStyle={styles.menuCard}>
        <MenuRow icon={Settings} label="Perangkat & koneksi" onPress={() => navigation.navigate('Settings')} subtitle="Periksa kesiapan perangkat kasir" />
      </GlassCard>

      <View style={styles.brandFooter}><BrandLogo width={190} /><View style={styles.secure}><ShieldCheck color={palette.success} size={15} /><Text style={styles.secureText}>Data perangkat terenkripsi</Text></View></View>
      <Button icon={LogOut} label="Keluar dari akun" onPress={handleLogout} variant="danger" />
      <Text style={styles.version}>Donat Dankau POS · Versi 1.0.0</Text>
    </Screen>
  );
}

function MenuRow({ icon: Icon, label, subtitle, onPress }: { icon: typeof Store; label: string; subtitle: string; onPress: () => void }) {
  return (
    <ScalePressable accessibilityLabel={label} accessibilityHint={subtitle} onPress={onPress} style={styles.menuRow}>
      <View style={styles.menuIcon}><Icon color={palette.cocoa} size={21} /></View>
      <View style={styles.menuCopy}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuSubtitle}>{subtitle}</Text></View>
      <ChevronRight color={palette.muted} size={19} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  profileCard: { minHeight: 128, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(232,140,164,0.34)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  profileCopy: { flex: 1 },
  profileName: { color: palette.white, fontFamily: type.bold, fontSize: 17 },
  profileEmail: { color: 'rgba(255,255,255,0.62)', fontFamily: type.regular, fontSize: 11, marginTop: 3 },
  profileBadges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  menuCard: { paddingHorizontal: spacing.md },
  menuRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.line },
  menuIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.roseSoft },
  menuCopy: { flex: 1 },
  menuLabel: { color: palette.ink, fontFamily: type.semibold, fontSize: 13 },
  menuSubtitle: { color: palette.muted, fontFamily: type.regular, fontSize: 10, marginTop: 3 },
  brandFooter: { alignItems: 'center', paddingVertical: spacing.xl },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  secureText: { color: palette.success, fontFamily: type.semibold, fontSize: 10 },
  version: { color: palette.muted, fontFamily: type.medium, fontSize: 10, textAlign: 'center', marginTop: spacing.md },
});
