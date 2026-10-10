-- Batas kirim surat usulan UPT diatur di Pengaturan (ADR-094). Kosong berarti bawaan tanggal 20.
-- Keputusan 10 Oktober 2026: surat UPT sampai tanggal 20 dan input SIM-KGB sampai akhir bulan (31 = hari terakhir bulan).
-- Produksi memakai Cloudflare D1 sejak 8 Oktober 2026 (d1/migrations/0004_batas_kirim_surat.sql); migrasi ini menjaga
-- Supabase cadangan tetap sejalan bila suatu saat dipakai lagi.
alter table public.konfigurasi_kanwil add column if not exists batas_kirim_surat integer;

update public.konfigurasi_kanwil set batas_input_sdm = 31, batas_kirim_surat = 20;

notify pgrst, 'reload schema';
