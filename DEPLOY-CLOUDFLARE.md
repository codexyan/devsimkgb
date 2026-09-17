# Deploy SIM-KGB ke Cloudflare Workers

SIM-KGB berjalan sebagai satu Worker Cloudflare bernama `sim-kgb`, dibangun dengan
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (OpenNext). Berkas SK disimpan di
Cloudflare R2, data dibaca dari Google Sheets atau Supabase, dan pekerjaan harian berjalan lewat
Cron Trigger. Semua perintah dijalankan dari akar repositori.

## 1. Susunan Worker

Konfigurasi ada di `wrangler.jsonc`:

| Bagian | Nilai | Kegunaan |
|--------|-------|----------|
| `name` | `sim-kgb` | Nama Worker. Nama Worker di dashboard harus sama. |
| `main` | `worker-entry.js` | Membungkus `.open-next/worker.js` (hasil build OpenNext): meneruskan `fetch` dan menambahkan handler `scheduled`. |
| `assets` | `.open-next/assets`, binding `ASSETS` | Berkas statis hasil build. |
| `services` | `WORKER_SELF_REFERENCE` ke `sim-kgb` | Dipakai handler `scheduled` untuk memanggil endpoint cron di Worker yang sama. |
| `r2_buckets` | `SK_BUCKET` ke bucket `sim-kgb-sk` | Berkas SK KGB. |
| `triggers.crons` | `0 0 * * *` | Cron harian pukul 00.00 UTC (08.00 WITA). |
| `compatibility_flags` | `nodejs_compat`, `global_fetch_strictly_public` | Runtime Node yang dibutuhkan Next.js. |

`open-next.config.ts` memakai konfigurasi bawaan (tanpa incremental cache), karena hampir semua
halaman dinamis dan terlindungi login.

Tidak ada `middleware.ts` atau `proxy.ts`. Pembatasan peran halaman dilakukan di layout server
(`lib/authGuard.ts`), dan setiap route API memeriksa sesi dengan `auth()`.

## 2. Bucket R2 untuk berkas SK

Buat bucket sekali saja:

```bash
npx wrangler login
npx wrangler r2 bucket create sim-kgb-sk
```

Binding `SK_BUCKET` dipakai oleh:

- `POST /api/kgb/[id]/upload-sk`: menyimpan PDF SK bertanda tangan dengan kunci `sk/<nip>_<waktu>.pdf`.
- `GET /api/blob/download`: mengunduh berkas SK (hanya kunci di bawah `sk/`).
- `DELETE /api/pegawai/[id]`: menghapus berkas SK milik pegawai yang dihapus.

Saat `next dev`, binding tersedia lewat `initOpenNextCloudflareForDev()` di `next.config.ts`.

## 3. Penyimpanan data

Semua route memakai `import { db } from "@/lib/db"`. Penyimpanan dipilih di `lib/db/index.ts` setiap kali
data diakses:

- `DATA_BACKEND=sheets` memakai Google Sheets (penyimpanan produksi saat ini).
- `DATA_BACKEND=supabase` memakai Supabase (Postgres lewat REST).
- Tanpa `DATA_BACKEND`, Supabase dipakai bila `SUPABASE_URL` terisi; selain itu Google Sheets.
- Nilai `DATA_BACKEND` lain membuat request gagal dengan pesan galat yang jelas.

Google Sheets membutuhkan akun layanan yang diberi akses Editor ke spreadsheet, dengan Google Sheets API
aktif di project Google Cloud. Supabase membutuhkan secret key proyek; key itu melewati RLS, jadi hanya
boleh dipakai di server.

## 4. Variabel dan secret

Isi sebagai secret Worker, lewat dashboard (Worker `sim-kgb`, Settings, Variables and Secrets) atau CLI:

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put DATA_BACKEND
npx wrangler secret put GOOGLE_SHEET_ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
# bila memakai Supabase
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
```

| Variabel | Wajib | Kegunaan |
|----------|-------|----------|
| `AUTH_SECRET` | Ya | Kunci sesi NextAuth v5 (buat dengan `openssl rand -base64 32`). NextAuth juga membaca `NEXTAUTH_SECRET` sebagai nama lama. |
| `CRON_SECRET` | Ya | Bearer token endpoint cron. Tanpa nilai ini endpoint cron menjawab 503. |
| `DATA_BACKEND` | Tidak | `sheets` atau `supabase` (lihat bagian 3). |
| `GOOGLE_SHEET_ID` | Untuk Sheets | ID spreadsheet dari URL `docs.google.com/spreadsheets/d/<ID>/edit`. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Untuk Sheets | Email akun layanan. |
| `GOOGLE_PRIVATE_KEY` | Untuk Sheets | `private_key` dari JSON key; boleh ditulis satu baris dengan `\n`. |
| `SUPABASE_URL` | Untuk Supabase | URL proyek, misalnya `https://PROJECT_REF.supabase.co`. |
| `SUPABASE_SECRET_KEY` | Untuk Supabase | Secret key proyek (hanya server). |
| `AUTH_URL` | Tidak | URL kanonik. Tidak diperlukan karena `auth.config.ts` memakai `trustHost: true`. |

