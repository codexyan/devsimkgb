-- Dibuat otomatis dari skema akhir Postgres (supabase/migrations) untuk ADR-085. Jangan disunting; perubahan
-- skema berikutnya ditulis sebagai migrasi D1 baru (0003_..., dst.) dan lib/db/d1/skema.ts ikut diperbarui.

-- Penyesuaian dari Postgres:
--   • timestamptz disimpan sebagai TEXT ISO 8601 UTC (toISOString), boolean sebagai INTEGER 0/1, jsonb sebagai TEXT.
--   • urutan_sisip menjadi INTEGER PRIMARY KEY AUTOINCREMENT (urutan baris dimasukkan, tidak pernah dipakai ulang);
--     id tetap kunci aplikasi dengan UNIQUE, dan menjadi sasaran foreign key.
--   • gen_random_uuid() dan now() diganti ekspresi SQLite yang setara.

CREATE TABLE audit_log (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  waktu TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  aksi TEXT,
  detail TEXT,
  target_nama TEXT,
  ip_address TEXT,
  user_id TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE hukdis_jenis (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  kode TEXT NOT NULL UNIQUE,
  label TEXT,
  kategori TEXT,
  dasar_hukum TEXT,
  regulasi_id TEXT,
  durasi_hukdis INTEGER DEFAULT 0,
  berdampak_kgb INTEGER DEFAULT 0,
  durasi_tunda INTEGER,
  aktif INTEGER DEFAULT 1,
  urutan INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (regulasi_id) REFERENCES regulasi(id) ON DELETE SET NULL
);

CREATE TABLE hukdis_konfigurasi (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  notif_hari_h1 INTEGER DEFAULT 30,
  notif_hari_h2 INTEGER DEFAULT 14,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE konfigurasi_kanwil (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  nama_kepala TEXT,
  nip_kepala TEXT,
  nomor_pp TEXT,
  tahun_pp TEXT,
  wa_admin TEXT,
  notif_kgb_h1 INTEGER DEFAULT 14,
  notif_kgb_h2 INTEGER DEFAULT 7,
  sesi_timeout_menit INTEGER DEFAULT 60,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  batas_input_sdm INTEGER,
  kppn_satker TEXT,
  CHECK (((batas_input_sdm >= 1) AND (batas_input_sdm <= 31)))
);

CREATE TABLE laporan_hukdis (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  pegawai_id TEXT NOT NULL,
  satker TEXT NOT NULL,
  jenis_hukdis TEXT NOT NULL,
  nomor_sk TEXT,
  tanggal_sk TEXT,
  tmt_mulai TEXT,
  tmt_berakhir TEXT,
  keterangan TEXT,
  path_berkas TEXT,
  status TEXT NOT NULL,
  catatan_kanwil TEXT,
  dilaporkan_oleh TEXT,
  dilaporkan_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ditinjau_oleh TEXT,
  ditinjau_at TEXT,
  riwayat_id TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
);

CREATE TABLE laporan_mutasi (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  pegawai_id TEXT NOT NULL,
  satker TEXT NOT NULL,
  jenis TEXT NOT NULL,
  satker_tujuan TEXT,
  tmt TEXT,
  nomor_sk TEXT,
  tanggal_sk TEXT,
  alasan TEXT,
  keterangan TEXT,
  status TEXT NOT NULL,
  catatan_kanwil TEXT,
  dilaporkan_oleh TEXT,
  dilaporkan_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ditinjau_oleh TEXT,
  ditinjau_at TEXT,
  riwayat_id TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
);

CREATE TABLE notifikasi (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  judul TEXT,
  pesan TEXT,
  tipe TEXT,
  reference_id TEXT,
  dibaca INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  prioritas TEXT DEFAULT 'normal',
  link_href TEXT,
  kategori TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE pegawai (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  nip TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  jenis_kelamin TEXT,
  pendidikan_terakhir TEXT,
  jabatan TEXT,
  pangkat TEXT,
  golongan_ruang TEXT,
  unit_kerja TEXT,
  eselon TEXT,
  jenis_jabatan TEXT,
  tmt_golongan TEXT,
  mkg_tahun INTEGER DEFAULT 0,
  mkg_bulan INTEGER DEFAULT 0,
  gaji_pokok INTEGER DEFAULT 0,
  tmt_kgb_terakhir TEXT,
  tmt_kgb_berikutnya TEXT,
  status_hukdis INTEGER DEFAULT 0,
  tanggal_hukdis_berakhir TEXT,
  jenis_hukdis TEXT,
  keterangan_hukdis TEXT,
  aktif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  konfirmasi_upt_tmt TEXT,
  konfirmasi_upt_at TEXT,
  konfirmasi_upt_oleh TEXT,
  satker_tugas TEXT,
  berhenti_tmt TEXT,
  berhenti_alasan TEXT,
  nomor_sk_dasar TEXT,
  tanggal_sk_dasar TEXT,
  penetap_sk_dasar TEXT
);

CREATE TABLE penandatangan (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  jenis TEXT NOT NULL,
  nama TEXT NOT NULL,
  nip TEXT NOT NULL,
  jabatan TEXT NOT NULL,
  dasar_penunjukan TEXT,
  berlaku_mulai TEXT NOT NULL,
  berlaku_sampai TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  CHECK (((berlaku_sampai IS NULL) OR (berlaku_sampai >= berlaku_mulai))),
  CHECK (jenis IN ('definitif', 'plh', 'plt', 'dirjen'))
);

CREATE TABLE pengumuman_dilihat (
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  pengumuman_id TEXT NOT NULL,
  dilihat_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE profile_change_request (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  nama TEXT,
  jabatan TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  alasan_tolak TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE regulasi (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  nomor TEXT,
  tahun TEXT,
  tentang TEXT,
  status TEXT DEFAULT 'berlaku',
  pasal_berlaku TEXT,
  digantikan_oleh_id TEXT,
  catatan TEXT,
  urutan INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (digantikan_oleh_id) REFERENCES regulasi(id) ON DELETE SET NULL
);

CREATE TABLE rekon_bulanan (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  bulan_tmt TEXT NOT NULL UNIQUE,
  tanggal_input TEXT,
  input_by TEXT,
  jumlah_data INTEGER DEFAULT 0,
  catatan TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE review_sk_upt (
  id TEXT NOT NULL UNIQUE,
  pegawai_id TEXT NOT NULL,
  satker TEXT NOT NULL,
  status TEXT NOT NULL,
  versi INTEGER NOT NULL DEFAULT 1,
  nomor_surat TEXT,
  tanggal_surat TEXT,
  diminta_at TEXT,
  diminta_oleh TEXT,
  ditanggapi_at TEXT,
  ditanggapi_oleh TEXT,
  catatan TEXT,
  alasan_lewati TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (id) REFERENCES riwayat_kgb(id) ON DELETE CASCADE
);

CREATE TABLE riwayat_hukdis (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  pegawai_id TEXT NOT NULL,
  jenis_hukdis TEXT,
  nomor_sk TEXT,
  tanggal_sk TEXT,
  tmt_mulai TEXT,
  tmt_berakhir TEXT,
  berdampak_kgb INTEGER DEFAULT 0,
  durasi_tunda INTEGER,
  dasar_hukum TEXT,
  keterangan TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
);

CREATE TABLE riwayat_kgb (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  pegawai_id TEXT NOT NULL,
  nomor_sk TEXT,
  tanggal_sk TEXT,
  tmt_sk TEXT,
  golongan_lama TEXT,
  gaji_pokok_lama INTEGER DEFAULT 0,
  mkg_tahun_lama INTEGER DEFAULT 0,
  mkg_bulan_lama INTEGER DEFAULT 0,
  golongan_baru TEXT,
  gaji_pokok_baru INTEGER DEFAULT 0,
  mkg_tahun_baru INTEGER DEFAULT 0,
  mkg_bulan_baru INTEGER DEFAULT 0,
  tmt_kgb_baru TEXT,
  tmt_kgb_berikutnya TEXT,
  status TEXT NOT NULL DEFAULT 'belum_diproses',
  flag_rapelan INTEGER DEFAULT 0,
  is_arsip INTEGER DEFAULT 0,
  konfirmasi_keuangan_at TEXT,
  konfirmasi_keuangan_by TEXT,
  rapelan_ditetapkan INTEGER,
  input_gaji_web_at TEXT,
  input_gaji_web_by TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  penetap_sk_dasar TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  draf_nomor_surat TEXT,
  draf_tanggal_surat TEXT,
  FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
);

CREATE TABLE riwayat_mutasi (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  pegawai_id TEXT NOT NULL,
  jenis TEXT NOT NULL,
  satker_asal TEXT,
  satker_tujuan TEXT,
  tmt TEXT,
  nomor_sk TEXT,
  tanggal_sk TEXT,
  alasan TEXT,
  keterangan TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
);

CREATE TABLE riwayat_pangkat (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  pegawai_id TEXT NOT NULL,
  jenis_kp TEXT,
  nomor_sk TEXT,
  tanggal_sk TEXT,
  tmt_pangkat TEXT,
  golongan_lama TEXT,
  golongan_baru TEXT,
  mkg_tahun_lama INTEGER,
  mkg_bulan_lama INTEGER,
  mkg_tahun_baru INTEGER,
  mkg_bulan_baru INTEGER,
  gaji_pokok_lama INTEGER,
  gaji_pokok_baru INTEGER,
  keterangan TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  penetap_sk TEXT,
  FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
);

CREATE TABLE riwayat_pmk (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  pegawai_id TEXT NOT NULL,
  nomor_sk TEXT,
  tanggal_sk TEXT,
  tmt_pmk TEXT,
  golongan_ruang TEXT,
  tambah_bulan INTEGER,
  mkg_tahun_sebelum INTEGER,
  mkg_bulan_sebelum INTEGER,
  mkg_tahun_sesudah INTEGER,
  mkg_bulan_sesudah INTEGER,
  mkg_tahun_dasar_lama INTEGER,
  mkg_bulan_dasar_lama INTEGER,
  mkg_tahun_dasar_baru INTEGER,
  mkg_bulan_dasar_baru INTEGER,
  gaji_pokok_lama INTEGER,
  gaji_pokok_baru INTEGER,
  tmt_kgb_berikutnya_lama TEXT,
  tmt_kgb_berikutnya_baru TEXT,
  penetap_sk TEXT,
  keterangan TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
);

CREATE TABLE serah_terima (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  kgb_id TEXT NOT NULL,
  nama_admin TEXT,
  keterangan TEXT,
  tanggal_serah_terima TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (kgb_id) REFERENCES riwayat_kgb(id) ON DELETE CASCADE
);

CREATE TABLE surat_kgb (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  kgb_id TEXT NOT NULL UNIQUE,
  nomor_surat TEXT,
  tanggal_surat TEXT,
  nama_kepala_kanwil TEXT,
  nip_kepala_kanwil TEXT,
  path_file TEXT,
  generated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  generated_by TEXT,
  penandatangan_id TEXT,
  jenis_penandatangan TEXT,
  jabatan_penandatangan TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  FOREIGN KEY (kgb_id) REFERENCES riwayat_kgb(id) ON DELETE CASCADE,
  FOREIGN KEY (penandatangan_id) REFERENCES penandatangan(id) ON DELETE RESTRICT
);

CREATE TABLE template_surat (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  versi INTEGER NOT NULL,
  berlaku_mulai TEXT NOT NULL,
  isi TEXT NOT NULL,
  catatan TEXT,
  dibuat_oleh TEXT,
  dibuat_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE users (
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  nip TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nama TEXT,
  jabatan TEXT,
  email TEXT,
  role TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  satker TEXT,
  cadangan_terakhir_at TEXT
);

CREATE TABLE usulan_pegawai (
  id TEXT NOT NULL UNIQUE,
  pegawai_id TEXT,
  satker TEXT NOT NULL,
  status TEXT NOT NULL,
  nomor_surat TEXT,
  tanggal_surat TEXT,
  path_berkas TEXT,
  nama TEXT,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  jenis_kelamin TEXT,
  pendidikan_terakhir TEXT,
  jabatan TEXT,
  pangkat TEXT,
  golongan_ruang TEXT,
  eselon TEXT,
  jenis_jabatan TEXT,
  tmt_golongan TEXT,
  mkg_tahun INTEGER,
  mkg_bulan INTEGER,
  gaji_pokok INTEGER,
  tmt_kgb_terakhir TEXT,
  tmt_kgb_berikutnya TEXT,
  nomor_sk_terakhir TEXT,
  tanggal_sk_terakhir TEXT,
  hukdis_ada INTEGER DEFAULT 0,
  hukdis_jenis TEXT,
  hukdis_nomor_sk TEXT,
  hukdis_tmt_mulai TEXT,
  hukdis_tmt_berakhir TEXT,
  hukdis_keterangan TEXT,
  catatan_upt TEXT,
  diajukan_oleh TEXT NOT NULL,
  diajukan_at TEXT,
  ditinjau_oleh TEXT,
  ditinjau_at TEXT,
  alasan_tolak TEXT,
  urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL DEFAULT 'perubahan',
  nip TEXT,
  unit_kerja TEXT,
  path_sk_terakhir TEXT,
  path_syarat_cpns TEXT,
  path_sk_pangkat TEXT,
  path_sk_cpns TEXT,
  dasar_baru_jenis TEXT,
  dasar_baru_jenis_kp TEXT,
  dasar_baru_nomor_sk TEXT,
  dasar_baru_tanggal_sk TEXT,
  dasar_baru_tmt TEXT,
  dasar_baru_penetap TEXT,
  path_sk_pmk TEXT,
  golongan_acuan TEXT,
  mkg_tahun_acuan INTEGER,
  mkg_bulan_acuan INTEGER,
  keadaan_kgb TEXT
);

CREATE TABLE jejak_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  tabel TEXT NOT NULL,
  aksi TEXT NOT NULL,
  id_baris TEXT,
  lama TEXT NOT NULL
);

CREATE INDEX audit_log_aksi_idx ON audit_log (aksi);
CREATE INDEX audit_log_user_id_idx ON audit_log (user_id);
CREATE INDEX audit_log_waktu_idx ON audit_log (waktu DESC);
CREATE INDEX hukdis_jenis_regulasi_id_idx ON hukdis_jenis (regulasi_id);
CREATE INDEX jejak_data_tabel_id_idx ON jejak_data (tabel, id_baris);
CREATE INDEX jejak_data_waktu_idx ON jejak_data (waktu);
CREATE INDEX laporan_hukdis_pegawai_id_idx ON laporan_hukdis (pegawai_id);
CREATE INDEX laporan_hukdis_satker_status_idx ON laporan_hukdis (satker, status);
CREATE INDEX laporan_mutasi_pegawai_id_idx ON laporan_mutasi (pegawai_id);
CREATE INDEX laporan_mutasi_satker_status_idx ON laporan_mutasi (satker, status);
CREATE INDEX notifikasi_dibaca_created_at_idx ON notifikasi (dibaca, created_at DESC);
CREATE INDEX pegawai_aktif_tmt_kgb_berikutnya_idx ON pegawai (aktif, tmt_kgb_berikutnya);
CREATE INDEX pegawai_status_hukdis_idx ON pegawai (status_hukdis);
CREATE INDEX penandatangan_jenis_berlaku_mulai_idx ON penandatangan (jenis, berlaku_mulai);
CREATE UNIQUE INDEX pengumuman_dilihat_unik ON pengumuman_dilihat (user_id, pengumuman_id);
CREATE INDEX profile_change_request_status_idx ON profile_change_request (status);
CREATE INDEX profile_change_request_user_id_status_idx ON profile_change_request (user_id, status);
CREATE INDEX regulasi_status_idx ON regulasi (status);
CREATE INDEX review_sk_upt_satker_idx ON review_sk_upt (satker);
CREATE INDEX riwayat_hukdis_pegawai_id_idx ON riwayat_hukdis (pegawai_id);
CREATE INDEX riwayat_kgb_pegawai_id_status_idx ON riwayat_kgb (pegawai_id, status);
CREATE INDEX riwayat_kgb_status_idx ON riwayat_kgb (status);
CREATE INDEX riwayat_kgb_tmt_kgb_baru_idx ON riwayat_kgb (tmt_kgb_baru);
CREATE INDEX riwayat_mutasi_pegawai_id_idx ON riwayat_mutasi (pegawai_id);
CREATE INDEX riwayat_pangkat_pegawai_id_idx ON riwayat_pangkat (pegawai_id);
CREATE INDEX riwayat_pmk_pegawai_id_idx ON riwayat_pmk (pegawai_id);
CREATE INDEX serah_terima_kgb_id_idx ON serah_terima (kgb_id);
CREATE INDEX template_surat_berlaku_idx ON template_surat (berlaku_mulai);
CREATE INDEX usulan_pegawai_jenis_idx ON usulan_pegawai (jenis, status);
CREATE INDEX usulan_pegawai_pegawai_idx ON usulan_pegawai (pegawai_id);
CREATE INDEX usulan_pegawai_satker_status_idx ON usulan_pegawai (satker, status);
