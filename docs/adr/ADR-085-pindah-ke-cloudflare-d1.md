# ADR-085: Basis data pindah dari Supabase ke Cloudflare D1

Tanggal: 8 Oktober 2026
Status: diterima. Kode siap; peralihan produksi dijalankan terpisah (lihat "Peralihan").
Pelepasan Supabase: ADR-102. Adaptor Supabase dan alat Pindah D1 sudah dilepas di sana, jadi "Peralihan" dan langkah
"Kembali ke Supabase" di bawah tinggal riwayat.

## Konteks

SIM-KGB menyimpan seluruh data di Supabase berpaket Free, sedangkan aplikasinya berjalan di Cloudflare Workers Paid
(US$5/bulan sejak 8 Oktober 2026). Setiap halaman menarik data dari Supabase lewat internet, dan tarikan itu dihitung
sebagai egress dengan kuota 5 GB per bulan.

Pengukuran 8 Oktober 2026:
- Seluruh basis data berukuran ±1,1 MB.
- Lalu lintas rata-rata ±5.900 permintaan per hari.
- Beberapa halaman membaca tabel utuh, misalnya Dashboard Kanwil yang menarik ±230 KB setiap kali dibuka.
- Perkiraan egress sekarang ±6 GB per bulan bila tanpa pemampatan. Untuk 19 UPT dan ±1.300 pegawai perkiraannya
  8–60 GB per bulan.

Bila kuota Free terlampaui, proyek Supabase dapat dibatasi, dan karena semua data di sana, aplikasi ikut berhenti. Paket
Pro berbiaya US$25 per bulan.

Cloudflare D1 sudah termasuk Workers Paid:
- 25 miliar baris dibaca dan 50 juta baris ditulis per bulan, serta 5 GB penyimpanan.
- **Tanpa biaya egress.**
- Time Travel untuk memulihkan database ke menit mana pun dalam 30 hari.

Pilihan pengguna: pindah ke D1.

## Keputusan

1. **Adaptor D1** (`lib/db/d1/`) memenuhi kontrak `Repo` yang sama dengan Supabase dan penyimpanan lokal, dan dipilih
   lewat `DATA_BACKEND=d1`. Route dan logika aplikasi tidak berubah.
   - Filter memakai pohon `Kondisi` yang sama dengan Supabase (lib/db/supabase/filter.ts), diterjemahkan ke SQLite. Daftar
     `in` dikirim sebagai satu parameter JSON (`json_each`), karena D1 membatasi 100 parameter per pernyataan.
   - Waktu disimpan sebagai teks ISO UTC (`toISOString`), boolean sebagai 0/1. Teks yang tidak bertanda waktu dibaca
     seperti Postgres, sebagai tengah malam UTC.
   - Urutan bawaan mengikuti `urutan_sisip` (INTEGER PRIMARY KEY AUTOINCREMENT), sama dengan urutan baris dimasukkan di
     Supabase.
   - Menulis banyak baris memakai batch D1, yang berjalan sebagai satu transaksi.
2. **Skema D1** (`d1/migrations/`) disusun dari skema akhir Postgres (seluruh `supabase/migrations` dijalankan di
   PostgreSQL sungguhan/PGlite, lalu dibaca dari `information_schema`). Kolom, nilai bawaan (UUID, `now()`), NOT NULL,
   UNIQUE, CHECK, foreign key beserta ON DELETE, dan indeks dibuat setara.
   - `lib/db/d1/skema.ts` mencatat jenis tiap kolom.
   - `lib/db/d1/skema.test.ts` menagih bahwa migrasi D1, `skema.ts`, definisi kolom aplikasi, dan migrasi Supabase
     tetap sejalan.
3. **Jejak perubahan** (ADR-084) dibuat sebagai trigger SQLite per tabel (`0002_jejak_data.sql`).
   - D1 membatasi `json_object` 32 argumen, jadi isi lama disusun per 15 kolom lalu digabung `json_patch`.
   - Kolom yang ditambahkan kemudian menuntut trigger tabelnya dibuat ulang di migrasi yang sama, seperti
     `0003_usulan_penetap_sk_terakhir.sql`. Uji skema menagih ini.
4. **Cadangan otomatis, jejak, dan pemulihan** ikut D1:
   - Cadangan berbentuk `d1`.
   - Pemangkasan jejak 90 hari dijalankan di D1.
   - `scripts/pulihkan-cadangan.ts` menyusun SQL SQLite: dari berkas cadangan (`--dialek d1`, termasuk dari cadangan
     Supabase lama), dari jejak (`--jejak <tabel> --dari … --sampai …`), atau untuk satu baris (`--jejak-id`).
   - SQL itu dijalankan di konsol D1 atau dengan `wrangler d1 execute sim-kgb --remote --file …`.
