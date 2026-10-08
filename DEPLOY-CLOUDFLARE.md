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
| `d1_databases` | `DB` ke D1 `sim-kgb` (APAC), migrasi di `d1/migrations` | Basis data bila `DATA_BACKEND=d1` (ADR-085). |
| `triggers.crons` | `0 0 * * *`, `0 12 * * *` | Pukul 00.00 UTC (08.00 WITA): cadangan otomatis lalu notifikasi harian. Pukul 12.00 UTC (20.00 WITA): cadangan otomatis saja (ADR-084). |
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

- `DATA_BACKEND=d1` memakai Cloudflare D1 lewat binding `DB` (ADR-085). Produksi beralih ke sini sesudah data
  disalin (lihat "Peralihan ke D1" di bawah).
- `DATA_BACKEND=sheets` memakai Google Sheets.
- `DATA_BACKEND=supabase` memakai Supabase (Postgres lewat REST). Dipakai produksi sampai peralihan ke D1.
- Tanpa `DATA_BACKEND`, Supabase dipakai bila `SUPABASE_URL` terisi; selain itu Google Sheets.
- Nilai `DATA_BACKEND` lain membuat request gagal dengan pesan galat yang jelas.

Google Sheets membutuhkan akun layanan yang diberi akses Editor ke spreadsheet, dengan Google Sheets API
aktif di project Google Cloud. Supabase membutuhkan secret key proyek; key itu melewati RLS, jadi hanya
boleh dipakai di server.

### Migrasi D1

Skema D1 ada di `d1/migrations`. Terapkan ke D1 produksi **sebelum** kode yang membutuhkannya di-deploy:

```bash
npx wrangler d1 migrations list sim-kgb --remote    # yang belum diterapkan
npx wrangler d1 migrations apply sim-kgb --remote
```

Berkas SQL harus berakhir baris LF (`.gitattributes`). D1 menolak trigger yang memuat CR ("incomplete input"). Kolom
baru pada tabel yang dijejak menuntut trigger jejaknya dibuat ulang di migrasi yang sama (contoh:
`0003_usulan_penetap_sk_terakhir.sql`). `lib/db/d1/skema.test.ts` menagih keduanya, dan juga menagih agar selama
Supabase masih aktif setiap kolom baru dibuat di kedua basis data.

### Peralihan ke D1

1. Deploy kode yang memuat binding D1. `DATA_BACKEND` belum diatur, jadi basis data tetap Supabase.
2. Super Admin, di menu Cadangkan data:
   1. Tekan **Cadangkan sekarang**.
   2. Tekan **Salin semua ke D1**: satu transaksi, berhasil seluruhnya atau tidak sama sekali.
   3. Tekan **Bandingkan**.
3. `npx wrangler secret put DATA_BACKEND` dengan nilai `d1`. Versi baru langsung aktif tanpa build ulang.
4. **Bandingkan** lagi. Bila perlu, tekan **Salin yang tertinggal**.
5. Untuk kembali ke Supabase: `npx wrangler secret delete DATA_BACKEND`.

Pemulihan di D1: Time Travel (`npx wrangler d1 time-travel restore sim-kgb --timestamp=…`) untuk seluruh database,
atau `scripts/pulihkan-cadangan.ts` untuk baris tertentu (ADR-084, ADR-085).

### Migrasi Supabase diterapkan manual

Berkas di `supabase/migrations/` **tidak** dijalankan oleh deploy. Migrasi diterapkan dengan menempelkan
isinya ke SQL Editor proyek Supabase, jadi kode yang sudah terpasang bisa mendahului tabelnya. Commit yang
menambah kolom harus disertai migrasinya dijalankan; bila tidak, setiap penulisan ke tabel itu gagal dengan
500 dan peramban hanya menampilkan pesan umum. Diagnosanya lewat `npx wrangler tail sim-kgb --format pretty`
sambil memicu ulang galatnya.

Setiap `create table` memakai `if not exists`, sehingga sebuah migrasi aman diputar ulang terhadap basis data
yang skemanya sudah ada. Untuk memeriksa apakah produksi sinkron, jalankan dua query ini di SQL Editor lalu
bandingkan hasilnya dengan `supabase/migrations/`:

```sql
select table_name, string_agg(column_name, ',' order by column_name) as kolom
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;

select version, name from supabase_migrations.schema_migrations order by version;
```

Nomor versi di ledger tidak akan cocok dengan awalan nama berkas, karena migrasi tidak pernah diterapkan
lewat `supabase db push`. Yang dibandingkan cakupannya, bukan angkanya. Ledger juga memuat dua entri tanpa
berkas di repo, keduanya wajar: `arsip_tabel_prisma` (mengarsipkan tabel Prisma lama sebelum skema Supabase
ada) dan `usulan_pegawai_urutan_sisip` (kolom yang di repo sudah menyatu di dalam `create table`).

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
| `DATA_BACKEND` | Tidak | `d1`, `sheets`, atau `supabase` (lihat bagian 3). Atur sebagai secret, bukan variabel teks di wrangler.jsonc, supaya peralihan tidak memerlukan build ulang. |
| `GOOGLE_SHEET_ID` | Untuk Sheets | ID spreadsheet dari URL `docs.google.com/spreadsheets/d/<ID>/edit`. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Untuk Sheets | Email akun layanan. |
| `GOOGLE_PRIVATE_KEY` | Untuk Sheets | `private_key` dari JSON key; boleh ditulis satu baris dengan `\n`. |
| `SUPABASE_URL` | Untuk Supabase | URL proyek, misalnya `https://PROJECT_REF.supabase.co`. |
| `SUPABASE_SECRET_KEY` | Untuk Supabase | Secret key proyek (hanya server). |
| `AUTH_URL` | Tidak | URL kanonik. Tidak diperlukan karena `auth.config.ts` memakai `trustHost: true`. |

