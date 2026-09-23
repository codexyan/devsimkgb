-- Konfirmasi data pegawai oleh admin UPT sebelum KGB diproses Kanwil.
-- Masukan tim keuangan: MKG dan status hukuman disiplin harus dipastikan UPT sebelum SK terbit, karena
-- salah data berujung kekurangan gaji atau, yang lebih berat, kelebihan gaji yang harus dikembalikan.
-- Konfirmasi berlaku per siklus: kolom tmt menyimpan TMT KGB yang dikonfirmasi, bukan sekadar penanda.

alter table public.pegawai add column if not exists konfirmasi_upt_tmt timestamptz;
alter table public.pegawai add column if not exists konfirmasi_upt_at timestamptz;
alter table public.pegawai add column if not exists konfirmasi_upt_oleh text;
