-- Usulan data pegawai dari UPT, ditinjau Kanwil sebelum diterapkan ke data induk.
-- UPT memegang dokumen aslinya (SK KGB terakhir, SK hukuman disiplin), sehingga UPT yang
-- menginventarisir datanya; Kanwil tetap memegang keputusan menerapkannya.

create table public.usulan_pegawai (
  id text primary key,
  pegawai_id text not null,
  satker text not null,
  status text not null,
  nomor_surat text not null,
  tanggal_surat timestamptz,
  path_berkas text,
  nama text,
  tempat_lahir text,
  tanggal_lahir timestamptz,
  jenis_kelamin text,
  pendidikan_terakhir text,
  jabatan text,
  pangkat text,
  golongan_ruang text,
  eselon text,
  jenis_jabatan text,
  tmt_golongan timestamptz,
  mkg_tahun integer,
  mkg_bulan integer,
  gaji_pokok integer,
  tmt_kgb_terakhir timestamptz,
  tmt_kgb_berikutnya timestamptz,
  nomor_sk_terakhir text,
  tanggal_sk_terakhir timestamptz,
  hukdis_ada boolean default false,
  hukdis_jenis text,
  hukdis_nomor_sk text,
  hukdis_tmt_mulai timestamptz,
  hukdis_tmt_berakhir timestamptz,
  hukdis_keterangan text,
  catatan_upt text,
  diajukan_oleh text not null,
  diajukan_at timestamptz,
  ditinjau_oleh text,
  ditinjau_at timestamptz,
  alasan_tolak text,
  urutan_sisip bigint generated always as identity
);

alter table public.usulan_pegawai enable row level security;

create index usulan_pegawai_satker_status_idx on public.usulan_pegawai (satker, status);
create index usulan_pegawai_pegawai_idx on public.usulan_pegawai (pegawai_id);
