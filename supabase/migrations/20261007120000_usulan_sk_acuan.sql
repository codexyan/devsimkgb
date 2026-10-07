-- Golongan dan masa kerja golongan pada SK acuan di usulan UPT (ADR-078).
--
-- Usulan yang melaporkan SK kenaikan pangkat, penyesuaian ijazah, atau PMK sesudah SK KGB terakhir kini memuat dua
-- keadaan, sesuai urutan SK-nya: golongan dan masa kerja golongan pada SK KGB terakhir (atau SK CPNS), lalu golongan
-- dan masa kerja golongan yang tertulis pada SK yang dilaporkan. Yang kedua tetap di kolom golongan_ruang dan mkg_*;
-- yang pertama di kolom berikut. Sistem menghitung gaji pokok dan KGB berikutnya dari keadaan pertama, lalu mencocokkan
-- masa kerjanya dengan yang tertulis pada SK.
--
-- Usulan lama tidak mengisinya dan tetap dihitung seperti sebelumnya. Sebelum migrasi ini dijalankan, aplikasi
-- menyimpan usulan tanpa kolom ini, jadi tidak ada simpanan yang gagal.
--
--   golongan_acuan    golongan/ruang pada SK acuan
--   mkg_tahun_acuan   masa kerja golongan pada SK acuan, tahun
--   mkg_bulan_acuan   masa kerja golongan pada SK acuan, bulan
alter table public.usulan_pegawai add column if not exists golongan_acuan text;
alter table public.usulan_pegawai add column if not exists mkg_tahun_acuan integer;
alter table public.usulan_pegawai add column if not exists mkg_bulan_acuan integer;

notify pgrst, 'reload schema';
