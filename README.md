# Donat Dankau POS Mobile

Expo/React Native client untuk Donat Dankau POS.

## Push notification

Remote push notification menggunakan `expo-notifications` dan Expo Push Service. Aplikasi:

- meminta izin notifikasi setelah pengguna login;
- mendaftarkan Expo Push Token ke backend;
- memperbarui token saat token native FCM/APNs berubah;
- menampilkan banner sistem, suara, badge, dan notification tray;
- membuka transaksi, inventori, atau Notification Center ketika notifikasi ditekan;
- menyediakan tombol **Kirim uji** pada Notification Center untuk tes server-ke-perangkat.

### Android/FCM

1. Daftarkan package `id.donatdankau.pos` pada Firebase.
2. Simpan konfigurasi Android sebagai `google-services.json` di root project.
3. Tambahkan `"googleServicesFile": "./google-services.json"` pada bagian `expo.android` di `app.json`.
4. Upload Google Service Account Key FCM V1 ke EAS Credentials. Jangan commit service-account key.
5. Buat APK perangkat dengan `eas build --platform android --profile preview`.

Remote push tidak diuji melalui Expo Go. Gunakan development/preview build pada perangkat atau emulator
dengan Google Play Services.

### Environment build

EAS environment `development`, `preview`, dan `production` harus berisi:

```text
EXPO_PUBLIC_API_URL=https://donatdankaube.vercel.app/api/v1
EXPO_PUBLIC_TERMINAL_ID=POS-01
```

Jalankan `npm run typecheck` dan `npm run doctor` sebelum build native.
