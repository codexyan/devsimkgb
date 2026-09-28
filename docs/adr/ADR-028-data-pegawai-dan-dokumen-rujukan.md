# ADR-028: Tab Data pegawai dan dokumen rujukan pada setiap tindakan

Tanggal: 28 September 2026
Status: berlaku; melanjutkan ADR-025

## Konteks

- **Data induk pegawai tidak pernah tampil utuh.** Tempat dan tanggal lahir, pendidikan, jenis jabatan, SK dasar,
  dan status hanya terlihat di dalam modal Ubah.
- **Arsip dokumen sulit ditemukan.** Dokumen ada di tab "Dokumen & Pemutakhiran", di bawah kiriman
  inventarisasi.
- **Modal tindakan tidak terhubung ke berkas.** Modal Ubah identitas sampai Mutasi/pemberhentian berupa formulir
  satu kolom tanpa kaitan dengan berkas. Catat KP, PMK, dan mutasi hanya menyimpan nomor dan tanggal SK, tanpa
  PDF-nya.
- **Menu Tindakan tertinggal terbuka** di belakang modal.

## Keputusan (pemilik, 28 September 2026)

1. **Tab Data pegawai**, tab pertama dan bawaan di halaman pegawai, berisi empat kartu:
   - **Identitas**, **Kepegawaian**, **Dasar KGB**, dan **Status & mutasi**, dengan riwayat mutasi dan
     pemberhentian;
   - tiap kartu punya tombol ubah atau catat, dan menampilkan dokumen arsip terkait sebagai chip yang dapat
     dipratinjau;
   - menu Tindakan tetap ada sebagai pintasan dan kini menutup begitu satu tindakan dipilih.
2. **Modal tindakan dua kolom.** Isian ada di kiri. Di kanan, panel *Dokumen rujukan* menampilkan dokumen sejenis
   dari semua sumber (arsip, SK KGB SIM-KGB, berkas usulan UPT, kiriman formulir), dengan pratinjau di tempat.
   Jenisnya per tindakan diatur di `DOKUMEN_TINDAKAN` (`lib/dokumenPegawai.ts`):

   | Tindakan | Rujukan | SK yang dapat dilampirkan |
   |---|---|---|
   | Identitas | SK CPNS, SK PNS, ijazah | (tidak ada) |
   | Kepegawaian | SK jabatan, SK mutasi | SK jabatan |
   | Dasar KGB | SK KGB, SK CPNS, SK pangkat, SK PMK | SK KGB atau SK CPNS |
   | Kenaikan pangkat | SK kenaikan pangkat | SK kenaikan pangkat |
   | PMK | SK PMK, SK pangkat | SK PMK |
   | Mutasi | SK mutasi, SK jabatan | SK mutasi |
   | Pemberhentian | SK pemberhentian, SK mutasi | SK pemberhentian |

3. **Pilih dari arsip atau unggah baru.**
   - Bila SK-nya sudah ada di daftar rujukan, unggahan dilewati.
   - Bila belum, PDF dilampirkan di modal dan diunggah ke arsip dokumen pegawai **setelah** pencatatannya
     tersimpan. Jenis, nomor, dan tanggal SK diambil dari isian, sehingga tidak ada SK di arsip untuk pencatatan
     yang gagal.
   - Bila unggahannya gagal, pencatatan tetap tersimpan dan pesannya meminta unggah ulang dari tab Dokumen.
4. **Jenis dokumen baru:** *SK mutasi* dan *SK pemberhentian*. Daftar dokumen gabungan kini membawa `jenis` tiap
   dokumen. Berkas usulan UPT dipetakan lewat `JENIS_BERKAS_USULAN`.
5. **Tab Dokumen.** Nama tabnya kini "Dokumen": arsip tampil lebih dulu, dan kiriman inventarisasi yang sementara
   di bawahnya. Tab ini tetap hanya untuk Super Admin dan Tim SDM KGB.

## Akibat

- Tidak ada migrasi basis data: dokumen tetap di R2 (`dokumen/<id pegawai>/`).
- Riwayat KP, PMK, dan mutasi tetap tidak menyimpan kunci berkas. SK-nya dikenali di arsip lewat jenis, nomor, dan
  tanggalnya.
- Arsip dokumen per pegawai dapat dilihat di dua tempat:
  - tab *Data pegawai*, per kartu;
  - tab *Dokumen*, lengkap dengan saringan sumber.
