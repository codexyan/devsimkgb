# ADR-044: Admin UPT melaporkan kenaikan pangkat, penyesuaian ijazah, dan PMK sebagai tindakan bernama

Tanggal: 1 Oktober 2026
Status: berlaku; melengkapi ADR-030 pada sisi pintu masuk

## Konteks

Dasar perhitungan gaji pokok memang SK KGB terakhir. Tetapi sesudah SK itu terbit — bahkan sesudah SK KGB
yang baru saja diterbitkan — masih mungkin terbit **SK kenaikan pangkat, SK penyesuaian ijazah, atau SK
PMK**. SK seperti itu menggeser masa kerja golongan pegawai sekaligus menjadi "Atas dasar" SK KGB
berikutnya (ADR-020, ADR-021).

Hitungannya sudah ditutup ADR-030: bila usulan UPT mengubah golongan atau masa kerja golongan, formulirnya
memunculkan bagian **"Sebab golongan atau masa kerja berubah"**, dan persetujuan Kanwil membentuk riwayat
KP atau PMK lewat jalur yang sama dengan Catat KP/PMK (`lib/catatDasarGaji.ts`).

Yang tidak ada adalah **tindakan bernama**. Operator UPT yang memegang SK kenaikan pangkat di tangan tidak
menemukan apa pun bernama "kenaikan pangkat" di layarnya; ia harus lebih dulu tahu bahwa jalannya adalah
Usulkan perbaikan data → ubah golongan → barulah bagian itu muncul, jauh di bawah layar.

Perbandingan tindakan per pegawai sebelum keputusan ini:

| Kanwil (kartu Dasar KGB) | Admin UPT (menu Tindakan) |
|---|---|
| Ubah SK dasar | — |
| Catat kenaikan pangkat | tersembunyi di dalam formulir usulan |
| Catat PMK | tersembunyi di dalam formulir usulan |
| Mutasi atau pemberhentian | Laporkan mutasi ✓ |
| + Hukdis | lewat menu Hukuman Disiplin ✓ |

Tiga celah yang menyertainya:

1. **Pintu masuk tak bernama**, seperti di atas.
2. **UPT tak pernah melihat riwayat KP/PMK.** Yang terlihat hanya satu baris ringkas pada kolom *Dasar KGB
   berikutnya*, padahal saat konfirmasi UPT diminta menyatakan bahwa SK terakhir penetap gaji sudah sesuai.
3. **Peremajaan massal tidak dapat membawa SK-nya.** Baris CSV yang golongan atau masa kerja golongannya
   berbeda otomatis berstatus *belum lengkap* dengan kekurangan "sebab perubahan golongan atau masa kerja
   golongan" (`lib/usulanPegawai.ts`), dan satu-satunya jalan melengkapinya adalah membuka pegawai satu per
   satu di Usulan kolektif. Sesudah kenaikan pangkat periode April atau Oktober, satu satker bisa belasan
   pegawai sekaligus.

## Keputusan (pemilik, 1 Oktober 2026)

1. **Dua tindakan bernama di menu Tindakan baris pegawai**: *Laporkan kenaikan pangkat* (termasuk
   penyesuaian ijazah) dan *Laporkan peninjauan masa kerja*. Keduanya membuka formulir usulan perbaikan
   yang sudah ada dengan sebabnya terpilih dan bagian SK-nya langsung terlihat. Dipilih di atas jalur
   laporan tersendiri seperti mutasi: jalur persetujuannya sudah dibangun ADR-030, dan menggandakannya
   berarti satu tabel, satu rute, dan satu panel tinjauan baru untuk hasil akhir yang sama.
2. **Enam kolom SK pada templat unggah daftar** — `dasarBaruJenis`, `dasarBaruJenisKp`, `dasarBaruNomorSk`,
   `dasarBaruTanggalSk`, `dasarBaruTmt`, `dasarBaruPenetap` — sehingga peremajaan massal sesudah kenaikan
   pangkat periode selesai sekali unggah.
