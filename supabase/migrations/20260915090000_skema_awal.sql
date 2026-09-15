-- Skema awal SIM-KGB di Supabase (Postgres), padanan tab Google Sheets di lib/sheets/tables.ts
-- setelah Tahap 1 (kolom penetapSkDasar, salinan penandatangan, tab Penandatangan).
--
-- Konvensi:
--   • Nama tabel dan kolom snake_case; lapisan data (lib/db/supabase) memetakan dari camelCase
--     di kode (mis. tmtKgbBerikutnya → tmt_kgb_berikutnya). Tab "User" menjadi tabel users.
--   • id bertipe text karena data lama memakai UUID string dan id tetap seperti "default".
--   • Kolom waktu bertipe timestamptz, sama dengan nilai Date di aplikasi.
--   • urutan_sisip mencatat urutan baris dimasukkan. Lapisan data memakainya sebagai urutan
--     bawaan, sama seperti urutan baris di spreadsheet.
--   • NOT NULL hanya pada kunci dan isian yang selalu diisi aplikasi, supaya data dari
--     spreadsheet bisa dipindahkan apa adanya. Batasan bisa diperketat setelah data diperiksa.
--   • Kolom "...By" (createdBy, updatedBy, dst.) sengaja tanpa foreign key: isinya bisa
--     id pengguna, NIP, atau nama skrip.
--   • RLS aktif tanpa policy: anon dan authenticated tidak bisa membaca atau menulis.
--     Hanya server yang memakai secret key (melewati RLS) yang mengakses data.

-- ============================ Pengguna ============================

create table public.users (
  id            text primary key default gen_random_uuid()::text,
  nip           text not null unique,
  password      text not null,
  nama          text,
  jabatan       text,
  email         text,
  role          text not null,
  created_at    timestamptz default now(),
  urutan_sisip  bigint generated always as identity
);

create table public.profile_change_request (
  id            text primary key default gen_random_uuid()::text,
  user_id       text not null references public.users (id) on delete cascade,
  nama          text,
  jabatan       text,
  email         text,
  status        text not null default 'pending',
  alasan_tolak  text,
  created_at    timestamptz default now(),
  reviewed_at   timestamptz,
  reviewed_by   text,
  urutan_sisip  bigint generated always as identity
);
create index on public.profile_change_request (user_id, status);
create index on public.profile_change_request (status);

-- ============================ Pegawai dan KGB ============================

create table public.pegawai (
  id                       text primary key default gen_random_uuid()::text,
  nip                      text not null unique,
  nama                     text not null,
  tempat_lahir             text,
  tanggal_lahir            timestamptz,
  jenis_kelamin            text,
  pendidikan_terakhir      text,
  jabatan                  text,
  pangkat                  text,
  golongan_ruang           text,
  unit_kerja               text,
  eselon                   text,
  jenis_jabatan            text,
  tmt_golongan             timestamptz,
  mkg_tahun                integer default 0,
  mkg_bulan                integer default 0,
  gaji_pokok               integer default 0,
  tmt_kgb_terakhir         timestamptz,
  tmt_kgb_berikutnya       timestamptz,
  status_hukdis            boolean default false,
  tanggal_hukdis_berakhir  timestamptz,
  jenis_hukdis             text,
  keterangan_hukdis        text,
  aktif                    boolean default true,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  urutan_sisip             bigint generated always as identity
);
create index on public.pegawai (aktif, tmt_kgb_berikutnya);
create index on public.pegawai (status_hukdis);

