# ADR-102: Adaptor Supabase dan alat Pindah D1 dilepas; merge hanya sesudah gerbang data terpenuhi

Tanggal: 11 Oktober 2026
Status: diusulkan. Berlaku setelah PR dilebur, dan tidak sebelum 22 Oktober 2026. Menjalankan rencana pelepasan di ADR-085.

## Konteks

ADR-085 memindahkan basis data produksi dari Supabase ke Cloudflare D1 pada 8 Oktober 2026 pukul 20.25 WITA, dan
menyimpan Supabase tanpa diubah selama dua minggu, lalu melepasnya "dalam ADR tersendiri (beserta adaptor Supabase dan
uji kesejalanan migrasinya)". Ini ADR itu.

Menurut ADR-085, sejak peralihan Supabase tidak lagi menerima tulisan. Kembali ke Supabase berarti kehilangan data yang
ditulis sesudahnya (misalnya SK yang diunggah 10 Oktober, ADR-096). Pengaman pemulihan yang nyata adalah Time Travel D1
(30 hari), cadangan R2 dua kali sehari (ADR-084), dan `jejak_data` (90 hari).

Supabase berpaket Free, jadi alasan melepasnya bukan biaya (Rp0), melainkan beban dan risiko yang tersisa:

1. **Dua jalur skema.** Setiap kolom baru ditulis di dua migrasi (D1 dan `supabase/migrations`) dan ditagih uji
   kesejalanan. ADR-096 melakukannya: `d1/migrations/0005_sk_sidik_ttd.sql` dan
   `supabase/migrations/20261010150000_sk_sidik_ttd.sql`.
2. **Kode yang tidak lagi berjalan di produksi:** klien REST, repository Supabase, jejak Postgres, `GalatSupabase`, dan
   alat Pindah D1.
3. **Jebakan data.** Tanpa `DATA_BACKEND`, kode memilih Supabase bila `SUPABASE_URL` terisi, selain itu Google Sheets.
   Bila secret `DATA_BACKEND` hilang atau terhapus (langkah "kembali ke Supabase" di ADR-085 persis menyuruh
   menghapusnya), tulisan baru diam-diam mengalir ke penyimpanan yang sudah usang, dan tidak ada yang tahu.

Pengguna menegaskan satu syarat: **jangan sampai ada data yang hilang.** Karena itu PR ini hanya mengubah kode. Ia tidak
mengubah skema, tidak menjalankan migrasi, tidak menyentuh D1, R2, maupun proyek Supabase, dan tidak boleh dilebur
sebelum gerbang data di bawah terpenuhi.

## Keputusan

1. **Adaptor Supabase dilepas:** `lib/db/supabase/` (klien REST `rest.ts`, `table.ts`, `tables.ts`, dan ujinya).
   `lib/db/index.ts` hanya memilih antara D1, Sheets, dan lokal.
2. **Bagian yang ternyata dipakai D1 dipindahkan, bukan dihapus:**
   - `lib/db/kondisi.ts` (pohon `Kondisi` dan `keKondisi`); serialisasi PostgREST-nya dibuang;
   - `lib/db/nama.ts` (`keSnake`, `namaTabel`, `KOLOM_URUTAN`);
   - `lib/db/nilai.ts` (`keJson`); `dariJson` dibuang karena hanya dipakai Supabase.

   Pemindahan memakai `git mv`, sehingga riwayat berkasnya tetap.
3. **Alat Pindah D1 dilepas:** `lib/pindahD1.ts`, `/api/admin/pindah-d1`, dan panelnya di Cadangkan data. Alat ini membaca
   Supabase, dan salah satu tombolnya (Salin semua) mengosongkan D1 sebelum menyalin. Server sudah menolaknya selama D1
   aktif (ADR-085), tetapi tombol seperti itu tidak boleh dibiarkan tanpa fungsi.
