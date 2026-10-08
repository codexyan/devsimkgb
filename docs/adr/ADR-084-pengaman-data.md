# ADR-084: Pengaman data: cadangan otomatis, jejak perubahan, dan berkas terhapus

Tanggal: 8 Oktober 2026
Status: berlaku

## Konteks

Pada 7 Oktober 2026, data LPP Perempuan Martapura hilang dalam dua cara (ADR-079):

- Pengajuan 57 pegawai dan persetujuan satu surat terputus di tengah oleh batas CPU paket Workers Free, sehingga
  sebagian data hanya tersimpan setengah.
- Admin UPT menghapus 26 usulan untuk mengulang. Penghapusannya permanen beserta berkas PDF-nya.

Penyebab pertama sudah ditangani: pengiriman bertahap (ADR-079), dan akun Cloudflare naik ke Workers Paid pada 8 Oktober
2026, sehingga batas CPU per permintaan menjadi 30 detik. Penyebab kedua belum. Selama proyek Supabase berpaket Free,
tidak ada cadangan harian Supabase yang dapat dipulihkan sendiri, dan paket berbayarnya (sekitar US$25 per bulan)
sengaja dihindari. Satu-satunya cadangan selama ini adalah unduhan bulanan per akun (ADR-018). Unduhan itu berupa CSV untuk dibaca manusia dan tidak dapat dikembalikan ke basis data begitu saja. Tidak
ada jejak isi lama data yang diubah atau dihapus.

## Keputusan

Empat lapis pengaman ditambahkan. Tidak ada aturan bisnis yang berubah.

1. **Cadangan otomatis seluruh basis data ke R2** (`lib/cadanganOtomatis.ts`, `lib/pengamanData.ts`).
   - Cron Trigger `0 0 * * *` dan `0 12 * * *` (08.00 dan 20.00 WITA) memanggil `/api/cron/cadangan` lewat
     `worker-entry.js`. Cron pagi menjalankan cadangan lebih dulu, baru notifikasi harian.
   - Isinya: semua tabel aplikasi berupa baris Postgres apa adanya, termasuk `urutan_sisip`, dalam satu berkas JSON
     Lines bergzip di `cadangan/otomatis/<waktu>.jsonl.gz`. Format ini dibaca ulang tanpa menebak jenis kolom.
   - Baris terakhir berkas adalah penutup berisi jumlah per tabel. Cadangan tanpa penutup ditandai tidak utuh.
   - Hash sandi akun tidak ikut, sama dengan ADR-018. Akun yang dipulihkan dari cadangan diberi sandi baru.
   - Masa simpan: semua cadangan 30 hari terakhir, lalu cadangan pertama tiap bulan selama 12 bulan. Tiga cadangan
     terbaru tidak pernah dibuang.
   - Super Admin melihat daftarnya di **Cadangkan data → Cadangan otomatis basis data**. Di sana ia dapat mengunduh
     berkasnya dan menekan **Cadangkan sekarang**, misalnya sebelum memproses banyak usulan. Cadangan manual tidak
     diulang dalam lima menit. Unduhan dan cadangan manual tercatat di Log Aktivitas.
2. **Jejak perubahan di Postgres** (migrasi `20261008120000_jejak_data.sql`).
   - Trigger menyalin isi lama setiap baris yang diubah atau dihapus ke `public.jejak_data`, dalam transaksi yang sama
     dengan perubahannya.
   - Tabel yang dijejak: data pokok (pegawai, riwayat KGB dan SK, kenaikan pangkat, PMK, hukdis, mutasi, usulan dan
     laporan UPT, review SK, penandatangan, templat surat, pengaturan).
   - Untuk akun dan log aktivitas, hanya penghapusan yang dijejak. Notifikasi dan penanda pengumuman tidak dijejak.
   - Perubahan yang isinya sama tidak dicatat (`old.* is distinct from new.*`).
   - `id_baris` dibaca lewat `to_jsonb`, supaya trigger tidak pernah gagal. Kegagalan trigger akan ikut membatalkan
     perubahan datanya.
   - Jejak disimpan 90 hari; cron cadangan membuang yang lebih tua.
   - `docs/sql/pulihkan-jejak-data.sql` berisi tiga bagian: melihat jejak, mengembalikan baris yang terhapus, dan
     mengembalikan isi satu baris ke keadaan sebelum perubahan tertentu.
