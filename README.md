# SIM-KGB

Sistem Informasi Manajemen **Kenaikan Gaji Berkala (KGB)** Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan, Kementerian Imigrasi dan Pemasyarakatan RI.

Aplikasi web tunggal untuk mengelola data pegawai Kanwil dan UPT, proses KGB (Input KGB, Buat SK, Unggah SK TTE, konfirmasi keuangan), hukuman disiplin (hukdis), pembuatan SK KGB dalam PDF, rekap per bulan TMT, notifikasi, dan laporan. Semua tanggal dihitung menurut WITA (Asia/Makassar).

## Teknologi

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript 5**
- **Tailwind CSS v4** (dashboard sebagian besar memakai gaya inline dan token CSS di `app/globals.css`)
- **NextAuth v5** (masuk dengan NIP dan password, peran di `lib/auth/roles.ts`)
- **@react-pdf/renderer** (SK KGB biasa dan versi Srikandi, `lib/generateSuratKGB.tsx`)
- Deploy: **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), berkas SK di **Cloudflare R2** (`SK_BUCKET`)

## Penyimpanan data

Semua route membaca dan menulis lewat `import { db } from "@/lib/db"`. Penyimpanan dipilih di `lib/db/index.ts`:

- `DATA_BACKEND=sheets` atau `DATA_BACKEND=supabase` memilih secara tegas.
- Tanpa `DATA_BACKEND`, Supabase dipakai bila `SUPABASE_URL` diisi; selain itu **Google Sheets** (penyimpanan produksi saat ini).

Definisi tab Sheets ada di `lib/sheets/tables.ts`; skema Supabase untuk migrasi ada di `supabase/migrations/`. Keduanya harus tetap memuat tabel dan kolom yang sama.

## Menjalankan lokal

```bash
npm install
npm run dev                   # http://localhost:3100
```

Variabel environment diisi di `.env` untuk `next dev` dan di secret Cloudflare untuk produksi (contoh: `.env.example`, `.dev.vars.example`).

| Variabel | Kegunaan |
|----------|----------|
| `GOOGLE_SHEET_ID` | Spreadsheet data (backend Sheets) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Akun layanan Google untuk Sheets |
| `DATA_BACKEND` | Opsional: `sheets` atau `supabase` |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Backend Supabase |
| `AUTH_SECRET` | Secret NextAuth v5 |
| `CRON_SECRET` | Bearer token endpoint cron harian |

## Skrip dan pemeriksaan

| Perintah | Aksi |
|----------|------|
| `npm run dev` | Dev server (port 3100) |
| `npm run build` | `next build` |
| `npm run lint` | ESLint |
| `npm run cf:build` | Build bundel Cloudflare (OpenNext) |
| `npm run cf:preview` | Preview worker lokal |
| `npm run cf:deploy` | Deploy ke Cloudflare Workers |
| `npm run cf:typegen` | Regenerasi `cloudflare-env.d.ts` dari `wrangler.jsonc` |
| `node --import tsx --test lib/**/*.test.ts` | Uji unit logika murni di `lib/` |

## Deploy dan cron

Worker utama adalah `worker-entry.js`, yang membungkus output OpenNext dan menambahkan handler `scheduled`. Cron Trigger `0 0 * * *` (08:00 WITA) memanggil `/api/cron/notifikasi` dengan `CRON_SECRET`. Endpoint itu menonaktifkan penanda hukdis yang sudah lewat tanggal berakhir (`lib/hukdisKedaluwarsa.ts`), lalu membuat notifikasi harian (`lib/generateNotifikasi.ts`). Catatan deploy ada di [`DEPLOY-CLOUDFLARE.md`](DEPLOY-CLOUDFLARE.md).

## Halaman publik: `app/(publik)`

Route group tanpa login dengan kerangka sendiri: `layout.tsx` memasang nav melayang (`NavPublik.tsx`), kaki halaman (`KakiPublik.tsx`), dok jam layanan dan tombol ke atas (`DokPublik.tsx`), serta gerak masuk saat digulir (`Muncul.tsx`). Bahasa visualnya mengikuti portal SDM Pas Kalsel dan hanya bertema terang. Semua gaya berada di bawah kelas `.pub`, sehingga tidak bercampur dengan dashboard; token dan kelas bersama didokumentasikan di awal `publik.css`, kerangka di `kerangka.css`, dan beranda di `kgb/beranda.css`. Beranda `/kgb` memuat lambang partikel three.js (`kgb/LogoPartikel.tsx`) secara lazy; tanpa WebGL atau saat pengguna memilih kurangi gerak, lambang tampil sebagai gambar diam. Kelas khusus halaman berawalan `pg-` (panduan) dan `lg-` (masuk).

| Route | Isi |
|-------|-----|
| `/kgb` | Cek status KGB menurut NIP (`CekStatus.tsx`, `GET /api/public/cek-kgb`). Label status dari `lib/statusKgb.ts`. |
| `/panduan` | Panduan KGB untuk admin UPT, Tata Usaha, Tim SDM, dan keuangan: kewenangan, jadwal, surat permohonan, langkah di SIM-KGB, konfirmasi keuangan, pengiriman SK dan KPPN mitra, contoh kasus, arti status, dan dasar hukum. |
| `/login` | Masuk untuk pengelola, dengan dialog Lupa password yang membuka WhatsApp admin (`GET /api/public/kontak`). |

### Memelihara `/panduan`

- Contoh perhitungan, jendela proses, dan tabel KPPN dihitung dari `lib/tabelGaji.ts` dan `lib/satker.ts`, sehingga ikut berubah bila kode berubah.
- Nama menu, tombol, dan judul jendela ditulis persis seperti di dashboard. Bila label di `app/dashboard` atau `app/dashboard/components/kgb` berubah, perbarui `app/(publik)/panduan/page.tsx` pada perubahan yang sama.
- Rumusan dasar hukum berasal dari hasil penelusuran peraturan; ubah hanya bila ada peraturan baru.
- `/dashboard/panduan` dialihkan ke `/panduan`, dan menu Panduan di sidebar membukanya di tab baru.

## Struktur

```
app/(publik)/        Halaman publik: /kgb, /panduan, /login
app/dashboard/       Halaman pengelola; komponen modal KGB bersama di components/kgb
app/api/             Route API (kgb, pegawai, hukdis, keuangan, notifikasi, cron, public)
lib/                 Logika domain murni dan teruji (tabelGaji, jadwalKgb, prosesKgb, waktu, satker, statusKgb, dsb.)
lib/db/              Pemilih penyimpanan dan repository Supabase
lib/sheets/          Klien dan definisi tab Google Sheets
lib/auth/            Peran dan helper hak akses
lib/ui/              themeMode.ts: hook useThemeMode (mode terang/gelap dashboard, kunci kgb-theme), dipakai DashboardShell dan Sidebar
supabase/migrations/ Skema awal Supabase
scripts/             Utilitas penyiapan dan migrasi data
worker-entry.js      Wrapper worker Cloudflare (fetch + scheduled)
wrangler.jsonc       Konfigurasi Cloudflare Workers
open-next.config.ts  Konfigurasi OpenNext
```
