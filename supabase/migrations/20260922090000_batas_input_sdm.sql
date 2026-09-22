-- Tanggal batas input Tim SDM pada bulan kedua sebelum TMT (lib/batasInputSdm.ts). Kosong berarti
-- bawaan (20). Batasnya sebelum akhir bulan agar SK sudah dikonfirmasi keuangan sebelum rekon gaji di
-- aplikasi Gaji Web, tanggal 1 sampai 15 bulan sebelum TMT.
alter table public.konfigurasi_kanwil add column if not exists batas_input_sdm integer
  check (batas_input_sdm between 1 and 31);
