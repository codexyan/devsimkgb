# ADR-066: Dokumen SK pada linimasa SK penetap gaji pokok

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Linimasa SK penetap gaji pokok (ADR-062) dibuka Super Admin dan Tim SDM KGB dari Input KGB dan Buat SK. Linimasa ini
menunjukkan SK mana yang menjadi Atas dasar SK KGB. Peninjau perlu mencocokkannya dengan dokumen aslinya, tetapi
linimasa belum dapat membuka dokumen apa pun.

Penyimpanan pindaian berbeda menurut jenis SK:
- **SK KGB dari SIM-KGB:** SK bertanda tangan tersimpan di surat KGB-nya (`SuratKGB.pathFile`).
- **SK kenaikan pangkat (termasuk penyesuaian ijazah) dan SK PMK:** riwayatnya sengaja tidak menyimpan kunci berkas
  (ADR-028). Pindaiannya ada di arsip dokumen pegawai (diunggah saat Catat KP/PMK), atau di berkas usulan UPT yang
  disetujui.
- **SK KGB terakhir dan SK CPNS di Data Pegawai:** pindaiannya ada di arsip dokumen pegawai atau di berkas usulan UPT.

Ada dua kendala. Daftar dokumen pegawai belum menyebut nomor SK untuk berkas usulan, sehingga berkas itu tidak dapat
dicocokkan. Selain itu, SK yang TMT-nya tidak tercatat justru tampil paling atas linimasa.

Pengguna memilih tiga keputusan di bawah dari pilihan yang diajukan.

## Keputusan

1. **Dokumen dicocokkan menurut jenis dan nomor SK**, tanpa kolom baru (`lib/dokumenLinimasa.ts`).
   - **SK KGB dari SIM-KGB** ditautkan lewat KGB-nya.
   - **Jenis SK lain** dicocokkan pada daftar dokumen pegawai (`GET /api/pegawai/[id]/dokumen`) menurut jenis
     dokumen dan nomor SK. Nomor dibandingkan setelah spasi dibuang dan huruf diseragamkan (`kunciNomorSk`).
   - **Urutan sumber bila beberapa berkas cocok:**
     1. SK bertanda tangan di SIM-KGB;
     2. arsip dokumen yang diunggah Kanwil;
     3. berkas usulan UPT, hanya dari usulan yang disetujui.
   - **Formulir inventarisasi tidak dipakai**, karena modul itu akan dihapus (ADR-027).
   - **Daftar dokumen pegawai kini menyebut nomor dan tanggal SK pada berkas usulan:**
     - SK kenaikan pangkat atau SK PMK yang dilaporkan memakai nomor laporannya.
     - SK KGB terakhir dan SK CPNS memakai nomor SK acuan.
     - "SK kenaikan pangkat terakhir" tanpa laporan kenaikan pangkat tidak bernomor, karena berkas itu bisa saja SK
       lama yang terbawa dari usulan sebelumnya.
     - Daftar itu juga memuat status usulannya.
   - **Pindaian SK PMK** pada usulan kini berjenis `sk_pmk`.
2. **SK KGB yang belum diunggah bertanda tangan** membuka draf cetakan SIM-KGB yang berlabel "Draf cetakan SIM-KGB,
   tanpa tanda tangan" (`unduhUlangSk`). Draf baru dipakai bila arsip dokumen pegawai juga tidak memuat pindaiannya.
   Arsip KGB tidak pernah dicetak SIM-KGB, jadi tidak punya draf.
3. **Linimasa tetap berurutan dari yang terlama ke yang terbaru.**
   - Di atasnya ada ringkasan "Atas dasar SK KGB ini": nama SK, nomor, TMT, tanggal penetapan, dan tombol
     dokumennya.
   - Tiap SK punya tombol "Lihat dokumen" (atau "Lihat draf SK") beserta sumbernya. SK yang belum punya pindaian
     bertuliskan "Belum ada pindaian".
   - Dokumen dibuka di jendela pratinjau (`ModalPratinjauBerkas`) di atas linimasa, dengan tautan "Buka di tab baru".
   - SK yang TMT-nya tidak tercatat dikelompokkan di bawah garis waktu, kecuali bila SK itu justru dasarnya.

## Akibat

- Bila daftar dokumen gagal dimuat, linimasa tetap tampil dengan catatan bahwa dokumennya belum dapat dibuka.
- Tab Dokumen di halaman pegawai ikut menampilkan nomor SK pada berkas usulan.
- SK yang pindaiannya tidak pernah diunggah dengan nomor yang sama tetap bertuliskan "Belum ada pindaian". Pindaiannya
  dapat diunggah lewat tab Dokumen dengan jenis dan nomor SK yang benar.