Nama variabel sama dengan `.env.example`. Variabel lama di `.env.example` dan `.dev.vars.example`
(`DATABASE_URL`, `DIRECT_URL`, `BLOB_READ_WRITE_TOKEN`, `SEED_PASSWORD_*`) tidak dibaca kode aplikasi.

Secret dibaca dari `process.env` saat request berjalan, sehingga perubahan secret berlaku setelah
Worker menerima versi konfigurasi baru tanpa perlu build ulang.

## 5. Build dan deploy otomatis dari Git (Workers Builds)

Deploy produksi berjalan dengan Workers Builds yang terhubung ke repositori Git.

1. Dashboard Cloudflare, Workers & Pages, Worker `sim-kgb`, Settings, Build: hubungkan repositori.
2. Branch produksi: `main`.
3. Perintah build: `npm run cf:build` (menjalankan `wrangler types` untuk `cloudflare-env.d.ts`, lalu
   `opennextjs-cloudflare build`).
4. Perintah deploy: `npx opennextjs-cloudflare deploy`.
5. Secret runtime diisi seperti bagian 4. Build tidak membutuhkan variabel tambahan.

Workers Builds memasang dependensi dengan `npm ci`, jadi `package-lock.json` harus sesuai dengan
`package.json` setiap kali dependensi berubah.

Deploy manual dari komputer lokal:

```bash
npm run cf:deploy     # cf:typegen, opennextjs-cloudflare build, lalu deploy
```

`cloudflare-env.d.ts` dibuat oleh `npm run cf:typegen` dan tidak disimpan di Git. Tanpa berkas itu,
`tsc` melaporkan `Property 'SK_BUCKET' does not exist on type 'CloudflareEnv'`. Jalankan ulang setelah
mengubah binding di `wrangler.jsonc`.

## 6. Cron harian

1. Cron Trigger `0 0 * * *` memanggil handler `scheduled` di `worker-entry.js`.
2. Handler itu memanggil `https://sim-kgb.internal/api/cron/notifikasi` lewat binding
   `WORKER_SELF_REFERENCE`, dengan header `Authorization: Bearer <CRON_SECRET>`.
3. `app/api/cron/notifikasi/route.ts` menjawab 503 bila `CRON_SECRET` belum diisi dan 401 bila token
   tidak cocok. Bila token cocok, route menjalankan:
   - `bersihkanHukdisKedaluwarsa()` (`lib/hukdisKedaluwarsa.ts`): menonaktifkan penanda hukdis pegawai
     yang sudah lewat tanggal berakhir. Kegagalan langkah ini dicatat dan tidak menghentikan langkah berikutnya.
   - `generateNotifikasi()` (`lib/generateNotifikasi.ts`): membuat notifikasi harian.

Hasil dan galat terlihat di log Worker (observability aktif). Untuk menguji tanpa menunggu jadwal:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain-produksi>/api/cron/notifikasi
```

Di luar cron, `GET /api/notifikasi` juga membuat notifikasi paling sering sekali tiap 15 menit per isolate.

## 7. Menjalankan lokal

```bash
npm install
npm run dev          # next dev di http://localhost:3100, variabel dari .env
npm run cf:preview   # build OpenNext lalu jalankan di runtime Workers lokal, variabel dari .dev.vars
```

`.env` dan `.dev.vars` tidak disimpan di Git. Isi dengan variabel di bagian 4. Dev server dan preview
lokal memakai spreadsheet atau proyek Supabase yang ditunjuk variabel tersebut, jadi arahkan ke data uji
bila tidak ingin mengubah data produksi.

## 8. Domain

Domain produksi dipasang di Worker `sim-kgb`, Settings, Domains & Routes. Produksi saat ini dilayani di
`kgb.paskalsel.online`.
