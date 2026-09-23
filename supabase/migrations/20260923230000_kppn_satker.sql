-- KPPN mitra satker yang disesuaikan lewat Pengaturan (lib/kppnSatker.ts), disimpan sebagai JSON
-- berisi hanya satker yang berbeda dari bawaannya, misalnya {"rutan-rantau":"Banjarmasin"}. Kosong
-- berarti seluruh satker memakai KPPN bawaan di lib/satker.ts. SK kenaikan gaji berkala ditujukan ke
-- KPPN ini, sehingga nilainya menentukan ke kantor bayar mana SK dikirim.
alter table public.konfigurasi_kanwil add column if not exists kppn_satker text;
