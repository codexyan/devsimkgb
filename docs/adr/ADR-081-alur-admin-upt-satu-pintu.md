# ADR-081: Alur Admin UPT satu pintu

Tanggal: 7 Oktober 2026
Status: berlaku. Mengganti ADR-045 (kartu Laporkan per pegawai) dan ADR-074 (halaman Lapor KP/PI/PMK).

## Konteks

Skema Admin UPT dari pengguna: (1) input dan melengkapi data pegawai: identitas; jabatan; jenis KGB (sudah pernah: dasar
periode SK KGB terakhir, unggah SK KGB terakhir; belum pernah, hanya CPNS baru: unggah SK CPNS); dan (2) adakah SK
sesudah SK KGB terakhir: tidak, atau ya, lalu sistem mengakumulasikan masa kerja dan gaji serta meminta unggahan SK-nya.

Isi formulir sudah sejalan, tetapi:

- Sistem menagih **SK kenaikan pangkat terakhir** dari setiap pegawai yang sudah pernah KGB (ADR-030), padahal menurut
  skema SK kenaikan pangkat hanya diminta bila dilaporkan.
- Satu pekerjaan punya banyak pintu: SK KP/PI/PMK dapat dilaporkan lewat langkah 4 formulir, langkah 4 Kolektif, menu ⋯
  "Laporkan kenaikan pangkat/PMK", halaman Lapor KP/PI/PMK, dan kolom Excel. Tampilan dan aturannya sedikit berbeda-beda,
  dan perbedaan perilaku formulir dan Kolektif sempat menimbulkan kasus pada 7 Oktober.
- Tombol per pegawai berganti nama menurut keadaan draf (Usulkan perbaikan, Lengkapi draf, Ubah draf, Perbaiki usulan).

Pilihan pengguna: SK kenaikan pangkat hanya bila KP/PI dilaporkan; laporan SK hanya lewat langkah 4; satu label tombol.

## Keputusan

1. **Berkas** (`BERKAS_USULAN`, `berkasDasarBaru`): sudah pernah KGB cukup SK KGB terakhir. SK kenaikan pangkat
   (keadaan `kp`) ditagih hanya bila SK kenaikan pangkat atau penyesuaian ijazah dilaporkan, SK PMK hanya bila PMK
   dilaporkan. Keduanya milik laporannya sendiri, jadi tidak terbawa dari usulan yang disetujui sebelumnya
   (`lib/bawaanUsulan.ts`).
2. **Satu pintu laporan SK**: halaman Lapor KP/PI/PMK, kartu Laporkan per pegawai (menu ⋯), dan modulnya
   (`LaporSkMassal`, `ModalDasarBaru`, `laporSkKirim`, `lib/laporSk.ts`) dihapus. SK dilaporkan di langkah *SK sesudah SK
   KGB terakhir*: satu pegawai lewat **Perbarui data**, banyak pegawai lewat **Usul KGB Kolektif**. Tautan lama
   `/dashboard/upt/lapor-sk` dialihkan ke Usul KGB Kolektif. Peringatan dampak ke KGB yang sedang diproses atau SK yang
   sudah ditandatangani dipindah ke langkah itu, di formulir maupun Kolektif.
3. **Tanpa surat bila hanya laporan SK** (ADR-046 tetap): Kolektif dan Dashboard boleh mengajukan tanpa nomor surat;
   server menilai apakah seluruhnya laporan SK. Tanpa nomor surat, seluruh daftar diperiksa lebih dulu
   (`ajukanBertahap`), supaya kiriman tidak berhenti di tengah.
4. **Satu label**: tombol per pegawai di Pegawai Satker dan kartu Perlu diperiksa selalu **Perbarui data**; judul
   formulirnya *Perbarui data pegawai*. Keadaan drafnya tampil di kolom Status.
5. **Unggah daftar** tetap, untuk memasukkan banyak pegawai sekaligus; hasilnya draf yang dilengkapi lewat alur yang sama.
   Menu ⋯ tinggal Laporkan mutasi dan Seharusnya tidak tercatat?.

## Akibat

- Admin UPT tidak lagi mengunggah SK kenaikan pangkat bila tidak ada kenaikan pangkat yang dilaporkan.
- Laporan SK yang belum terkirim dari halaman lama tetap tersimpan sebagai draf usulan dan dapat dibuka lewat Perbarui
  data atau Kolektif.
- Pengumuman "Apa yang baru" untuk Lapor KP/PI/PMK diganti isinya menjadi laporan SK di satu tempat; Panduan diperbarui.
