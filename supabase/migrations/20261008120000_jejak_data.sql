-- Jejak perubahan data (ADR-084).
--
-- Setiap baris yang diubah atau dihapus pada tabel data pokok disalin isi lamanya ke public.jejak_data oleh trigger
-- Postgres, dalam transaksi yang sama dengan perubahannya. Bila data hilang atau tertimpa keliru (misalnya usulan
-- yang dihapus UPT untuk diulang, atau persetujuan yang terputus di tengah), isi sebelumnya dapat dilihat dan
-- dikembalikan dengan docs/sql/pulihkan-jejak-data.sql. Cron cadangan membuang jejak yang lebih tua dari 90 hari.
--
-- Aman diputar ulang. Tabel yang belum ada dilewati. Untuk mematikan jejak pada satu tabel:
--   drop trigger jejak_data_ubah on public.<tabel>; drop trigger jejak_data_hapus on public.<tabel>;

create table if not exists public.jejak_data (
  id        bigint generated always as identity primary key,
  waktu     timestamptz not null default now(),
  tabel     text not null,
  aksi      text not null,
  id_baris  text,
  lama      jsonb not null
);

create index if not exists jejak_data_waktu_idx on public.jejak_data (waktu);
create index if not exists jejak_data_tabel_id_idx on public.jejak_data (tabel, id_baris);

-- RLS aktif tanpa policy, sama dengan tabel lain: hanya server (secret key) yang dapat membaca.
alter table public.jejak_data enable row level security;

-- id_baris dibaca lewat to_jsonb agar trigger tidak pernah gagal pada tabel tanpa kolom id: kegagalan trigger
-- membatalkan perubahan datanya sendiri.
create or replace function public.catat_jejak_data() returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.jejak_data (tabel, aksi, id_baris, lama)
  values (tg_table_name, case tg_op when 'DELETE' then 'hapus' else 'ubah' end, to_jsonb(old) ->> 'id', to_jsonb(old));
  return null;
end;
$$;

do $$
declare
  t text;
begin
  -- Data pokok: perubahan dan penghapusan dicatat.
  foreach t in array array[
    'pegawai', 'riwayat_kgb', 'surat_kgb', 'serah_terima', 'riwayat_pangkat', 'riwayat_pmk', 'riwayat_hukdis',
    'riwayat_mutasi', 'usulan_pegawai', 'laporan_mutasi', 'laporan_hukdis', 'review_sk_upt', 'penandatangan',
    'template_surat', 'konfigurasi_kanwil', 'hukdis_jenis', 'hukdis_konfigurasi', 'regulasi', 'rekon_bulanan'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists jejak_data_ubah on public.%I', t);
      execute format(
        'create trigger jejak_data_ubah after update on public.%I for each row '
        'when (old.* is distinct from new.*) execute function public.catat_jejak_data()', t);
      execute format('drop trigger if exists jejak_data_hapus on public.%I', t);
      execute format(
        'create trigger jejak_data_hapus after delete on public.%I for each row execute function public.catat_jejak_data()', t);
    end if;
  end loop;

  -- Akun pengguna dan log aktivitas: hanya penghapusan. Perubahan akun (sandi, login) tidak perlu dijejak.
  foreach t in array array['users', 'audit_log'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists jejak_data_hapus on public.%I', t);
      execute format(
        'create trigger jejak_data_hapus after delete on public.%I for each row execute function public.catat_jejak_data()', t);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