3. **Riwayat KP dan PMK terlihat UPT**, baca-saja, di dalam baris pegawai pada Riwayat KGB.
4. **Lencana pada kolom Dasar KGB berikutnya** — *Dari KP/PI* atau *Dari PMK* — bila dasarnya bukan SK KGB.

Yang **tidak** berubah: data induk tetap diubah Kanwil. Tindakan baru ini tetap menghasilkan usulan yang
ditinjau Kanwil, dan Kanwil yang mencatat riwayatnya saat menyetujui, sehingga masa kerja golongan dan gaji
pokok tetap dihitung sistem — naik dari golongan II ke III tetap memotong masa kerja 5 tahun.

## Akibat

- **Tanpa migrasi basis data.** Keenam kolom `dasar_baru_*` sudah ada sejak ADR-030; yang bertambah hanya
  jalan masuk ke kolom itu.
- `FormulirUsulan` menerima `sebabAwal`. Draf yang sudah menyebut sebabnya tidak pernah ditimpa: yang
  tersimpan menang atas yang baru dipilih dari menu. Bagian SK-nya digulirkan ke tengah layar saat terbuka,
  sebab tanpa itu operator mendarat di bagian identitas dan tidak melihat tanda bahwa tindakannya
  mengerjakan sesuatu.
- `periksaImporUpt` membaca keenam kolom lewat `bacaDasarBaru` yang sama dengan formulir, dan **menolak**
  nilai yang tidak dikenal dengan menyebut pilihan yang diterima. Didiamkan, baris seperti itu akan
  tersimpan sebagai usulan tanpa sebab lalu tertahan saat diajukan tanpa petunjuk apa pun. Kedua tanggal
  SK-nya ikut diseragamkan dari dd/mm/yyyy, sama seperti tanggal lain pada berkas.
- Layar pratinjau unggahan menampilkan satu baris *Sebab:* berisi ringkasan SK-nya, agar yang akan
  tersimpan terlihat sebelum disimpan — sejalan dengan ADR-031.
- `GET /api/upt/riwayat-kgb` menyertakan `skDasar`: riwayat KP dan PMK pegawai satker itu, dibatasi satker
  akun seperti seluruh rute UPT. Jalur berkas SK-nya tidak ikut, sebab SK KP dan PMK memang tidak diunggah
  ke SIM-KGB.
- **Batas yang disadari:** daftar SK itu muncul di dalam baris pegawai pada Riwayat KGB, dan halaman itu
  disusun dari riwayat KGB. Pegawai yang belum punya satu pun baris riwayat KGB karena itu belum terlihat
  di sana — keadaan yang sama dengan sebelum keputusan ini.
- Diperiksa pada data lokal dengan Chrome headless, sebagai Admin UPT Rutan Rantau:
  - menu Tindakan memuat empat butir, dua yang baru di urutan atas;
  - *Laporkan kenaikan pangkat* membuka formulir dengan pilihan SK kenaikan pangkat sudah terpilih dan
    isian nomor, tanggal, serta TMT-nya terlihat;
  - kolom Dasar KGB berikutnya menampilkan *Dari KP/PI* pada pegawai ber-SK KP dan *Dari PMK* pada
    pegawai ber-SK PMK;
  - Riwayat KGB menampilkan tabel "SK kenaikan pangkat dan peninjauan masa kerja, dicatat Kanwil".
- Diperiksa lewat rute unggahan yang sesungguhnya (`periksaSaja`): baris ber-SK lengkap tidak lagi kurang
  sebabnya, baris tanpa SK tetap ditagih seperti sebelumnya, dan baris bernilai "naik pangkat" ditolak
  dengan pesan yang menyebut `kp · pmk · koreksi`.
- 438 uji lolos, termasuk lima uji baru di `lib/imporUsulanUpt.test.ts`; `tsc --noEmit` dan ESLint bersih.