4. **Cadangan lama tetap dapat dipulihkan.** Pembaca berkas bentuk `postgres` (`lib/pulihkanCadangan.ts`,
   `lib/db/d1/barisMentah.ts`) dan `scripts/pulihkan-cadangan.ts` dengan kedua dialeknya (`d1` dan `postgres`) tidak
   dihapus. Hanya pembuatan cadangan dari Supabase (`sumberSupabase`) yang dilepas.
5. **`DATA_BACKEND` dipertegas:**
   - `supabase` ditolak dengan pesan yang menunjuk ke ADR ini dan ke `d1`;
   - di produksi (`NODE_ENV=production`), `DATA_BACKEND` yang kosong membuat aplikasi menolak berjalan, bukan memilih
     penyimpanan lain secara diam-diam;
   - pengembangan (`next dev`) tetap memakai Google Sheets bila kosong.

   Akibatnya langkah "hapus secret `DATA_BACKEND` untuk kembali ke Supabase" di ADR-085 tidak berlaku lagi.
6. **Cadangan "kolom belum dimigrasikan" khusus Supabase dibuang:** `lib/acuanUsulanServer.ts`
   (`tulisDenganAcuan`, `tulisBanyakDenganAcuan`), cabang `PGRST204` di `PATCH /api/kgb/[id]` dan `POST /api/cadangan`,
   serta cabang Supabase di `tabelBelumAda` dan `pengamanData`. Cabang-cabang itu hanya aktif untuk `GalatSupabase`;
   galat D1 bukan `GalatSupabase`, jadi di produksi sekarang tidak pernah tereksekusi. Pemanggilnya menulis langsung ke
   `db`, dengan perilaku D1 yang sama. Di D1 kolom yang belum ada menggagalkan seluruh penulisan, tidak ada isian yang
   diam-diam dibuang. Urutan "terapkan migrasi D1, baru deploy" tetap berlaku.
7. **Sengaja tidak dihapus (arsip):**
   - `supabase/migrations/` dan `docs/sql/*.sql`: bahan untuk membaca atau memulihkan arsip Postgres. Mulai sekarang
     tidak dijaga sejalan dengan D1, dan uji kesejalanannya dilepas;
   - backend Google Sheets dan `lokal` untuk pengembangan;
   - `.mcp.json`: dihapus bersamaan dengan proyek Supabase, bukan sekarang.

## Gerbang data

Semua butir di bawah harus terpenuhi, dikerjakan pengelola (Super Admin) pada versi produksi **yang masih memuat alat
Pindah D1**, lalu dicatat di PR sebelum dilebur.

1. **Tanggal.** Tidak lebih awal dari 22 Oktober 2026.
2. **Tidak ada data Supabase yang belum ada di D1.** Menu Cadangkan data, panel Pemindahan basis data, tekan
   **Bandingkan**. Basis data aktif harus tertulis Cloudflare D1. Untuk setiap tabel, kolom **Belum di D1** harus `–`,
   atau setiap id-nya terbukti sengaja dihapus di D1 sesudah peralihan:

   ```sql
   SELECT tabel, id_baris, waktu FROM jejak_data
   WHERE aksi = 'hapus' AND waktu >= '2026-10-08T12:25:00.000Z' ORDER BY waktu;
   ```

   (20.25 WITA = 12.25 UTC.) Tabel `notifikasi`, `pengumuman_dilihat`, dan `profile_change_request` tidak dijejak;
   selisih di tiga tabel itu ditinjau manual. Kolom **Hanya di D1** wajar berisi: itu data baru sejak peralihan.
3. **Cadangan D1 terbaru utuh.** Tekan **Cadangkan sekarang**, lalu pastikan ada cadangan berbentuk `d1` dengan penutup
   jumlah per tabel.
4. **Arsip Supabase tersimpan di luar akun Cloudflare dan terverifikasi.** Dua salinan, supaya tidak bergantung pada satu:
   - cadangan otomatis bentuk Supabase terakhir (8 Oktober 2026, sebelum 20.25 WITA), diunduh dari Cadangkan data;
   - ekspor penuh proyek Supabase (`pg_dump` atau ekspor dari dashboard), termasuk `jejak_data` dan `users`. Hash sandi
     tidak ikut cadangan aplikasi (ADR-084), jadi ekspor ini satu-satunya salinan terpisah dari D1.

   Jumlah baris per tabel di ekspor dicocokkan dengan penutup cadangan.
