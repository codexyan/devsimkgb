# ADR-070: Sinkron Atas dasar KGB di halaman pegawai

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Tiga bagian di halaman pegawai menampilkan data SK yang sama, tetapi masing-masing berjalan sendiri:
- **Kartu Dasar KGB (tab Data pegawai)** hanya menampilkan SK dasar yang diketik, yaitu SK KGB terakhir atau SK CPNS.
  Atas dasar KGB berikutnya bisa SK lain yang lebih baru, misalnya SK kenaikan pangkat (ADR-020, ADR-062), dan itu
  tidak terlihat di kartu ini.
- **Tab Riwayat KGB** menampilkan "SK terakhir" yang tersalin pada tiap KGB tanpa pembanding, sehingga salinan yang
  usang tidak kelihatan. SK bertanda tangannya dibuka di tab baru.
- **Ubah SK dasar** tidak meneruskan pembetulannya ke KGB yang belum ditandatangani, ke pindaian di arsip, atau ke
  riwayat kenaikan pangkat dan PMK bernomor sama. Padahal pembetulan dari arah sebaliknya sudah diselaraskan (ADR-068).

Pengguna meminta Riwayat KGB, Pangkat & PMK, dan peremajaan Dasar KGB pada Data Pegawai sinkron, begitu juga dokumen
lampirannya.

## Keputusan

1. **Satu sumber Atas dasar:** linimasa SK penetap gaji pokok (`muatLinimasaDasar`, ADR-062). Konteksnya mengikuti
   keadaan KGB:
   - bila ada KGB Sedang Diproses, dipakai konteks Buat SK untuk KGB itu;
   - selain itu dipakai KGB berikutnya.

   Kartu Dasar KGB dan tab Riwayat KGB membaca hasil yang sama. Dokumen dicocokkan lewat aturan yang sama dengan
   linimasa dan tab Pangkat & PMK (`lib/dokumenLinimasa.ts`, `lib/atasDasarKgb.ts`).
2. **Kartu Dasar KGB:**
   - SK dasar diberi label "SK KGB terakhir (acuan jadwal)", atau "SK CPNS (acuan jadwal)" bagi yang belum pernah KGB.
   - Ada baris baru "Atas dasar KGB berikutnya" yang memuat SK, penetap, TMT KGB yang dituju, tombol dokumennya, dan
     tombol Linimasa SK.
3. **Tab Riwayat KGB** (Super Admin dan Tim SDM KGB):
   - KGB Sedang Diproses atau Belum Diproses menampilkan Atas dasar menurut linimasa. Bila Atas dasar yang tersalin
     pada KGB itu berbeda, ada peringatan bahwa Buat SK memakai SK terbaru.
   - **SK KGB itu sendiri:** dibuka di jendela pratinjau, bertanda tangan atau sebagai draf cetakan SIM-KGB. Bila belum
     ada pindaian, tersedia tombol **Unggah SK** yang menyimpannya ke arsip dokumen dengan nomor SK-nya.
   - **SK yang menjadi Atas dasarnya:** pindaiannya dapat dibuka dari kartu KGB yang sama.
   - Peran lain tetap melihat tampilan lama, termasuk tautan SK bertanda tangan.
4. **Ubah SK dasar menyelaraskan salinannya** (`lib/selarasSkDasar.ts`), dengan aturan yang sama dengan ADR-068 tetapi
   dari arah Data Pegawai:
   - KGB yang belum ditandatangani dan Atas dasarnya bernomor sama dengan SK dasar lama ikut memakai data baru.
   - Jadwal tanpa nomor hanya mengikuti penetapnya, dan hanya bila tidak ada kenaikan pangkat atau PMK sesudahnya.
   - Pindaian SK KGB atau SK CPNS di arsip dokumen yang bernomor lama ikut memakai nomor baru.
   - Riwayat kenaikan pangkat atau PMK bernomor sama, dari data lama yang menyimpan SK KP sebagai SK dasar, ikut
     dibetulkan.
   - SK KGB yang sudah ditandatangani tidak diubah.
   - Hasilnya disebutkan dalam pesan simpan dan Log Aktivitas.

## Akibat

- Membetulkan data SK di salah satu tempat (Ubah SK dasar, atau Ubah data SK di Pangkat & PMK) langsung terlihat di
  dua tempat lainnya dan di Buat SK.
- Atas dasar yang tersalin pada KGB yang sedang berjalan tidak ditimpa diam-diam bila SK terbarunya berbeda. Tim SDM
  melihat peringatannya, dan Buat SK menggantinya dengan SK terbaru (ADR-062).