Nama variabel sama dengan `.env.example`. Sisa Neon dan Prisma (`DATABASE_URL`, `DIRECT_URL`,
`SEED_PASSWORD_*`) sudah dibuang dari kedua berkas contoh. `BLOB_READ_WRITE_TOKEN` masih tertinggal di
`.env.example` dan juga tidak dibaca kode aplikasi, sebab berkas SK sekarang disimpan di R2.

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

Push ke `main` sudah cukup untuk merilis; versi baru biasanya aktif 2–8 menit kemudian. Tidak perlu deploy
manual.

Deploy manual dari komputer lokal:

```bash
npm run cf:deploy     # cf:typegen, opennextjs-cloudflare build, lalu deploy
```

> **Hanya jalankan dari Linux atau WSL, jangan dari Windows.** OpenNext mencetak `WARN OpenNext is not
> fully compatible with Windows`, dan kegagalan menyalin paket muncul sebagai baris
> `ERROR Failed to copy ...\node_modules\<paket>` yang **tidak** menggagalkan build. Perintah tetap selesai
> dengan sukses, aset terunggah, binding terdaftar benar, dan wrangler melaporkan `Deployed sim-kgb
> triggers` — padahal bundle-nya kehilangan modul dan setiap request menjadi 500. Pada 2026-09-29 hal ini
> menjatuhkan produksi selama dua menit, sementara build CI dari commit yang sama persis sehat.
>
> Bila terpaksa deploy dari lokal, segera cek `curl -o /dev/null -w '%{http_code}' https://<domain-produksi>/`
> sesudahnya. Bila 500, kembalikan dengan:
>
> ```bash
> npx wrangler rollback <version-id-sebelumnya> --name sim-kgb
> ```
>
> Daftar versi sebelumnya ada di `npx wrangler deployments list --name sim-kgb`.

Peringatan `A DurableObjectNamespace in the config referenced the class "PembatasCekKgb", but no such
Durable Object class is exported from the worker` saat deploy bukan tanda kerusakan. Peringatan itu berasal
dari tahap populate cache yang memuat `.open-next/worker.js` langsung, sedangkan kelasnya diekspor dari
pembungkus `worker-entry.js`. Build yang sehat pun menampilkannya.

`cloudflare-env.d.ts` dibuat oleh `npm run cf:typegen` dan tidak disimpan di Git. Tanpa berkas itu,
`tsc` melaporkan `Property 'SK_BUCKET' does not exist on type 'CloudflareEnv'`. Jalankan ulang setelah
mengubah binding di `wrangler.jsonc`.

## 6. Cron harian

1. Kedua Cron Trigger memanggil handler `scheduled` di `worker-entry.js`.
2. Handler itu memanggil `https://sim-kgb.internal/api/cron/cadangan`, lalu pada cron `0 0 * * *` juga
   `https://sim-kgb.internal/api/cron/notifikasi`, lewat binding `WORKER_SELF_REFERENCE` dengan header
   `Authorization: Bearer <CRON_SECRET>`.
3. `app/api/cron/cadangan/route.ts` (ADR-084) menyimpan cadangan seluruh basis data ke R2
   `cadangan/otomatis/<waktu>.jsonl.gz`. Sesudahnya route membuang cadangan yang melewati masa simpan, berkas di
   `terhapus/` yang lebih tua dari 90 hari, dan `jejak_data` yang lebih tua dari 90 hari. Daftar dan unduhannya ada di
   menu Cadangkan data (Super Admin). Pemulihan memakai `scripts/pulihkan-cadangan.ts` dan
   `docs/sql/pulihkan-jejak-data.sql`.
4. `app/api/cron/notifikasi/route.ts` menjawab 503 bila `CRON_SECRET` belum diisi dan 401 bila token
   tidak cocok. Bila token cocok, route menjalankan:
   - `bersihkanHukdisKedaluwarsa()` (`lib/hukdisKedaluwarsa.ts`): menonaktifkan penanda hukdis pegawai
     yang sudah lewat tanggal berakhir. Kegagalan langkah ini dicatat dan tidak menghentikan langkah berikutnya.
   - `generateNotifikasi()` (`lib/generateNotifikasi.ts`): membuat notifikasi harian.

Hasil dan galat terlihat di log Worker (observability aktif). Untuk menguji tanpa menunggu jadwal:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain-produksi>/api/cron/notifikasi
curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain-produksi>/api/cron/cadangan
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
