-- Riwayat peninjauan masa kerja (PMK) pegawai (ADR-021, lib/pmk.ts).
--
-- SK PMK menambah masa kerja golongan dan menetapkan gaji pokok baru, sehingga dapat menggeser jadwal KGB
-- berikutnya. Nilai sebelum dan sesudah disimpan agar perubahan pada data pegawai dapat ditelusuri.
create table public.riwayat_pmk (
  id                        text primary key default gen_random_uuid()::text,
  pegawai_id                text not null references public.pegawai (id) on delete cascade,
  nomor_sk                  text,
  tanggal_sk                timestamptz,
  tmt_pmk                   timestamptz,
  golongan_ruang            text,
  tambah_bulan              integer,
  mkg_tahun_sebelum         integer,
  mkg_bulan_sebelum         integer,
  mkg_tahun_sesudah         integer,
  mkg_bulan_sesudah         integer,
  mkg_tahun_dasar_lama      integer,
  mkg_bulan_dasar_lama      integer,
  mkg_tahun_dasar_baru      integer,
  mkg_bulan_dasar_baru      integer,
  gaji_pokok_lama           integer,
  gaji_pokok_baru           integer,
  tmt_kgb_berikutnya_lama   timestamptz,
  tmt_kgb_berikutnya_baru   timestamptz,
  penetap_sk                text,
  keterangan                text,
  created_at                timestamptz default now(),
  created_by                text,
  urutan_sisip              bigint generated always as identity
);
create index if not exists riwayat_pmk_pegawai_id_idx on public.riwayat_pmk (pegawai_id);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.riwayat_pmk enable row level security;
