-- Kode satker pemilik akun (lib/satker.ts), dipakai peran admin_upt yang hanya boleh melihat data
-- satkernya sendiri. Kosong untuk peran Kanwil (superAdminCore, sdm_kgb, sdm_hukdis, keuangan).
alter table public.users add column if not exists satker text;
