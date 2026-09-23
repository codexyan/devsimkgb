-- Riwayat kenaikan pangkat pegawai. Dasar hukumnya PP 99/2000 jo. PP 12/2002; potongan masa kerja
-- golongan saat pindah jenjang (I/x → II/a dikurangi 6 tahun, II/x → III/a dikurangi 5 tahun) mengikuti
-- Buku Saku Kenaikan Pangkat 2026 dan dihitung di lib/kenaikanPangkat.ts. Nilai gaji dan MKG disalin saat
-- SK dicatat, sehingga perubahan tabel gaji berikutnya tidak mengubah riwayat.
create table public.riwayat_pangkat (
  id               text primary key default gen_random_uuid()::text,
  pegawai_id       text not null references public.pegawai (id) on delete cascade,
  jenis_kp         text,
  nomor_sk         text,
  tanggal_sk       timestamptz,
  tmt_pangkat      timestamptz,
  golongan_lama    text,
  golongan_baru    text,
  mkg_tahun_lama   integer,
  mkg_bulan_lama   integer,
  mkg_tahun_baru   integer,
  mkg_bulan_baru   integer,
  gaji_pokok_lama  integer,
  gaji_pokok_baru  integer,
  keterangan       text,
  created_at       timestamptz default now(),
  created_by       text,
  urutan_sisip     bigint generated always as identity
);
create index if not exists riwayat_pangkat_pegawai_id_idx on public.riwayat_pangkat (pegawai_id);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.riwayat_pangkat enable row level security;
