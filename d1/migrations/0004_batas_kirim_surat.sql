-- Batas kirim surat usulan UPT diatur di Pengaturan (ADR-094), sama dengan migrasi Supabase
-- 20261010090000_batas_kirim_surat.sql. Kosong berarti bawaan tanggal 20. Trigger jejak konfigurasi_kanwil dibuat ulang
-- supaya kolom baru ikut tercatat.
--
-- Keputusan 10 Oktober 2026: surat UPT sampai tanggal 20 dan input SIM-KGB sampai akhir bulan (31 = hari terakhir bulan),
-- karena di UPT orang yang sama membuat surat usulan dan mengerjakan rekon gaji.

ALTER TABLE konfigurasi_kanwil ADD COLUMN batas_kirim_surat INTEGER;

UPDATE konfigurasi_kanwil SET batas_input_sdm = 31, batas_kirim_surat = 20;

DROP TRIGGER IF EXISTS jejak_data_ubah_konfigurasi_kanwil;
DROP TRIGGER IF EXISTS jejak_data_hapus_konfigurasi_kanwil;

CREATE TRIGGER jejak_data_ubah_konfigurasi_kanwil AFTER UPDATE ON konfigurasi_kanwil FOR EACH ROW
WHEN OLD.id IS NOT NEW.id OR OLD.nama_kepala IS NOT NEW.nama_kepala OR OLD.nip_kepala IS NOT NEW.nip_kepala OR OLD.nomor_pp IS NOT NEW.nomor_pp OR OLD.tahun_pp IS NOT NEW.tahun_pp OR OLD.wa_admin IS NOT NEW.wa_admin OR OLD.notif_kgb_h1 IS NOT NEW.notif_kgb_h1 OR OLD.notif_kgb_h2 IS NOT NEW.notif_kgb_h2 OR OLD.sesi_timeout_menit IS NOT NEW.sesi_timeout_menit OR OLD.updated_at IS NOT NEW.updated_at OR OLD.updated_by IS NOT NEW.updated_by OR OLD.urutan_sisip IS NOT NEW.urutan_sisip OR OLD.batas_input_sdm IS NOT NEW.batas_input_sdm OR OLD.kppn_satker IS NOT NEW.kppn_satker OR OLD.batas_kirim_surat IS NOT NEW.batas_kirim_surat
BEGIN
  INSERT INTO jejak_data (tabel, aksi, id_baris, lama) VALUES ('konfigurasi_kanwil', 'ubah', OLD.id, json_object('id', OLD.id, 'nama_kepala', OLD.nama_kepala, 'nip_kepala', OLD.nip_kepala, 'nomor_pp', OLD.nomor_pp, 'tahun_pp', OLD.tahun_pp, 'wa_admin', OLD.wa_admin, 'notif_kgb_h1', OLD.notif_kgb_h1, 'notif_kgb_h2', OLD.notif_kgb_h2, 'sesi_timeout_menit', OLD.sesi_timeout_menit, 'updated_at', OLD.updated_at, 'updated_by', OLD.updated_by, 'urutan_sisip', OLD.urutan_sisip, 'batas_input_sdm', OLD.batas_input_sdm, 'kppn_satker', OLD.kppn_satker, 'batas_kirim_surat', OLD.batas_kirim_surat));
END;

CREATE TRIGGER jejak_data_hapus_konfigurasi_kanwil AFTER DELETE ON konfigurasi_kanwil FOR EACH ROW
BEGIN
  INSERT INTO jejak_data (tabel, aksi, id_baris, lama) VALUES ('konfigurasi_kanwil', 'hapus', OLD.id, json_object('id', OLD.id, 'nama_kepala', OLD.nama_kepala, 'nip_kepala', OLD.nip_kepala, 'nomor_pp', OLD.nomor_pp, 'tahun_pp', OLD.tahun_pp, 'wa_admin', OLD.wa_admin, 'notif_kgb_h1', OLD.notif_kgb_h1, 'notif_kgb_h2', OLD.notif_kgb_h2, 'sesi_timeout_menit', OLD.sesi_timeout_menit, 'updated_at', OLD.updated_at, 'updated_by', OLD.updated_by, 'urutan_sisip', OLD.urutan_sisip, 'batas_input_sdm', OLD.batas_input_sdm, 'kppn_satker', OLD.kppn_satker, 'batas_kirim_surat', OLD.batas_kirim_surat));
END;
