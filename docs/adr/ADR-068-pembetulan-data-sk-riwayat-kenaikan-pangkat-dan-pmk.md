# ADR-068: Pembetulan data SK riwayat kenaikan pangkat dan PMK

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Riwayat kenaikan pangkat dan PMK tercatat lewat Catat KP/PMK atau lewat persetujuan usulan UPT, dan sesudah itu tidak
dapat diubah. Salah ketik pada data SK-nya lalu terbawa ke banyak tempat:
- Atas dasar dan baris "Oleh" pada SK KGB berikutnya, lewat linimasa SK penetap gaji pokok (ADR-062);
- penetap SK dasar pada KGB yang sedang berjalan;
- pencocokan pindaian, yang memakai jenis dan nomor SK (ADR-066, ADR-067).

Satu-satunya jalan selama ini adalah mencatat ulang, padahal pencatatan menghitung ulang golongan dan gaji pokok.

Tab Pangkat & PMK juga belum menampilkan pejabat penetap ("Ditetapkan oleh").

## Keputusan

1. **Data SK yang dapat dibetulkan:** nomor SK, tanggal SK, pejabat penetap, dan jenis kenaikan pangkat. Keempatnya
   tidak ikut menghitung gaji pokok, masa kerja, atau jadwal KGB.
   - Golongan, masa kerja, gaji pokok, dan TMT tetap tidak dapat diubah dari sini, karena hitungannya sudah diterapkan
     ke data pegawai dan KGB.
   - Pembetulannya lewat `PATCH /api/pegawai/[id]/pangkat` dan `/pmk` (`lib/ubahSkRiwayat.ts`).
   - Haknya sama dengan Catat KP/PMK: Super Admin dan Tim SDM KGB.
2. **Nomor yang sudah dipakai riwayat lain** dari jenis yang sama pada pegawai yang sama ditolak. Tanpa aturan ini,
   pindaian dan Atas dasarnya tidak dapat dibedakan.
3. **Salinan data SK diselaraskan dalam satu simpan:**
   - **KGB yang belum ditandatangani:**
     - KGB Sedang Diproses atau jadwal yang belum diproses yang Atas dasarnya bernomor sama dengan nomor lama ikut
       memakai nomor, tanggal, dan penetap baru.
     - Jadwal tanpa nomor dasar hanya mengikuti penetapnya, dengan syarat SK ini memang SK terbaru dan penetapnya masih
       penetap lama. Aturan ini sama dengan Catat KP/PMK (`rencanaSelarasKgb`).
     - KGB yang SK-nya sudah dibuat diberi tahu untuk dibuat ulang.
   - **SK KGB yang sudah ditandatangani** (Menunggu Keuangan atau Selesai) tidak diubah, sebab dokumennya sudah sah
     dengan isi lamanya. Hal ini disebutkan dalam hasil simpan.
   - **SK dasar pada Data Pegawai** ikut dibetulkan bila nomornya sama dengan nomor lama SK ini.
   - **Pindaian di arsip dokumen pegawai** dengan jenis dan nomor lama ikut memakai nomor dan tanggal baru.
   - **Pindaian dari berkas usulan UPT yang disetujui** disalin ke arsip dengan nomor baru, bila belum ada pindaian di
     arsip. Usulannya sendiri tidak diubah.
4. **Tampilan tab Pangkat & PMK:**
   - Tiap baris menampilkan "Ditetapkan oleh" dan tombol **Ubah data SK**.
   - Hasil simpan menyebutkan apa saja yang ikut diselaraskan.
   - Jejaknya tercatat di Log Aktivitas sebagai "Betulkan SK KP" atau "Betulkan SK PMK". Label "Peninjauan masa
     kerja" yang belum ada ikut ditambahkan.

## Akibat

- Linimasa, Buat SK, dan baris riwayat langsung memakai data SK yang dibetulkan, karena ketiganya membaca riwayat yang
  sama.
- Pembetulan golongan, masa kerja, atau TMT tetap lewat pencatatan ulang oleh Tim SDM.
