# Kontrak Backend Python — Donat Dankau POS

Rekomendasi stack: FastAPI, Pydantic v2, SQLAlchemy 2, PostgreSQL, Redis (opsional untuk idempotency/session), Alembic, dan Celery/RQ bila export laporan dikerjakan asynchronous.

Base path: `/api/v1`. Semua response/error berbentuk JSON. Waktu memakai ISO-8601 UTC; frontend melakukan local formatting `id-ID`.

## Autentikasi dan akses

### `POST /auth/login`

Request:

```json
{ "email": "kasir@donatdankau.id", "password": "******" }
```

Response `200`:

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque-or-jwt",
  "user": {
    "id": "usr_001",
    "name": "Nadia Prameswari",
    "email": "kasir@donatdankau.id",
    "role": "cashier",
    "outletId": "outlet_bdg_01",
    "outletName": "Donat Dankau · Buah Batu"
  }
}
```

Tambahkan `POST /auth/refresh`, `POST /auth/logout`, dan `GET /me`. Role: `cashier`, `manager`, `owner`. Refund, stock adjustment, report export, dan close-shift dengan selisih di atas limit harus diperiksa server-side.

## Endpoint minimum

| Method | Path | Tujuan |
|---|---|---|
| GET | `/products?active=true&outlet_id=...` | Katalog, harga, kategori, dan stok outlet |
| POST | `/shifts` | Buka shift dengan `opening_cash` dan terminal |
| GET | `/shifts/current` | Pulihkan shift aktif perangkat/user |
| POST | `/shifts/{id}/close` | Tutup shift dan rekonsiliasi |
| POST | `/sales` | Buat transaksi atomik |
| GET | `/sales` | Filter tanggal, status, metode bayar, query, cursor |
| GET | `/sales/{id}` | Detail transaksi/struk |
| POST | `/sales/{id}/refunds` | Refund dengan manager approval + reason |
| GET | `/inventory-items` | Empat kelompok stok fisik per pcs |
| POST | `/inventory-adjustments` | Stock opname/restock kelompok stok dengan audit trail |
| GET | `/reports/sales-summary` | KPI dan time series periode |
| GET | `/reports/top-products` | Ranking produk |
| POST | `/reports/exports` | Buat file CSV/XLSX/PDF |
| POST | `/sync/batch` | Terima event offline berurutan |

Respons `/reports/sales-summary` menyertakan `pieceCount`, `costPerItem`, `costOfGoodsSold`,
`netProfit`, dan `netMarginPercent`. HPP saat ini dipukul rata Rp2.650 per pcs donat
untuk seluruh produk dan topping. Paket isi 6/12 dikonversi ke jumlah pcs sebelum HPP dihitung.
Setiap respons transaksi juga menyertakan `pieceCount`, `costPerItem`, `costOfGoodsSold`,
`netProfit`, dan `netMarginPercent`. `netProfit` dihitung sebagai total transaksi dikurangi total HPP.

Setiap produk dapat memiliki `resellerPrice` (integer rupiah atau `null`). Produk dengan nilai
`null` tidak tersedia pada mode harga reseller. Harga pelanggan tetap memakai `price`.
Produk dengan `isResellerOnly: true` hanya ditampilkan dan dapat dijual pada mode reseller.

## Create sale

`POST /sales` wajib menerima header `Idempotency-Key`. Simpan key per outlet minimal 24 jam dan kembalikan response transaksi awal untuk retry dengan payload identik. Payload mengikuti `SaleRequest` di `src/types/domain.ts`:

```json
{
  "idempotencyKey": "sale_xxx",
  "shiftId": "shift_xxx",
  "items": [{ "lineId": "line_x", "productId": "prd_001", "name": "Dankau Berry", "price": 14000, "quantity": 2 }],
  "orderType": "takeaway",
  "paymentMethod": "qris",
  "pricingMode": "reseller",
  "customerName": "Kak Rani",
  "discount": 0,
  "amountPaid": 31080,
  "totals": { "subtotal": 28000, "discount": 0, "tax": 3080, "service": 0, "total": 31080 }
}
```

Server tidak boleh memercayai harga/tax/discount dari client. Hitung ulang dari price book sesuai
`pricingMode` (`customer` atau `reseller`), promotion rule, dan konfigurasi pajak; kembalikan
`409 PRICE_CHANGED` bila kasir perlu mengonfirmasi total baru. Untuk mode reseller, tolak produk
tanpa `resellerPrice` dengan `409 RESELLER_PRICE_UNAVAILABLE`. Kurangi stok dan buat payment/sale
lines dalam satu database transaction.

## Bentuk error

```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Stok Golden Cheese tersisa 2.",
  "detail": "Perbarui jumlah lalu coba lagi."
}
```

Gunakan status yang tepat: `400` validasi bisnis, `401`, `403`, `404`, `409` konflik/idempotency, `422` schema, `429`, dan `5xx`. Jangan bocorkan stack trace.

## Offline sync

Client menyimpan event dengan `id`, `type`, `payload`, `createdAt`, dan `attempts`. `/sync/batch` harus:

1. Memproses event per outlet/perangkat secara berurutan.
2. Deduplikasi berdasarkan event ID dan idempotency key.
3. Mengembalikan status tiap event (`accepted`, `duplicate`, `conflict`, `rejected`).
4. Mengembalikan canonical transaction ID/receipt number untuk mengganti ID `OFF-*`.
5. Tidak menghapus event client sampai acknowledgement diterima.

## Keamanan dan audit

- Access token pendek (sekitar 15 menit) dan refresh-token rotation/revocation.
- Password Argon2id/bcrypt, TLS wajib di staging/production, CORS terbatas.
- Audit log append-only untuk login, shift, void/refund, stock adjustment, settings, dan report export.
- Nominal uang disimpan integer rupiah (`BIGINT`), bukan float.
- Seluruh query wajib dibatasi `outlet_id` dari claim/authorization, bukan hanya input client.
- Rate limit login/refund/manager PIN dan jangan simpan data kartu/track/PIN.
- Backup, migration, observability, structured logging dengan request ID, dan health endpoint `/health`.