3. **Berkas R2 yang dihapus disimpan 90 hari** (`lib/r2Terhapus.ts`).
   - Berkas usulan, pindaian SK hukdis, berkas SK pegawai yang dihapus permanen, dan arsip dokumen pegawai tidak
     langsung dibuang. Berkasnya dipindahkan ke `terhapus/<kunci asli>` beserta waktu hapusnya, lalu dibuang cron
     sesudah 90 hari.
   - Berkas yang gagal disalin tidak dihapus. Berkas yatim tidak mengganggu apa pun; berkas yang hilang tanpa salinan
     tidak dapat dikembalikan.
   - Mengembalikan berkas: salin `terhapus/<kunci>` ke `<kunci>` di R2.
4. **Alat pemulihan** (`scripts/pulihkan-cadangan.ts`, `lib/pulihkanCadangan.ts`).
   - Skrip ini tidak menyentuh basis data. Ia meringkas isi cadangan, atau menulis SQL untuk baris pilihan menurut
     tabel, `--id`, atau `--cari`. SQL itu dibaca dulu, lalu dijalankan sendiri di Supabase SQL Editor.
   - Baris yang id-nya masih ada dilewati, kecuali dengan `--timpa`.
   - `urutan_sisip` dipertahankan. Penghitungnya dimajukan melewati baris yang dikembalikan, dan tidak pernah
     dimundurkan.

## Cara memulihkan

- **Usulan atau data yang terhapus dalam 90 hari terakhir:** di SQL Editor, jalankan bagian 1
  `docs/sql/pulihkan-jejak-data.sql` untuk menemukan waktu dan baris yang terhapus. Lalu jalankan bagian 2 dengan rentang
  waktu itu. Berkas PDF-nya dikembalikan dari `terhapus/`.
- **Data yang tertimpa keliru:** bagian 3 dengan id jejak yang tepat.
- **Kehilangan lebih besar, atau lebih lama dari 90 hari:** unduh cadangan otomatis yang tepat, lalu jalankan
  `node --import tsx scripts/pulihkan-cadangan.ts <berkas>` untuk melihat isinya dan menyusun SQL per tabel.

## Akibat

- **Migrasi `20261008120000_jejak_data.sql` harus dijalankan manual** di Supabase SQL Editor. Sebelum itu, cadangan
  otomatis dan berkas terhapus sudah berjalan. Panel Super Admin menampilkan "Jejak perubahan belum aktif".
- Ukuran: cadangan dimampatkan gzip. Per 8 Oktober 2026 isi basis data masih kecil, dan dua cadangan sehari menambah
  lalu lintas Supabase hanya sekitar dua kali ukuran basis data per hari. Jejak 90 hari dan berkas terhapus menambah
  pemakaian Postgres dan R2, tetapi masih jauh di bawah kuota Free Supabase (500 MB) dan R2 (10 GB).
- Cadangan dan sumber datanya berada di akun yang sama (Cloudflare dan Supabase). Untuk salinan di luar akun, Super
  Admin tetap mengunduh cadangan secara berkala (ADR-018), kini juga berkas cadangan otomatis.
- Pesan konfirmasi hapus di Admin UPT kini berbunyi "tidak dapat Anda kembalikan sendiri", bukan "tidak dapat
  dikembalikan", karena Kanwil dapat mengembalikannya dari jejak atau cadangan.
- Uji: `lib/cadanganOtomatis.test.ts` dan `lib/r2Terhapus.test.ts`. Migrasi, trigger, dan seluruh SQL pemulihan juga
  diuji di Postgres sungguhan (PGlite), termasuk pemulihan ke tabel kosong.
