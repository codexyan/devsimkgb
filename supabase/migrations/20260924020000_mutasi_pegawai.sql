-- Mutasi dan pemberhentian pegawai (lib/mutasiPegawai.ts).
--
-- Sebelum ini perpindahan dicatat dengan mengubah unit kerja begitu saja, tanpa tanggal berlaku dan
-- tanpa SK, sedangkan pegawai yang berhenti hanya dapat dihapus beserta riwayat KGB-nya. Tabel ini
-- menyimpan riwayatnya, dan tiga kolom pada pegawai menyimpan keadaan yang berlaku sekarang.
--
-- BKO tidak mengubah unit kerja: gaji pegawai BKO tetap dibayar satker asal, sehingga KGB, SK, dan
-- KPPN tujuannya juga tetap di sana. Yang dicatat hanya satker tempat bertugas, sebagai keterangan.
create table public.riwayat_mutasi (
  id             text primary key default gen_random_uuid()::text,
  pegawai_id     text not null references public.pegawai (id) on delete cascade,
  -- definitif, bko, selesai_bko, atau pemberhentian
  jenis          text not null,
  satker_asal    text,
  satker_tujuan  text,
  tmt            timestamptz,
  nomor_sk       text,
  tanggal_sk     timestamptz,
  alasan         text,
  keterangan     text,
  created_at     timestamptz default now(),
  created_by     text,
  urutan_sisip   bigint generated always as identity
);
create index if not exists riwayat_mutasi_pegawai_id_idx on public.riwayat_mutasi (pegawai_id);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.riwayat_mutasi enable row level security;

-- Keadaan yang berlaku sekarang, supaya daftar dan rekap tidak perlu menelusuri riwayat tiap kali.
-- berhenti_tmt menentukan hak KGB: KGB yang TMT-nya sebelum tanggal ini tetap sah diproses.
alter table public.pegawai add column if not exists satker_tugas text;
alter table public.pegawai add column if not exists berhenti_tmt timestamptz;
alter table public.pegawai add column if not exists berhenti_alasan text;
