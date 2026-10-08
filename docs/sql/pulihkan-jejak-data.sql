-- Melihat dan mengembalikan data yang dihapus atau tertimpa, dari jejak perubahan (ADR-084).
--
-- Jejak hanya ada sesudah migrasi 20261008120000_jejak_data.sql dijalankan, dan disimpan 90 hari.
-- Jalankan bagian 1 lebih dulu (hanya membaca). Bagian 2 dan 3 mengubah data: sesuaikan tabel dan rentang waktunya,
-- lalu jalankan satu per satu.

-- 1. Apa saja yang berubah atau terhapus 7 hari terakhir (waktu WITA). Saring dengan tabel, aksi, atau nama.
select
  j.waktu at time zone 'Asia/Makassar' as waktu_wita,
  j.tabel,
  j.aksi,
  j.id_baris,
  coalesce(j.lama ->> 'nama', j.lama ->> 'nama_pegawai', j.lama ->> 'nip', '') as nama_atau_nip,
  j.lama ->> 'unit_kerja' as unit_kerja,
  j.lama ->> 'status' as status_lama
from public.jejak_data j
where j.waktu >= now() - interval '7 days'
  -- and j.tabel = 'usulan_pegawai'
  -- and j.aksi = 'hapus'
  -- and j.lama::text ilike '%martapura%'
order by j.waktu desc
limit 500;

-- 2. Kembalikan baris usulan_pegawai yang TERHAPUS dalam rentang waktu tertentu. Baris yang id-nya masih ada
--    dilewati. Ganti nama tabel (dua tempat) dan rentang waktunya bila perlu.
-- begin;
-- insert into public.usulan_pegawai overriding system value
-- select (jsonb_populate_record(null::public.usulan_pegawai, j.lama)).*
-- from public.jejak_data j
-- where j.tabel = 'usulan_pegawai'
--   and j.aksi = 'hapus'
--   and j.waktu between '2026-10-08 05:00+08' and '2026-10-08 06:00+08'
-- on conflict (id) do nothing;
-- commit;

-- 3. Kembalikan isi SATU baris ke keadaan sebelum perubahan tertentu (misalnya data pegawai yang tertimpa keliru).
--    Lihat dulu jejaknya di bagian 1, salin id jejak (kolom id di jejak_data), lalu ganti 0 di bawah.
--    Perubahan yang terjadi sesudah jejak itu ikut terganti.
-- begin;
-- update public.pegawai p
-- set (nama, golongan_ruang, mkg_tahun, mkg_bulan, tmt_kgb_terakhir, tmt_kgb_berikutnya, gaji_pokok)
--   = (r.nama, r.golongan_ruang, r.mkg_tahun, r.mkg_bulan, r.tmt_kgb_terakhir, r.tmt_kgb_berikutnya, r.gaji_pokok)
-- from public.jejak_data j, jsonb_populate_record(null::public.pegawai, j.lama) r
-- where j.id = 0 and j.tabel = 'pegawai' and p.id = r.id;
-- commit;
