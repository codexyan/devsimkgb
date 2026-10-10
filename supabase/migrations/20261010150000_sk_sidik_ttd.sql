-- Sidik, ukuran, dan status tanda tangan berkas SK bertanda tangan (ADR-096). Produksi memakai Cloudflare D1
-- (d1/migrations/0005_sk_sidik_ttd.sql); migrasi ini menjaga Supabase cadangan tetap sejalan.
alter table public.surat_kgb add column if not exists sha256_berkas text;
alter table public.surat_kgb add column if not exists ukuran_berkas integer;
alter table public.surat_kgb add column if not exists status_ttd text;

notify pgrst, 'reload schema';