create table public.riwayat_kgb (
  id                      text primary key default gen_random_uuid()::text,
  pegawai_id              text not null references public.pegawai (id) on delete cascade,
  nomor_sk                text,
  tanggal_sk              timestamptz,
  tmt_sk                  timestamptz,
  golongan_lama           text,
  gaji_pokok_lama         integer default 0,
  mkg_tahun_lama          integer default 0,
  mkg_bulan_lama          integer default 0,
  golongan_baru           text,
  gaji_pokok_baru         integer default 0,
  mkg_tahun_baru          integer default 0,
  mkg_bulan_baru          integer default 0,
  tmt_kgb_baru            timestamptz,
  tmt_kgb_berikutnya      timestamptz,
  status                  text not null default 'belum_diproses',
  flag_rapelan            boolean default false,
  is_arsip                boolean default false,
  konfirmasi_keuangan_at  timestamptz,
  konfirmasi_keuangan_by  text,
  rapelan_ditetapkan      boolean,
  input_gaji_web_at       timestamptz,
  input_gaji_web_by       text,
  created_by              text,
  created_at              timestamptz default now(),
  -- Pejabat yang menetapkan SK dasar; dicetak pada baris "Oleh" di surat KGB.
  penetap_sk_dasar        text,
  urutan_sisip            bigint generated always as identity
);
create index on public.riwayat_kgb (status);
create index on public.riwayat_kgb (pegawai_id, status);
create index on public.riwayat_kgb (tmt_kgb_baru);

-- ============================ Penandatangan dan surat ============================

create table public.penandatangan (
  id                text primary key default gen_random_uuid()::text,
  jenis             text not null check (jenis in ('definitif', 'plh', 'plt', 'dirjen')),
  nama              text not null,
  nip               text not null,
  -- Tanpa awalan Plh./Plt.; awalan ditambahkan saat dicetak.
  jabatan           text not null,
  dasar_penunjukan  text,
  berlaku_mulai     timestamptz not null,
  berlaku_sampai    timestamptz,
  updated_at        timestamptz default now(),
  updated_by        text,
  urutan_sisip      bigint generated always as identity,
  check (berlaku_sampai is null or berlaku_sampai >= berlaku_mulai)
);
create index on public.penandatangan (jenis, berlaku_mulai);

create table public.surat_kgb (
  id                     text primary key default gen_random_uuid()::text,
  -- Satu surat per KGB; juga mencegah catatan ganda saat dua permintaan tiba bersamaan.
  kgb_id                 text not null unique references public.riwayat_kgb (id) on delete cascade,
  nomor_surat            text,
  tanggal_surat          timestamptz,
  -- Salinan nama dan NIP penandatangan, apa pun jenisnya.
  nama_kepala_kanwil     text,
  nip_kepala_kanwil      text,
  path_file              text,
  generated_at           timestamptz default now(),
  generated_by           text,
  -- Penandatangan yang dipakai surat tidak boleh dihapus.
  penandatangan_id       text references public.penandatangan (id) on delete restrict,
  jenis_penandatangan    text,
  jabatan_penandatangan  text,
  urutan_sisip           bigint generated always as identity
);

create table public.serah_terima (
  id                    text primary key default gen_random_uuid()::text,
  kgb_id                text not null references public.riwayat_kgb (id) on delete cascade,
  nama_admin            text,
  keterangan            text,
  tanggal_serah_terima  timestamptz default now(),
  created_by            text,
  urutan_sisip          bigint generated always as identity
);
create index on public.serah_terima (kgb_id);

create table public.konfigurasi_kanwil (
  id                  text primary key default gen_random_uuid()::text,
  -- nama_kepala dan nip_kepala tidak dipakai lagi sejak tabel penandatangan ada.
  nama_kepala         text,
  nip_kepala          text,
  nomor_pp            text,
  tahun_pp            text,
  wa_admin            text,
  notif_kgb_h1        integer default 14,
  notif_kgb_h2        integer default 7,
  sesi_timeout_menit  integer default 60,
  updated_at          timestamptz default now(),
  updated_by          text,
  urutan_sisip        bigint generated always as identity
);

create table public.rekon_bulanan (
  id             text primary key default gen_random_uuid()::text,
  -- Format "YYYY-MM".
  bulan_tmt      text not null unique,
  tanggal_input  timestamptz,
  input_by       text,
  jumlah_data    integer default 0,
  catatan        text,
  created_at     timestamptz default now(),
  urutan_sisip   bigint generated always as identity
);

