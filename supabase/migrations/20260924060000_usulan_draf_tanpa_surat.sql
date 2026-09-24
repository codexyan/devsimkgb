-- Draf usulan belum punya surat.
--
-- Sejak UPT mendata dulu dan mengajukan kemudian (ADR-007), sebuah usulan lahir sebagai draf yang
-- nomor suratnya memang belum ada; nomor itu baru diisi sekali saat pengajuan, untuk beberapa pegawai
-- sekaligus. Kolomnya dibuat semula NOT NULL ketika usulan selalu menyertakan surat, sehingga setiap
-- penyimpanan draf ditolak basis data dengan galat 23502 dan terbaca pengguna sebagai "Data gagal
-- disimpan". Isian kosong disimpan sebagai NULL oleh lapisan data (lib/db/supabase/nilai.ts), jadi
-- yang perlu dilonggarkan adalah keharusannya, bukan cara menyimpannya.
alter table public.usulan_pegawai alter column nomor_surat drop not null;