5. **Alat pemindahan** (`lib/pindahD1.ts`, `/api/admin/pindah-d1`, panel Super Admin di Cadangkan data):
   - **Salin semua** mengosongkan D1 lalu mengisinya dengan seluruh data Supabase dalam satu batch: seluruhnya berhasil,
     atau D1 tidak berubah. Langkah ini hanya boleh selama Supabase masih aktif.
   - **Salin yang tertinggal** hanya menambah baris yang belum ada di D1.
   - **Bandingkan** menunjukkan jumlah dan selisih id per tabel.
6. **Migrasi D1 dijalankan dengan** `npx wrangler d1 migrations apply sim-kgb --remote` sebelum kode yang
   membutuhkannya di-deploy. Ini menggantikan SQL Editor Supabase.
   - Berkas SQL wajib berakhir baris LF (`.gitattributes`). D1 menolak trigger yang memuat CR ("incomplete input"),
     sedangkan git di Windows mengubahnya menjadi CRLF.

## Peralihan

Database D1 `sim-kgb` (APAC) sudah dibuat dan ketiga migrasinya sudah diterapkan, masih tanpa data. Langkah peralihan
dijalankan malam hari atas aba-aba pengguna:

1. Merge PR ini lalu deploy (Workers Builds). Basis data tetap Supabase, karena `DATA_BACKEND` belum diatur.
2. Super Admin, di Cadangkan data:
   1. Tekan **Cadangkan sekarang** (cadangan terakhir dari Supabase).
   2. Tekan **Salin semua ke D1**.
   3. Tekan **Bandingkan**. Semua tabel harus sama.
3. Atur secret `DATA_BACKEND=d1` (`npx wrangler secret put DATA_BACKEND`). Worker langsung memakai D1 tanpa build ulang.
4. **Bandingkan** lagi. Bila ada baris yang tertulis ke Supabase tepat saat peralihan, tekan **Salin yang tertinggal**.
5. Periksa aplikasi: login, dashboard, usulan, KGB, lalu **Cadangkan sekarang** (cadangan pertama berbentuk `d1`).

**Kembali ke Supabase** bila ada masalah: hapus secret `DATA_BACKEND`. Data yang ditulis ke D1 sesudah peralihan perlu
disalin balik dari cadangan D1. Supabase disimpan tanpa diubah selama dua minggu, lalu dilepas dalam ADR tersendiri
(beserta adaptor Supabase dan uji kesejalanan migrasinya).

## Uji

- Uji D1 berjalan di atas skema D1 sungguhan pada SQLite (node:sqlite):
  - adaptor (urutan, null, `in` 1.000 id dalam satu kueri, batas parameter, batch, cascade);
  - kesetaraan filter dengan pencocokan aplikasi;
  - kesejalanan skema dan trigger;
  - penyalinan dari baris berbentuk Postgres, yang dibaca sama persis dengan repository Supabase;
  - SQL pemulihan.
- D1 lokal (Miniflare) diisi data uji yang sama dengan penyimpanan lokal:
  - 102 jawaban API dari empat peran sama persis antara kedua penyimpanan;
  - alur usulan sampai disetujui Kanwil, cadangan otomatis, dan dokumen terhapus berjalan di D1.
- Uji pendahuluan dengan cadangan produksi 8 Oktober 2026 (1.815 baris):
  - tersalin dalam satu batch, 0 pelanggaran foreign key;
  - bacaan aplikasi dari D1 sama persis dengan bacaan dari Supabase.
- Di D1 produksi (masih kosong), nilai bawaan dan trigger diuji dengan satu baris sementara, lalu dibersihkan.

## Catatan peralihan, 8 Oktober 2026 malam

- Secret `DATA_BACKEND=d1` sempat dipasang sebelum Salin semua, sehingga aplikasi membaca D1 kosong selama ±1 menit
  (20.17–20.18 WITA). Lalu dikembalikan ke `supabase`. Tidak ada data yang tertulis ke D1 selama itu. Sejak itu Salin semua
  ditolak server bila basis data aktif sudah D1 (PR #52).
- Peralihan yang sah: Salin semua pukul 20.21 WITA, `DATA_BACKEND=d1` pukul 20.25 WITA.
- Susulan hanya menambah baris baru. Tiga draf usulan UPT yang disimpan ulang di Supabase di antara kedua waktu itu tidak
  ikut. Karena itu ditambahkan **Selaraskan perubahan** (`selaraskanPerubahan`):
  - membaca jejak_data Supabase (ADR-084) sejak Salin semua terakhir di log audit D1, dikurangi jeda 5 menit;
  - menimpa baris D1 dengan isi Supabase terbaru, atau menghapusnya bila sudah dihapus di Supabase;
  - baris yang sudah diubah lagi di D1 sesudah salinan tidak ditimpa dan dilaporkan sebagai bentrok.
