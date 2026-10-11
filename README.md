# SIM-KGB

Sistem Informasi Manajemen **Kenaikan Gaji Berkala (KGB)** Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan, Kementerian Imigrasi dan Pemasyarakatan RI.

Aplikasi web tunggal untuk mengelola data pegawai Kanwil dan UPT, proses KGB (Input KGB, Buat SK, Unggah SK TTE, konfirmasi keuangan), hukuman disiplin (hukdis), pembuatan SK KGB dalam PDF, rekap per bulan TMT, notifikasi, dan laporan. Semua tanggal dihitung menurut WITA (Asia/Makassar).

## Teknologi

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript 5**
- **Tailwind CSS v4** (dashboard sebagian besar memakai gaya inline dan token CSS di `app/globals.css`)
- **NextAuth v5** (masuk dengan NIP dan password, peran di `lib/auth/roles.ts`)
- **@react-pdf/renderer** (SK KGB biasa dan versi Srikandi, disusun di peramban: `lib/generateSuratKGB.tsx`)
- Deploy: **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), basis data **Cloudflare D1** (`DB`), berkas SK di **Cloudflare R2** (`SK_BUCKET`)

## Penyimpanan data

Semua route membaca dan menulis lewat `import { db } from "@/lib/db"`. Penyimpanan dipilih di `lib/db/index.ts` lewat `DATA_BACKEND`:

- `d1`: **Cloudflare D1**, basis data produksi (ADR-085).
- `sheets`: Google Sheets. Bawaan `next dev` bila `DATA_BACKEND` kosong.
- `lokal`: berkas JSON lokal, khusus pengembangan.

Di produksi `DATA_BACKEND` wajib terisi (`d1`); tanpa itu aplikasi menolak berjalan, supaya tulisan tidak mengalir diam-diam ke penyimpanan lain. Skema D1 ada di `d1/migrations/` dan diterapkan dengan `wrangler d1 migrations apply` **sebelum** kode yang membutuhkannya di-deploy; commit yang menambah kolom harus disertai migrasinya. Lihat bagian Penyimpanan data di `DEPLOY-CLOUDFLARE.md`.

Definisi tab Sheets ada di `lib/sheets/tables.ts`. Tabel dan kolomnya harus tetap sama dengan skema D1 (`lib/db/d1/skema.test.ts` menagihnya). Supabase dilepas di ADR-102; migrasinya tinggal arsip di `supabase/migrations/`.

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
| `DATA_BACKEND` | `d1` (wajib di produksi), `sheets`, atau `lokal`; kosong berarti `sheets` hanya di pengembangan |
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

Route group tanpa login dengan kerangka sendiri: `layout.tsx` memasang nav melayang (`NavPublik.tsx`), kaki halaman (`KakiPublik.tsx`), tombol kembali ke atas (`DokPublik.tsx`), dan gerak masuk saat digulir (`Muncul.tsx`). Bahasa visualnya "tangga gaji": kertas hangat, tinta biru tua, judul serif, dan motif anak tangga (`GarisTangga.tsx`) yang digambar dari tabel gaji; hanya bertema terang. Alasan tiap keputusannya ada di [`docs/adr/ADR-001-halaman-publik-tangga-gaji.md`](docs/adr/ADR-001-halaman-publik-tangga-gaji.md). Semua gaya berada di bawah kelas `.pub`, sehingga tidak bercampur dengan dashboard; token dan kelas bersama didokumentasikan di awal `publik.css`, kerangka di `kerangka.css`, beranda di `kgb/beranda.css`, dan panggung dokumen di `kgb/perjalanan.css`. Kelas khusus halaman berawalan `tg-`/`cs-`/`jd-`/`st-` (beranda), `tb-` (tabel gaji), `ip-` (info pegawai di beranda), dan `lg-` (masuk).