-- ============================ Hukuman disiplin ============================

create table public.regulasi (
  id                  text primary key default gen_random_uuid()::text,
  nomor               text,
  tahun               text,
  tentang             text,
  status              text default 'berlaku',
  pasal_berlaku       text,
  digantikan_oleh_id  text references public.regulasi (id) on delete set null,
  catatan             text,
  urutan              integer default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  updated_by          text,
  urutan_sisip        bigint generated always as identity
);
create index on public.regulasi (status);

create table public.hukdis_jenis (
  id             text primary key default gen_random_uuid()::text,
  kode           text not null unique,
  label          text,
  kategori       text,
  dasar_hukum    text,
  regulasi_id    text references public.regulasi (id) on delete set null,
  durasi_hukdis  integer default 0,
  berdampak_kgb  boolean default false,
  durasi_tunda   integer,
  aktif          boolean default true,
  urutan         integer default 0,
  updated_at     timestamptz default now(),
  updated_by     text,
  urutan_sisip   bigint generated always as identity
);
create index on public.hukdis_jenis (regulasi_id);

create table public.hukdis_konfigurasi (
  id             text primary key default gen_random_uuid()::text,
  notif_hari_h1  integer default 30,
  notif_hari_h2  integer default 14,
  updated_at     timestamptz default now(),
  updated_by     text,
  urutan_sisip   bigint generated always as identity
);

create table public.riwayat_hukdis (
  id             text primary key default gen_random_uuid()::text,
  pegawai_id     text not null references public.pegawai (id) on delete cascade,
  jenis_hukdis   text,
  nomor_sk       text,
  tanggal_sk     timestamptz,
  tmt_mulai      timestamptz,
  tmt_berakhir   timestamptz,
  berdampak_kgb  boolean default false,
  durasi_tunda   integer,
  -- Salinan dasar hukum saat SK terbit; peraturan baru tidak mengubahnya.
  dasar_hukum    text,
  keterangan     text,
  created_at     timestamptz default now(),
  created_by     text,
  urutan_sisip   bigint generated always as identity
);
create index on public.riwayat_hukdis (pegawai_id);

-- ============================ Notifikasi dan log ============================

create table public.notifikasi (
  id            text primary key default gen_random_uuid()::text,
  judul         text,
  pesan         text,
  tipe          text,
  reference_id  text,
  dibaca        boolean default false,
  created_at    timestamptz default now(),
  prioritas     text default 'normal',
  link_href     text,
  kategori      text,
  urutan_sisip  bigint generated always as identity
);
create index on public.notifikasi (dibaca, created_at desc);

create table public.audit_log (
  id            text primary key default gen_random_uuid()::text,
  waktu         timestamptz default now(),
  aksi          text,
  detail        text,
  target_nama   text,
  ip_address    text,
  -- Tanpa foreign key: log tetap utuh walau pengguna dihapus.
  user_id       text,
  urutan_sisip  bigint generated always as identity
);
create index on public.audit_log (waktu desc);
create index on public.audit_log (aksi);
create index on public.audit_log (user_id);

-- ============================ Keamanan ============================

alter table public.users                  enable row level security;
alter table public.profile_change_request enable row level security;
alter table public.pegawai                enable row level security;
alter table public.riwayat_kgb            enable row level security;
alter table public.penandatangan          enable row level security;
alter table public.surat_kgb              enable row level security;
alter table public.serah_terima           enable row level security;
alter table public.konfigurasi_kanwil     enable row level security;
alter table public.rekon_bulanan          enable row level security;
alter table public.regulasi               enable row level security;
alter table public.hukdis_jenis           enable row level security;
alter table public.hukdis_konfigurasi     enable row level security;
alter table public.riwayat_hukdis         enable row level security;
alter table public.notifikasi             enable row level security;
alter table public.audit_log              enable row level security;
