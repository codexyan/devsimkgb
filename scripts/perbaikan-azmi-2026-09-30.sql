-- Perbaikan data KGB NOOR AZMI SYAHBUDIN, S.H. (NIP 198803122007031001)
-- Disiapkan 30 September 2026. JALANKAN DI sim-kgb-core, SATU BLOK, SETELAH DIBACA.
--
-- Sebab: SK KGB WP.19-SA.04.04-172 (19 Januari 2026, TMT 1 Maret 2026) diarsipkan berulang kali dan
-- menyisakan empat baris riwayat KGB yang saling bertentangan, dua di antaranya arsip ganda atas SK yang
-- sama. Baris pegawainya pun tidak cocok dengan satu pun di antaranya.
--
-- Yang benar menurut SK, sudah diuji ke tabel PP 5/2024 milik aplikasi ini:
--     golongan          III/b
--     masa kerja gol.   14 tahun 0 bulan
--     gaji pokok baru   Rp3.607.500
--     TMT KGB           1 Maret 2026
--     KGB berikutnya    1 Maret 2028   (MKG 16 tahun -> Rp3.721.100)
--
-- Catatan atas "Gaji Pokok Lama Rp3.139.400" pada SK: angka itu berasal dari SK dasar tahun 2022 yang
-- terbit di bawah PP 15/2019, dan memang tidak ada di tabel PP 5/2024. Karena seluruh angka di SIM-KGB
-- memakai PP 5/2024, gaji pokok lama di sini diisi Rp3.390.500 — nilai PP 5/2024 untuk keadaan sebelum
-- KGB ini. Jangan menyalin Rp3.139.400 ke basis data.
--
-- Keterlambatan siklus sebelumnya tidak memakan masa kerja golongan: MKG 10 th 7 bl (1 Okt 2022) menjadi
-- 14 th 0 bl (1 Mar 2026) persis sebesar waktu berjalan, 3 th 5 bl. Jadi tidak ada SK susulan yang perlu
-- diterbitkan; yang tersisa hanya selisih bayar periode tertunggak, urusan keuangan di luar aplikasi.

begin;

-- ── 0. Pastikan yang dikerjakan memang pegawai ini ──────────────────────────────────────────────
-- Harus mengembalikan tepat satu baris. Bila tidak, hentikan (rollback).
select id, nama, nip, mkg_tahun, mkg_bulan, gaji_pokok,
       tmt_kgb_terakhir::date, tmt_kgb_berikutnya::date
from public.pegawai
where nip = '198803122007031001';

-- ── 1. Buang baris riwayat yang keliru ──────────────────────────────────────────────────────────
-- e1dcf459  status "ditolak", MKG 19 th, gaji turun ke 3.838.300  — percobaan 4 Agustus
-- 584537ff  arsip ganda atas SK yang sama, MKG 19 th               — percobaan 29 September
-- Baris turunannya dihapus lebih dulu agar tidak menggantung tanpa induk.
delete from public.serah_terima where kgb_id = 'e1dcf459-99c0-4f9e-9c8f-535ca93d915c';
delete from public.surat_kgb    where kgb_id = '584537ff-2c68-4734-b9ac-1d26c00c20f1';
delete from public.riwayat_kgb  where id in (
  'e1dcf459-99c0-4f9e-9c8f-535ca93d915c',
  '584537ff-2c68-4734-b9ac-1d26c00c20f1'
);

-- ── 2. Betulkan arsip yang dipertahankan ────────────────────────────────────────────────────────
-- 990d7b5e sudah memuat nomor dan tanggal SK yang benar beserta pindaiannya; yang keliru hanya TMT
-- (tanggal SK 19 Januari bocor ke kolom TMT) dan masa kerja golongannya.
update public.riwayat_kgb set
  tmt_kgb_baru    = date '2026-03-01',
  mkg_tahun_baru  = 14,
  mkg_bulan_baru  = 0,
  gaji_pokok_lama = 3390500,
  gaji_pokok_baru = 3607500,
  flag_rapelan    = false
where id = '990d7b5e-f5e0-4161-9c88-31381aa4d2e8';

-- ── 3. Jadwalkan siklus berikutnya pada baris penampung yang sudah ada ──────────────────────────
update public.riwayat_kgb set
  tmt_kgb_baru    = date '2028-03-01',
  mkg_tahun_baru  = 16,
  mkg_bulan_baru  = 0,
  gaji_pokok_lama = 3607500,
  gaji_pokok_baru = 3721100,
  flag_rapelan    = false
where id = 'f60fded7-0418-4179-9653-165ea5a7e8a2';

-- ── 4. Samakan baris pegawai dengan SK ──────────────────────────────────────────────────────────
update public.pegawai set
  mkg_tahun          = 14,
  mkg_bulan          = 0,
  gaji_pokok         = 3607500,
  tmt_kgb_terakhir   = date '2026-03-01',
  tmt_kgb_berikutnya = date '2028-03-01',
  nomor_sk_dasar     = 'WP.19-SA.04.04-172',
  tanggal_sk_dasar   = date '2026-01-19',
  penetap_sk_dasar   = 'Kepala Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan',
  updated_at         = now()
where nip = '198803122007031001';

-- ── 5. Catat perbaikannya beserta siklus yang tertunggak ────────────────────────────────────────
insert into public.audit_log (aksi, detail, target_nama, waktu)
values (
  'perbaikan_data_kgb',
  'Perbaikan manual riwayat KGB NOOR AZMI SYAHBUDIN, S.H. (198803122007031001): dua baris keliru dan satu '
  || 'arsip ganda atas SK WP.19-SA.04.04-172 dihapus, arsip yang tersisa disamakan dengan SK (TMT 1 Maret '
  || '2026, MKG 14 tahun 0 bulan, gaji pokok Rp3.607.500), dan KGB berikutnya dijadwalkan 1 Maret 2028. '
  || 'Siklus KGB sebelum Maret 2026 tertunggak beberapa tahun; masa kerja golongannya tidak berkurang '
  || 'karena dihitung dari waktu berjalan, sehingga tidak ada SK susulan. Selisih bayar periode tertunggak '
  || 'ditindaklanjuti keuangan di luar aplikasi.',
  'NOOR AZMI SYAHBUDIN, S.H.',
  now()
);

-- ── 6. Periksa hasilnya sebelum commit ──────────────────────────────────────────────────────────
-- Harapan: satu baris pegawai dengan MKG 14/0, gaji 3.607.500, TMT 2026-03-01, berikutnya 2028-03-01;
-- dan tepat dua baris riwayat — satu "selesai/arsip" 2026-03-01 dan satu "belum_diproses" 2028-03-01.
select 'pegawai' as bagian, mkg_tahun::text || ' th ' || mkg_bulan::text || ' bl' as mkg,
       gaji_pokok::text as gaji, tmt_kgb_terakhir::date::text as tmt_terakhir,
       tmt_kgb_berikutnya::date::text as tmt_berikutnya
from public.pegawai where nip = '198803122007031001'
union all
select 'riwayat ' || k.status || case when k.is_arsip then ' (arsip)' else '' end,
       k.mkg_tahun_baru::text || ' th ' || k.mkg_bulan_baru::text || ' bl',
       k.gaji_pokok_baru::text, k.tmt_kgb_baru::date::text, coalesce(k.nomor_sk, '-')
from public.riwayat_kgb k join public.pegawai p on p.id = k.pegawai_id
where p.nip = '198803122007031001' order by 1;

-- Bila hasilnya sesuai:   commit;
-- Bila ada yang meleset:  rollback;
commit;
