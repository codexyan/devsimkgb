-- Template surat KGB berversi (lib/templateSurat.ts, ADR-019).
--
-- Kop, ukuran kertas, margin, kalimat, dan tembusan surat KGB diatur Super Admin di Pengaturan, bukan lagi
-- tertulis di kode. Setiap perubahan disimpan sebagai versi baru dengan tanggal mulai berlaku; SK memakai
-- versi yang berlaku pada tanggal suratnya, sehingga SK lama tetap tercetak persis seperti ketika terbit.
-- Versi yang sudah mulai berlaku tidak diubah atau dihapus; hanya versi terjadwal yang boleh dihapus.
create table public.template_surat (
  id             text primary key default gen_random_uuid()::text,
  -- Nomor urut versi, 1, 2, 3, …
  versi          integer not null,
  -- Tanggal mulai berlaku (tengah malam WITA).
  berlaku_mulai  timestamptz not null,
  -- Isi template sebagai JSON (IsiTemplateSurat).
  isi            text not null,
  catatan        text,
  dibuat_oleh    text,
  dibuat_at      timestamptz default now(),
  urutan_sisip   bigint generated always as identity
);
create index if not exists template_surat_berlaku_idx on public.template_surat (berlaku_mulai);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.template_surat enable row level security;

notify pgrst, 'reload schema';
