-- Penelusuran usulan yang terputus di tengah pemrosesan (7 Oktober 2026).
-- BACA SAJA: tidak mengubah data apa pun. Jalankan di Supabase SQL Editor, lalu kirim hasilnya (tangkapan layar atau CSV).
--
-- Ganti pola nama satker dan kodenya pada baris "unit" bila menelusuri UPT lain.

with unit as (
  select '%perempuan%martapura%'::text as pola,
         'lapas-perempuan-martapura'::text as kode
),
peg as (
  select p.* from public.pegawai p join unit on p.unit_kerja ilike unit.pola
),
kp_terakhir as (
  select distinct on (r.pegawai_id) r.*
  from public.riwayat_pangkat r join peg p on p.id = r.pegawai_id
  order by r.pegawai_id, r.tmt_pangkat desc nulls last, r.created_at desc
)
select * from (
  -- 1. SK kenaikan pangkat sudah tercatat, tetapi golongan pegawainya belum ikut berubah (pencatatan terputus).
  select '1 SK KP tercatat, data pegawai belum ikut' as temuan, p.nama, p.nip,
         concat('SK ', k.nomor_sk, ': ', k.golongan_lama, ' ke ', k.golongan_baru,
                ' | tercatat sekarang ', p.golongan_ruang, ' ', p.mkg_tahun, ' thn ', p.mkg_bulan, ' bln') as rincian,
         k.created_at as waktu
  from kp_terakhir k join peg p on p.id = k.pegawai_id
  where k.golongan_baru is distinct from p.golongan_ruang

  union all
  -- 2. Pegawai baru sudah masuk data induk, tetapi usulannya masih draf/menunggu/dikembalikan.
  select '2 Pegawai baru terbentuk, usulan belum selesai', p.nama, p.nip,
         concat('usulan ', u.status, ', diajukan ', to_char(u.diajukan_at at time zone 'Asia/Makassar', 'DD Mon HH24:MI')),
         p.created_at
  from public.usulan_pegawai u join peg p on p.nip = u.nip
  where u.jenis = 'baru' and u.status in ('draf', 'menunggu', 'revisi')

  union all
  -- 3. Pegawai yang dibuat sejak 6 Oktober tanpa satu pun usulan disetujui yang menunjuknya.
  select '3 Pegawai dibuat sejak 6 Okt tanpa usulan disetujui', p.nama, p.nip,
         concat('golongan ', p.golongan_ruang, ', MKG ', p.mkg_tahun, ' thn ', p.mkg_bulan, ' bln, KGB berikutnya ',
                to_char(p.tmt_kgb_berikutnya at time zone 'Asia/Makassar', 'DD Mon YYYY')),
         p.created_at
  from peg p
  where p.created_at >= '2026-10-06 00:00+08'
    and not exists (select 1 from public.usulan_pegawai u where u.pegawai_id = p.id and u.status = 'disetujui')

  union all
  -- 4. Usulan yang dihapus atau dibatalkan UPT hari ini (isi usulannya ikut terhapus).
  select '4 Usulan dihapus/dibatalkan hari ini', a.target_nama, null, a.detail, a.waktu
  from public.audit_log a
  where a.waktu >= '2026-10-07 00:00+08'
    and a.aksi in ('hapus_draf_pegawai', 'batal_usulan', 'hapus_usulan_dikembalikan')

  union all
  -- 5. Usulan satker ini yang belum selesai, beserta SK yang dilaporkannya.
  select '5 Usulan belum selesai', coalesce(p.nama, u.nama), coalesce(p.nip, u.nip),
         concat(u.jenis, ' / ', u.status, coalesce(' / SK ' || u.dasar_baru_nomor_sk, ''),
                coalesce(' / surat ' || u.nomor_surat, '')),
         u.diajukan_at
  from public.usulan_pegawai u
  join unit on u.satker = unit.kode
  left join public.pegawai p on p.id = u.pegawai_id
  where u.status in ('draf', 'menunggu', 'revisi')
) t
order by temuan, waktu;
