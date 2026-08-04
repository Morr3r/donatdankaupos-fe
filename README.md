# Donat Dankau POS

![Donat Dankau](assets/donat-dankau-logo.png)

Donat Dankau POS adalah aplikasi point of sale untuk membantu operasional harian gerai Donat Dankau. Aplikasi ini menyatukan proses penjualan, pengelolaan stok, pencatatan pengeluaran, shift kasir, dan laporan usaha dalam satu aplikasi yang dapat dijalankan di Android, iOS, dan web.

Repository ini berisi aplikasi klien yang dibangun dengan Expo dan React Native. Data dan aturan bisnis aplikasi dilayani oleh [Donat Dankau POS Backend](https://github.com/Morr3r/donatdankaupos-be).

## Pengguna aplikasi

Aplikasi menyediakan akses sesuai peran pengguna:

- **Staff/kasir** menjalankan shift, mencatat pesanan, menerima pembayaran, melihat transaksi, dan memantau stok.
- **Owner** memantau dashboard dan laporan, mengelola produk, melakukan penyesuaian stok, mencatat atau membatalkan pengeluaran, serta mengawasi aktivitas operasional.

## Fitur utama

- **Kasir dan checkout**: pemilihan produk dan varian, harga reseller, jumlah minimum pemesanan, promosi, catatan pesanan, serta beberapa metode pembayaran.
- **Shift harian**: pencatatan kas tunai dan saldo bank awal, ringkasan aktivitas selama shift, serta rekonsiliasi ketika shift ditutup.
- **Transaksi**: riwayat dan detail pesanan, pelunasan pembayaran tertunda, pembatalan, refund, berbagi invoice, dan pencetakan struk melalui printer thermal Android.
- **Inventori**: pemantauan stok fisik Donat Medium, Large, Mini, dan Bomboloni, input stok beserta masa kedaluwarsa, serta penyesuaian stok oleh owner.
- **Produk**: pengelolaan menu, kategori, foto, varian, harga normal dan reseller, jumlah isi, serta status ketersediaan.
- **Pengeluaran**: pencatatan biaya berdasarkan sumber dana tunai atau bank dengan jejak pembatalan untuk kebutuhan audit.
- **Dashboard dan laporan**: ringkasan penjualan, metode pembayaran, produk terlaris, HPP, laba bersih, dan ekspor laporan berdasarkan periode.
- **Notifikasi operasional**: pemberitahuan transaksi, perubahan inventori, pengingat aktivitas, badge, suara, dan navigasi langsung ke halaman terkait.

## Alur operasional

1. Pengguna masuk menggunakan akun staff atau owner.
2. Kasir membuka shift dan mengisi saldo tunai serta saldo bank awal hari.
3. Pesanan dibuat dari halaman POS, lalu pembayaran dicatat sebagai tunai, QRIS, kartu, transfer, atau bayar nanti.
4. Stok berkurang otomatis berdasarkan jumlah pcs yang terjual dan dikembalikan ketika transaksi di-refund.
5. Owner memantau penjualan, stok, pengeluaran, HPP, dan laba melalui dashboard serta laporan.
6. Pada akhir operasional, kasir menutup shift untuk merekonsiliasi saldo aktual dengan saldo yang dihitung sistem.

## Teknologi

- Expo SDK 57 dan React Native 0.86
- TypeScript dan React 19
- React Navigation untuk navigasi aplikasi
- Zustand untuk state management
- Zod untuk validasi data API
- AsyncStorage dan SecureStore untuk penyimpanan lokal
- Expo Notifications untuk push notification
- Native Expo module berbasis Kotlin untuk printer thermal Android

## Menjalankan aplikasi

Prasyarat:

- Node.js 22.13 atau lebih baru
- npm
- Backend Donat Dankau POS yang dapat diakses
- Android Studio/Xcode untuk menjalankan native build, jika diperlukan

```powershell
git clone https://github.com/Morr3r/donatdankaupos-fe.git
Set-Location donatdankaupos-fe
npm install
Copy-Item .env.example .env
npm start
```

Pilih target Android, iOS, atau web dari Expo CLI. Fitur native seperti remote push notification dan printer thermal perlu diuji menggunakan development/preview build, bukan Expo Go.

## Konfigurasi environment

Salin `.env.example` menjadi `.env`, lalu lengkapi nilainya sesuai environment lokal. Untuk build EAS, simpan konfigurasi melalui environment atau secret management EAS sesuai target deployment.

Jangan menaruh URL layanan internal, API key, token, service account, password, atau nilai konfigurasi production di README maupun source control.

## Perintah pengembangan

| Perintah | Kegunaan |
| --- | --- |
| `npm start` | Menjalankan Expo development server. |
| `npm run android` | Membuat dan menjalankan development build Android. |
| `npm run android:release` | Membuat dan menjalankan release build Android. |
| `npm run ios` | Menjalankan aplikasi iOS. |
| `npm run web` | Menjalankan aplikasi web. |
| `npm run typecheck` | Memeriksa tipe TypeScript tanpa menghasilkan file build. |
| `npm run doctor` | Memeriksa kompatibilitas dependency dan konfigurasi Expo. |

## Struktur project

```text
.
|-- assets/                 # Logo, ikon, dan media aplikasi
|-- docs/                   # Kontrak backend dan referensi desain
|-- modules/thermal-printer # Native Expo module untuk printer Android
|-- plugins/                # Expo config plugins
|-- src/
|   |-- api/                # HTTP client dan service API
|   |-- components/         # Komponen UI dan fitur POS
|   |-- navigation/         # Stack, tab, dan deep-link navigation
|   |-- notifications/      # Registrasi dan penanganan push notification
|   |-- screens/            # Halaman aplikasi
|   |-- storage/            # Persistensi sesi lokal
|   |-- store/              # Global application state
|   |-- theme/              # Design tokens
|   |-- types/              # Tipe domain
|   `-- utils/              # Formatter dan utilitas lintas fitur
|-- App.tsx                 # Root component
|-- app.json                # Konfigurasi Expo
`-- eas.json                # Profil EAS Build
```

## Push notification

Remote push notification menggunakan `expo-notifications` dan Expo Push Service. Setelah pengguna login, aplikasi meminta izin notifikasi, mendaftarkan Expo Push Token ke backend, dan memperbaruinya ketika token native FCM/APNs berubah. Notifikasi dapat membuka transaksi, inventori, atau Notification Center sesuai payload yang diterima.

### Android/FCM

1. Daftarkan aplikasi Android pada Firebase.
2. Simpan file konfigurasi Android dari Firebase sebagai `google-services.json` di root project.
3. Pastikan `expo.android.googleServicesFile` di `app.json` mengarah ke file tersebut.
4. Upload Google Service Account Key FCM V1 ke EAS Credentials. Jangan commit service-account key.
5. Buat APK perangkat dengan `eas build --platform android --profile preview`.

Remote push tidak dapat diuji melalui Expo Go. Gunakan development/preview build pada perangkat atau emulator dengan Google Play Services.

## Build dan pemeriksaan

Jalankan pemeriksaan berikut sebelum membuat native build:

```powershell
npm run typecheck
npm run doctor
```

Profil EAS tersedia untuk development, preview, dan production:

```powershell
eas build --platform android --profile preview
eas build --platform android --profile production
```

## Lisensi

Lihat [LICENSE](LICENSE) untuk ketentuan penggunaan source code.
