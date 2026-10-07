# ADR-076: Mengembalikan usulan yang sudah disetujui, dan ringkasan usulan menunggu di dasbor

Tanggal: 7 Oktober 2026
Status: berlaku

## Konteks

Satu UPT dapat mengirim puluhan usulan sekaligus (hasil Unggah daftar, satu surat memuat banyak pegawai), dan Kanwil
menyetujuinya per surat (`POST /api/usulan/batch`). Dua hal muncul dari pemakaian nyata dengan usulan dari LPP Martapura:

1. **Usulan yang sudah disetujui tidak dapat dikembalikan.** Tombol Kembalikan hanya ada selama status Menunggu; sesudah
   disetujui, usulan masuk tab Selesai tanpa tombol dan server menjawab 409 "Usulan ini sudah ditinjau". Yang keliru baru
   ketahuan sesudah diterapkan, dan hanya dapat dibetulkan Kanwil sendiri di Data Pegawai tanpa UPT mengetahuinya.
2. **Dasbor Super Admin penuh.** Panel "Usulan UPT menunggu" menampilkan satu baris per pegawai dari semua UPT. Di layar
   lebar tingginya dibatasi 30% layar dengan gulir di dalamnya, di ponsel tidak dibatasi; 48 usulan satu UPT berarti 48 baris.

Pengguna meminta analisis dan memilih, dari opsi yang diajukan: kembalikan dengan data tetap (bukan menarik data, bukan
sekadar mengabari UPT), dan ringkasan satu baris per UPT di dasbor.

Mengapa usulan yang sama tidak dapat sekadar dibuka kembali lalu disetujui ulang:
- Persetujuan sudah menulis data pegawai, mencatat riwayat KP/PMK, dan menyesuaikan KGB. Keadaan sebelumnya tidak
  tersimpan, sehingga penerapan lama tidak dapat ditarik.
- Persetujuan ulang akan ditolak: SK bernomor sama dianggap sudah tercatat (ADR-069), golongan lamanya sudah naik
  ("harus lebih tinggi"), dan NIP pegawai baru sudah ada.
- Dokumen usulan yang disetujui dipakai tab Dokumen, linimasa SK (hanya yang berstatus disetujui), dan bawaan usulan
  berikutnya. Membuka statusnya kembali menghilangkan dokumen itu dari sana.

## Keputusan

1. **Kembalikan ke UPT muncul juga pada usulan Selesai (disetujui)**, dengan catatan wajib (`PATCH /api/usulan/[id]`,
   `aksi: "kembalikan"`, `lib/kembalikanUsulanDisetujui.ts`). Yang dikembalikan bukan usulan lamanya, melainkan **usulan
   perbaikan baru berstatus "revisi"** yang dibuat dari data pegawai saat ini:
   - Seluruh kolom data diisi dari data pegawai sekarang, termasuk kolom hitungan, sehingga usulan mulai dari "tidak ada
     selisih" dan UPT hanya menyunting yang keliru. Yang sudah dibetulkan Kanwil langsung di Data Pegawai ikut terbaca.
     Menyalin isian usulan lama justru akan mengembalikan nilai yang keliru, dan masa kerja golongan pada usulan lama
     (sebelum SK dihitung) bukan lagi angka yang berlaku.
   - Jenisnya `perubahan` atas pegawai yang kini tercatat, termasuk untuk usulan pegawai baru, sehingga persetujuan ulang
     tidak bentrok NIP dan tidak membuat pegawai kedua. Usulan pegawai baru lama yang belum mencatat `pegawaiId` dikenali
     dari NIP-nya.
   - SK kenaikan pangkat atau PMK yang sudah tercatat tidak dicatat ulang: jawaban SK barunya "tidak ada" (ADR-065).
     Mengubah data SK yang sudah tercatat tetap lewat Ubah data SK di tab Pangkat & PMK. Laporan hukdis pada usulan lama
     tidak dibawa, karena sudah ditindaklanjuti di modulnya.
   - Berkas tidak disalin: usulan perbaikan membawa berkas dari usulan yang disetujui (bawaan, ADR-017) dan disalin saat
     UPT menyimpan atau mengajukannya. Surat usulan diunggah ulang saat mengajukan.
   - Usulan lama tidak disentuh: tetap Selesai sebagai riwayat dan sumber dokumennya. Data pegawai tidak berubah sebelum
     perbaikan disetujui, dan yang diterapkan hanya selisihnya terhadap data saat itu.
   - Dari sisi UPT ia sama dengan usulan yang dikembalikan biasa: muncul di Perlu dikerjakan beserta catatan Kanwil,
     lonceng usulan dikembalikan dengan pesan khusus ("sudah disetujui ... data pegawai tidak berubah"), dapat disunting
     dan diajukan ulang lewat jalur yang sama. UPT yang memutuskan perbaikan itu tidak perlu dikirim dapat menghapusnya;
     usulan lamanya tidak terpengaruh.
2. **Penjaga:**
   - Pegawai yang sudah punya usulan lain yang belum selesai (draf, menunggu, atau diperbaiki UPT) tidak dapat dikembalikan
     usulannya; satu pegawai hanya boleh punya satu usulan yang belum selesai. Tombolnya nonaktif dengan penjelasan.
   - Pegawai yang sudah pindah dari satker usulan ditolak (UPT asal tidak lagi melihatnya); betulkan di Data Pegawai.
   - Pegawai yang sudah tidak ada ditolak. Peninjau yang berhak sama dengan tinjauan biasa (Super Admin dan Tim SDM KGB).
3. **Jejak:** Log Aktivitas mencatat "Kembalikan usulan selesai" beserta catatannya dan bahwa data pegawai tidak berubah.
4. **Ringkasan di dasbor** (`lib/ringkasUsulanUpt.ts`, diuji): panel "Usulan UPT menunggu" menampilkan satu baris per UPT
   (jumlah usulan, jumlah surat, laporan SK tanpa surat, umur usulan tertua, dan penanda umur 7 dan 14 hari yang sama
   dengan penanda usulan lain di dasbor), terbanyak lebih dulu. Tombol Tinjau membuka `/dashboard/usulan?upt=<kode>` yang
   sudah tersaring ke UPT itu; halaman Usulan UPT juga menerima `?tab=`. Daftar nama pegawai tidak lagi di dasbor: tinjauan
   per pegawai dan Setujui per surat dikerjakan di halaman Usulan UPT. Papan Antrian kerja tetap menandai pegawai yang
   prosesnya tertahan usulan dan menyediakan tombol Tinjau usulan UPT-nya.
5. Panduan Kanwil dan UPT diperbarui.

## Akibat

- Usulan yang telanjur disetujui, termasuk usulan LPP Martapura yang sudah diterapkan, dapat dikembalikan tanpa migrasi dan
  tanpa menyentuh data pegawai, dokumen, maupun riwayat.
- Kanwil tidak dapat menarik kembali penerapan yang lama (keadaan sebelumnya tidak tersimpan). Bila data pegawainya keliru,
  Kanwil membetulkannya langsung di Data Pegawai, atau mengembalikan usulan dan membiarkan UPT memperbaikinya, lalu
  menyetujui perbaikannya.
- Selama usulan perbaikan menunggu tinjauan, proses KGB pegawainya tertahan lagi seperti usulan lain (ADR-014); selama
  masih diperbaiki UPT, tidak.
- Persetujuan massal per surat tetap tidak memilah dan tidak dapat dibatalkan; pengembalian kini menjadi jalan perbaikannya.
- Dasbor tidak lagi memanjang menurut jumlah pegawai; panjangnya mengikuti jumlah UPT (paling banyak puluhan).
