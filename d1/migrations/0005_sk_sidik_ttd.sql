-- Sidik, ukuran, dan status tanda tangan berkas SK bertanda tangan (ADR-096), sama dengan migrasi Supabase
-- 20261010150000_sk_sidik_ttd.sql. Kosong pada SK yang diunggah sebelumnya. Trigger jejak surat_kgb dibuat ulang supaya
-- kolom baru ikut tercatat; isi lama dipecah per 15 kolom karena D1 membatasi argumen fungsi.

ALTER TABLE surat_kgb ADD COLUMN sha256_berkas TEXT;
ALTER TABLE surat_kgb ADD COLUMN ukuran_berkas INTEGER;
ALTER TABLE surat_kgb ADD COLUMN status_ttd TEXT;

DROP TRIGGER IF EXISTS jejak_data_ubah_surat_kgb;
DROP TRIGGER IF EXISTS jejak_data_hapus_surat_kgb;

CREATE TRIGGER jejak_data_ubah_surat_kgb AFTER UPDATE ON surat_kgb FOR EACH ROW
WHEN OLD.id IS NOT NEW.id OR OLD.kgb_id IS NOT NEW.kgb_id OR OLD.nomor_surat IS NOT NEW.nomor_surat OR OLD.tanggal_surat IS NOT NEW.tanggal_surat OR OLD.nama_kepala_kanwil IS NOT NEW.nama_kepala_kanwil OR OLD.nip_kepala_kanwil IS NOT NEW.nip_kepala_kanwil OR OLD.path_file IS NOT NEW.path_file OR OLD.generated_at IS NOT NEW.generated_at OR OLD.generated_by IS NOT NEW.generated_by OR OLD.penandatangan_id IS NOT NEW.penandatangan_id OR OLD.jenis_penandatangan IS NOT NEW.jenis_penandatangan OR OLD.jabatan_penandatangan IS NOT NEW.jabatan_penandatangan OR OLD.urutan_sisip IS NOT NEW.urutan_sisip OR OLD.sha256_berkas IS NOT NEW.sha256_berkas OR OLD.ukuran_berkas IS NOT NEW.ukuran_berkas OR OLD.status_ttd IS NOT NEW.status_ttd
BEGIN
  INSERT INTO jejak_data (tabel, aksi, id_baris, lama) VALUES ('surat_kgb', 'ubah', OLD.id, json_patch(json_object('id', OLD.id, 'kgb_id', OLD.kgb_id, 'nomor_surat', OLD.nomor_surat, 'tanggal_surat', OLD.tanggal_surat, 'nama_kepala_kanwil', OLD.nama_kepala_kanwil, 'nip_kepala_kanwil', OLD.nip_kepala_kanwil, 'path_file', OLD.path_file, 'generated_at', OLD.generated_at, 'generated_by', OLD.generated_by, 'penandatangan_id', OLD.penandatangan_id, 'jenis_penandatangan', OLD.jenis_penandatangan, 'jabatan_penandatangan', OLD.jabatan_penandatangan, 'urutan_sisip', OLD.urutan_sisip, 'sha256_berkas', OLD.sha256_berkas, 'ukuran_berkas', OLD.ukuran_berkas), json_object('status_ttd', OLD.status_ttd)));
END;

CREATE TRIGGER jejak_data_hapus_surat_kgb AFTER DELETE ON surat_kgb FOR EACH ROW
BEGIN
  INSERT INTO jejak_data (tabel, aksi, id_baris, lama) VALUES ('surat_kgb', 'hapus', OLD.id, json_patch(json_object('id', OLD.id, 'kgb_id', OLD.kgb_id, 'nomor_surat', OLD.nomor_surat, 'tanggal_surat', OLD.tanggal_surat, 'nama_kepala_kanwil', OLD.nama_kepala_kanwil, 'nip_kepala_kanwil', OLD.nip_kepala_kanwil, 'path_file', OLD.path_file, 'generated_at', OLD.generated_at, 'generated_by', OLD.generated_by, 'penandatangan_id', OLD.penandatangan_id, 'jenis_penandatangan', OLD.jenis_penandatangan, 'jabatan_penandatangan', OLD.jabatan_penandatangan, 'urutan_sisip', OLD.urutan_sisip, 'sha256_berkas', OLD.sha256_berkas, 'ukuran_berkas', OLD.ukuran_berkas), json_object('status_ttd', OLD.status_ttd)));
END;
