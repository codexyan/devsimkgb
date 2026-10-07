-- ADR-080: pilihan UPT "belum pernah KGB" (dasar SK CPNS) atau "sudah pernah KGB" (dasar SK KGB terakhir).
--
-- Dulu keadaan ini ditebak dari masa kerja golongan (lebih dari 0 berarti pernah KGB). Tebakan itu keliru untuk CPNS
-- II/c (tabel gaji II/c dimulai dari 3 tahun), CPNS yang masa kerja sebelumnya diperhitungkan, dan pegawai yang masa
-- kerjanya terpotong habis oleh penyesuaian ijazah. Kini pilihan UPT disimpan.
--
--   keadaan_kgb   "pernah" atau "belum"; kosong pada usulan lama dan unggahan daftar (sistem kembali menebak dari
--                 masa kerja golongan dan langkah awal tabel golongannya)
--
-- Aman dijalankan ulang. Sebelum migrasi ini dijalankan, simpanan berisi pilihan ini diulang tanpa kolom tersebut
-- (lib/acuanUsulanServer.ts), jadi tidak ada simpanan yang gagal.

alter table public.usulan_pegawai add column if not exists keadaan_kgb text;
