-- Pejabat penetap SK kenaikan pangkat (ADR-020).
--
-- SK KGB berikutnya kini berdasar SK terbaru yang menetapkan gaji pokok. Bila SK kenaikan pangkat, termasuk
-- penyesuaian ijazah, ber-TMT sesudah KGB terakhir, SK itulah yang tercetak pada bagian "Atas dasar", dan
-- pejabatnya pada baris "Oleh". Riwayat kenaikan pangkat yang sudah ada dibiarkan kosong; Tim SDM mengisinya
-- saat Input KGB.
alter table public.riwayat_pangkat add column if not exists penetap_sk text;
