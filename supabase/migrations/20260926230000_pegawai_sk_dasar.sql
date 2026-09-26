-- SK dasar KGB pertama pada data pegawai (ADR-010).
--
-- KGB pertama berdasar SK CPNS: nomor dan tanggalnya tercetak pada bagian "Atas dasar" SK KGB, dan
-- pejabatnya pada baris "Oleh". Sebelum ini SK CPNS hanya dapat diketik saat Input KGB atau dibawa usulan
-- UPT, sehingga pegawai yang dicatat Kanwil lewat Tambah Pegawai atau Impor tidak pernah membawanya.
-- Setelah ada KGB yang selesai di SIM-KGB, SK dasarnya adalah SK KGB itu, bukan kolom ini.
alter table public.pegawai add column if not exists nomor_sk_dasar text;
alter table public.pegawai add column if not exists tanggal_sk_dasar timestamptz;
alter table public.pegawai add column if not exists penetap_sk_dasar text;