| Route | Isi |
|-------|-----|
| `/kgb` | Cek status KGB menurut NIP (`CekStatus.tsx`, `GET /api/public/cek-kgb`), lanskap tangga gaji three.js (`kgb/tangga/`), alur satu usulan, jadwal pengusulan, arti status, dan info untuk pegawai (`#info-pegawai`: jadwal KGB, KGB pertama CPNS ke PNS, kenaikan pangkat, pertanyaan umum). Label status dari `lib/statusKgb.ts`. |
| `/tabel-gaji` | Lampiran PP Nomor 5 Tahun 2024 sebagai tabel digital: tab per golongan, pencarian masa kerja yang menandai gaji yang berlaku. Sumbernya `tanggaGaji()` di `lib/tabelGaji.ts`. |
| `/panduan` | Dialihkan permanen ke `/kgb#info-pegawai`. Panduan kerja petugas ada di dalam dashboard (`/dashboard/panduan`). |
| `/login` | Masuk untuk pengelola, dengan dialog Lupa password yang membuka WhatsApp admin (`GET /api/public/kontak`). |

### Lanskap tangga gaji (`kgb/tangga/`)

- `tata.ts` menyusun 272 anak tangga menjadi balok dan menguji potongan sinar, tanpa impor three.js, sehingga teruji di `tata.test.ts`.
- `LanskapGaji.tsx` menggambar seluruh balok dalam satu draw call (`InstancedBufferGeometry` + shader sendiri) dan hanya merender bingkai saat ada yang bergerak.
- `PenjelajahTangga.tsx` memegang pilihan golongan dan masa kerja; kendali `<select>` dan `<input type="range">` adalah jalur utama, lanskap hanya ilustrasi (`aria-hidden`).
- `TanggaSvg.tsx` tampil lebih dulu selagi three.js dimuat, dan menggantikannya bila WebGL tidak tersedia. three.js dimuat lazy setelah halaman tenang dan dilewati saat mode hemat data.

### Memelihara panduan (`/dashboard/panduan`)

- Panduan hanya untuk petugas yang masuk. Bagian yang tampil lebih dulu mengikuti role akun (`PERAN_UNTUK_ROLE` di `app/dashboard/panduan/peran.ts`): Admin UPT, Tim SDM KGB, Tim SDM Hukdis, Keuangan Kanwil, atau Super Admin; pembaca boleh beralih ke peran lain atau Semua. Isinya di `IsiPanduan.tsx`, navigasinya di `NavigasiPanduan.tsx`, dan gayanya memakai kelas publik (`publik.css`) di dalam pembungkus `.pub.pg-dasbor` (`panduan.css`).
- Contoh perhitungan, jendela proses, dan tabel KPPN dihitung dari `lib/tabelGaji.ts` dan `lib/satker.ts`, sehingga ikut berubah bila kode berubah.
- Nama menu, tombol, dan judul jendela ditulis persis seperti di dashboard. Bila label di `app/dashboard` atau `app/dashboard/components/kgb` berubah, perbarui `app/dashboard/panduan/IsiPanduan.tsx` pada perubahan yang sama.
- Rumusan dasar hukum berasal dari hasil penelusuran peraturan; ubah hanya bila ada peraturan baru.
- Yang perlu diketahui pegawai (tanpa akun) ada di `/kgb#info-pegawai`; jaga agar isinya selaras dengan panduan.

## Struktur

```
app/(publik)/        Halaman publik: /kgb, /tabel-gaji, /login (/panduan dialihkan ke /kgb#info-pegawai)
docs/adr/            Catatan keputusan arsitektur
app/dashboard/       Halaman pengelola; komponen modal KGB bersama di components/kgb
app/api/             Route API (kgb, pegawai, hukdis, keuangan, notifikasi, cron, public)
lib/                 Logika domain murni dan teruji (tabelGaji, jadwalKgb, prosesKgb, waktu, satker, statusKgb, dsb.)
lib/db/              Pemilih penyimpanan, repository D1, dan helper bersama (kondisi, nama, nilai)
lib/sheets/          Klien dan definisi tab Google Sheets
lib/auth/            Peran dan helper hak akses
lib/ui/              themeMode.ts: hook useThemeMode (mode terang/gelap dashboard, kunci kgb-theme), dipakai DashboardShell dan Sidebar
d1/migrations/       Skema D1 (basis data produksi)
supabase/migrations/ Arsip skema Supabase (dilepas di ADR-102, tidak dijaga sejalan)
scripts/             Utilitas penyiapan dan migrasi data
worker-entry.js      Wrapper worker Cloudflare (fetch + scheduled)
wrangler.jsonc       Konfigurasi Cloudflare Workers
open-next.config.ts  Konfigurasi OpenNext
```
