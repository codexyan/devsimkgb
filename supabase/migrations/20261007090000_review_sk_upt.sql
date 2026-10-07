-- Review tampilan SK KGB pegawai UPT oleh Admin UPT (lib/reviewSkUpt.ts, ADR-077).
--
-- Sesudah Kanwil membuat SK untuk pegawai UPT, Admin UPT satker itu memeriksa tampilannya lebih dulu. SK baru dicetak
-- tanpa tanda air DRAF, ditandatangani basah, dikirim lewat Srikandi, dan diunggah TTE-nya setelah UPT menyetujui;
-- Super Admin dapat melewati review dengan alasan untuk keadaan mendesak.
-- Aplikasi tetap berjalan sebelum tabel ini dibuat: review belum aktif dan alur lama berlaku seperti sebelumnya.
create table if not exists public.review_sk_upt (
  -- Satu review per KGB: id sama dengan id KGB-nya, dan ikut terhapus bila KGB-nya dihapus.
  id               text primary key references public.riwayat_kgb (id) on delete cascade,
  pegawai_id       text not null,
  -- Kode satker pegawai saat review diminta; dasar penyaringan per Admin UPT.
  satker           text not null,
  -- menunggu, disetujui, perbaikan, atau dilewati.
  status           text not null,
  -- Naik setiap kali SK dibuat ulang dan review diminta lagi.
  versi            integer not null default 1,
  nomor_surat      text,
  tanggal_surat    timestamptz,
  diminta_at       timestamptz,
  diminta_oleh     text,
  ditanggapi_at    timestamptz,
  ditanggapi_oleh  text,
  -- Catatan perbaikan dari UPT.
  catatan          text,
  -- Alasan Super Admin melewati review.
  alasan_lewati    text,
  urutan_sisip     bigint generated always as identity
);
create index if not exists review_sk_upt_satker_idx on public.review_sk_upt (satker);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.review_sk_upt enable row level security;

notify pgrst, 'reload schema';
