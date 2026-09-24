-- Laporan mutasi dan pemberhentian dari UPT (lib/laporanMutasi.ts).
--
-- Pencatatan mutasi selama ini hanya milik Kanwil, padahal satker yang paling dulu tahu pegawainya
-- pindah, pensiun, atau meninggal. Selama belum tercatat, pegawai itu tetap muncul di antrian KGB dan
-- tetap dihitung jatuh tempo. Lewat tabel ini UPT melaporkan, Kanwil tetap yang menetapkan.
--
-- Bentuknya sengaja meniru usulan data: laporan berstatus menunggu, lalu diterima atau dikembalikan
-- dengan catatan. Yang diterima menerbitkan barisnya sendiri di riwayat_mutasi, dan riwayat_id di sini
-- menunjuk ke baris itu, sehingga penetapannya tetap satu pintu dan laporannya tetap terbaca sebagai
-- asal usulnya.
create table public.laporan_mutasi (
  id              text primary key default gen_random_uuid()::text,
  pegawai_id      text not null references public.pegawai (id) on delete cascade,
  -- Satker pelapor, bukan satker tujuan; dipakai membatasi apa yang terlihat akun UPT.
  satker          text not null,
  -- definitif, bko, selesai_bko, atau pemberhentian; kosakatanya sama dengan riwayat_mutasi
  jenis           text not null,
  satker_tujuan   text,
  tmt             timestamptz,
  nomor_sk        text,
  tanggal_sk      timestamptz,
  alasan          text,
  keterangan      text,
  -- menunggu, diterima, atau dikembalikan
  status          text not null,
  -- Catatan peninjau pada laporan yang dikembalikan; dibaca UPT di dasbornya.
  catatan_kanwil  text,
  dilaporkan_oleh text,
  dilaporkan_at   timestamptz default now(),
  ditinjau_oleh   text,
  ditinjau_at     timestamptz,
  -- Baris riwayat_mutasi yang terbit dari laporan ini; null selama belum diterima.
  riwayat_id      text,
  urutan_sisip    bigint generated always as identity
);
create index if not exists laporan_mutasi_satker_status_idx on public.laporan_mutasi (satker, status);
create index if not exists laporan_mutasi_pegawai_id_idx on public.laporan_mutasi (pegawai_id);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.laporan_mutasi enable row level security;
