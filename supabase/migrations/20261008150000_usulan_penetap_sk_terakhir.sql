-- Pejabat penetap SK KGB terakhir atau SK CPNS pada usulan UPT (ADR-086): baris "Oleh" SK KGB berikutnya.
-- Sebelum migrasi ini dijalankan, usulan tetap tersimpan tanpa isian itu (lib/acuanUsulanServer.ts), dan saat
-- disetujui penetapnya disarankan dari awalan nomor SK.
alter table public.usulan_pegawai add column if not exists penetap_sk_terakhir text;

notify pgrst, 'reload schema';
