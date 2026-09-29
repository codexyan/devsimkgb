-- Laporan hukuman disiplin dari UPT (lib/laporanHukdis.ts, ADR-016).
--
-- UPT memegang SK hukuman disiplin pegawainya, tetapi yang mencatat ke riwayat_hukdis dan menggeser
-- jadwal KGB tetap SDM Hukdis Kanwil. Dulu laporannya menumpang pada usulan data (kolom hukdis_* di
-- usulan_pegawai) dan sampai di meja Tim SDM KGB, bukan SDM Hukdis. Tabel ini memberinya jalur sendiri.
--
-- Bentuknya meniru laporan_mutasi: menunggu, lalu diterima atau dikembalikan dengan catatan. Yang
-- diterima menerbitkan barisnya sendiri di riwayat_hukdis, dan riwayat_id di sini menunjuk ke baris itu.
create table if not exists public.laporan_hukdis (
  id              text primary key default gen_random_uuid()::text,
  pegawai_id      text not null references public.pegawai (id) on delete cascade,
  -- Satker pelapor; dipakai membatasi apa yang terlihat akun UPT.
  satker          text not null,
  -- Kode jenis dari hukdis_jenis; peninjau boleh menggantinya saat mencatat.
  jenis_hukdis    text not null,
  nomor_sk        text,
  tanggal_sk      timestamptz,
  tmt_mulai       timestamptz,
  tmt_berakhir    timestamptz,
  keterangan      text,
  -- Pindaian SK hukuman disiplin di R2.
  path_berkas     text,
  -- menunggu, diterima, atau dikembalikan
  status          text not null,
  -- Catatan peninjau pada laporan yang dikembalikan; dibaca UPT di modul Hukuman Disiplin-nya.
  catatan_kanwil  text,
  dilaporkan_oleh text,
  dilaporkan_at   timestamptz default now(),
  ditinjau_oleh   text,
  ditinjau_at     timestamptz,
  -- Baris riwayat_hukdis yang terbit dari laporan ini; null selama belum dicatat.
  riwayat_id      text,
  urutan_sisip    bigint generated always as identity
);
create index if not exists laporan_hukdis_satker_status_idx on public.laporan_hukdis (satker, status);
create index if not exists laporan_hukdis_pegawai_id_idx on public.laporan_hukdis (pegawai_id);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.laporan_hukdis enable row level security;

notify pgrst, 'reload schema';
