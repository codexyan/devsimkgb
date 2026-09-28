-- SK baru yang menetapkan gaji pokok pada usulan UPT (ADR-030).
--
-- Sebelum ini, usulan yang mengubah golongan atau masa kerja golongan menulis nilainya langsung ke data
-- pegawai tanpa membentuk riwayat, sehingga SK KGB berikutnya tetap menyebut SK KGB lama pada bagian
-- "Atas dasar" walau gaji pokoknya sudah berasal dari SK kenaikan pangkat, penyesuaian ijazah, atau PMK.
--
-- Kolom ini memuat SK yang menyebabkan perubahan itu. Saat Kanwil menyetujui usulannya, riwayat kenaikan
-- pangkat atau PMK dibentuk lewat jalur yang sama dengan Catat KP/PMK di halaman pegawai
-- (lib/catatDasarGaji.ts), sehingga dasar KGB berikutnya ikut berpindah (ADR-020, ADR-021).
--
--   dasar_baru_jenis     "kp" (kenaikan pangkat termasuk penyesuaian ijazah), "pmk", atau "koreksi"
--                        untuk pembetulan salah ketik tanpa SK baru. Kosong pada usulan yang tidak
--                        menyentuh golongan maupun masa kerja golongan.
--   dasar_baru_jenis_kp  jenis kenaikan pangkat (lib/kenaikanPangkat.ts), hanya bila jenisnya "kp".
--   dasar_baru_tmt       TMT pangkat untuk "kp", TMT PMK untuk "pmk".
alter table public.usulan_pegawai add column if not exists dasar_baru_jenis text;
alter table public.usulan_pegawai add column if not exists dasar_baru_jenis_kp text;
alter table public.usulan_pegawai add column if not exists dasar_baru_nomor_sk text;
alter table public.usulan_pegawai add column if not exists dasar_baru_tanggal_sk timestamptz;
alter table public.usulan_pegawai add column if not exists dasar_baru_tmt timestamptz;
alter table public.usulan_pegawai add column if not exists dasar_baru_penetap text;
