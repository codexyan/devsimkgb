-- Pindaian SK peninjauan masa kerja pada usulan UPT (ADR-045).
--
-- Sejak ADR-030 usulan UPT dapat menyebut SK PMK sebagai sebab berubahnya masa kerja golongan, tetapi
-- berkasnya tidak punya tempat: kolom berkas yang ada hanya surat usulan, SK KGB terakhir, SK kenaikan
-- pangkat, SK CPNS, dan SK pengangkatan PNS. Laporan PMK karena itu sampai ke Kanwil tanpa satu pun
-- dokumen pendukung, padahal masa kerja yang tertulis pada SK itulah yang dipakai menghitung ulang
-- jadwal KGB berikutnya.
--
--   path_sk_pmk  kunci objek R2 pindaian SK PMK; kosong pada usulan yang sebabnya bukan PMK.
alter table public.usulan_pegawai add column if not exists path_sk_pmk text;