5. **Titik pemulihan D1 dicatat:** `npx wrangler d1 time-travel info sim-kgb`. Simpan bookmark dan waktunya di PR.
6. **Migrasi D1 tuntas:** `npx wrangler d1 migrations list sim-kgb --remote` tidak menyisakan migrasi yang belum
   diterapkan.
7. **`DATA_BACKEND` terpasang:** `npx wrangler secret list` memuat `DATA_BACKEND`, dan panel pada butir 2 menyebut D1
   aktif. Tanpa itu, versi baru akan menolak berjalan (keputusan 5).

## Sesudah merge

1. Workers Builds men-deploy versi baru. Periksa `/login`, dashboard, satu usulan, dan **Cadangkan sekarang**
   (menu ini tetap ada, hanya panel Pindah D1 yang hilang).
2. Hapus secret `SUPABASE_URL` dan `SUPABASE_SECRET_KEY` dari Worker, **sesudah** deploy terbukti sehat, bukan sebelumnya.
3. Proyek Supabase dibiarkan sampai arsip pada butir 4 gerbang terverifikasi. Menghapus proyek dan `.mcp.json` adalah
   keputusan pengelola yang terpisah, dan tidak dapat dibatalkan.

## Pemulihan

- **Kode:** kembalikan versi sebelumnya dengan `npx wrangler rollback <version-id> --name sim-kgb`
  (`npx wrangler deployments list --name sim-kgb`), atau revert PR ini. Adaptor terakhir ada di commit `010c184` (main per
  11 Oktober 2026). Karena PR ini tidak mengubah data, rollback kode aman kapan saja.
- **Data:** Time Travel D1 selama 30 hari (`npx wrangler d1 time-travel restore sim-kgb --timestamp=…`), cadangan R2 dua
  kali sehari dengan `scripts/pulihkan-cadangan.ts`, dan `jejak_data` 90 hari. Cadangan semasa Supabase tetap dapat
  dikembalikan ke D1 dengan `--dialek d1`.
- Kembali ke Supabase sebagai basis data aktif tidak lagi didukung, dan sejak 8 Oktober pun sudah tidak praktis.

## Akibat

- Kolom baru cukup satu migrasi D1; `lib/db/d1/skema.test.ts` tetap menagih kesejalanannya dengan `lib/db/d1/skema.ts`
  dan definisi kolom aplikasi.
- Jumlah uji turun dari 667 menjadi 653: 16 uji dihapus bersama kodenya (Pindah D1, klien REST, repository Supabase,
  serialisasi PostgREST, dua uji kesejalanan migrasi Supabase, satu uji cadangan kolom), dan 2 uji baru untuk pemilihan
  backend. Tidak ada uji untuk kode yang tersisa yang dihapus.
- `DEPLOY-CLOUDFLARE.md`, `README.md`, `.env.example`, dan `.dev.vars.example` tidak lagi menyebut Supabase sebagai
  penyimpanan yang dipakai.
- `DATA_BACKEND` yang lupa dipasang di produksi kini tampak sebagai galat yang jelas, bukan penyimpanan yang salah.

## Uji

- `tsc --noEmit` bersih; ESLint tidak menambah galat (39 galat bawaan, di berkas yang sama sebelum dan sesudah).
- 653 uji lulus, termasuk pemulihan cadangan bentuk Postgres ke D1 (`lib/pulihkanD1.test.ts`).
- `next build` produksi berhasil tanpa `DATA_BACKEND`: tidak ada halaman yang menyentuh basis data saat build, jadi
  aturan baru pada keputusan 5 tidak merusak pipeline deploy.
- Uji baru: `lib/db/index.test.ts` (pilihan backend, `supabase` ditolak, produksi tanpa `DATA_BACKEND` menolak,
  pengembangan memakai Sheets), `lib/db/nama.test.ts`, `lib/db/kondisi.test.ts`.
