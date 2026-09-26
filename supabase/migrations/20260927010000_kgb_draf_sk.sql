-- Draf nomor dan tanggal SK KGB baru yang belum dibuat (ADR-011).
--
-- Catatan surat (surat_kgb) adalah penanda "SK sudah dibuat", jadi nomor dari arsiparis yang belum ingin
-- dipakai membuat SK disimpan di sini. Kolom ini juga menampung nomor SK yang sudah dibuat ketika hitungan
-- KGB-nya berubah karena usulan UPT disetujui, agar SK dibuat ulang tanpa mengetik nomornya lagi.
alter table public.riwayat_kgb add column if not exists draf_nomor_surat text;
alter table public.riwayat_kgb add column if not exists draf_tanggal_surat timestamptz;
