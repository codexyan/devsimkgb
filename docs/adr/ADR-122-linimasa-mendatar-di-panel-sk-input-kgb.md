# ADR-122: Linimasa mendatar di panel SK Input KGB

Tanggal: 21 Oktober 2026
Status: berlaku

## Konteks

Panel SK di samping formulir Input KGB (ADR-121) menampilkan SK sebagai daftar. Untuk memeriksa urutan dasar KGB, yaitu SK
KGB terakhir, SK yang terbit sesudahnya (kenaikan pangkat, penyesuaian ijazah, PMK), dan KGB yang sedang dibuat, operator
masih harus membacanya baris demi baris. SK yang datanya belum lengkap atau belum berpindaian juga tidak terlihat sekilas,
dan SK yang belum tercatat atau SK KGB terakhir yang keliru harus dibetulkan di Data Pegawai.

## Keputusan

1. **Linimasa mendatar** menggantikan daftar: satu titik per SK menurut TMT (terlama ke terbaru), titik belah ketupat untuk
   KGB yang sedang dibuat di antara SK sebelum dan sesudah TMT-nya. Tiap titik bertulis jenis (SK KGB, KP, KP (PI), PMK, SK CPNS),
   TMT, dan perannya: *SK KGB terakhir*, *Dasar KGB ini*, *Tergantikan*, atau *Sesudahnya*. Titik yang dipilih membuka dokumen
   SK-nya dan tabel perbandingan dengan isian formulir (ADR-121). Titik KGB ini menjelaskan SK mana yang menjadi dasarnya.
2. **Penanda "!"** pada SK yang nomor, TMT, atau penetapnya belum tercatat, atau yang belum berpindaian, dengan rinciannya di
   atas dokumen, supaya terlihat apa yang perlu disesuaikan.
3. **Penyesuaian dari linimasa**, dengan jendela yang sudah ada (semuanya dirender sebagai saudara modal Input KGB, sebab
   formulirnya sendiri akan menjalar ke formulir Input KGB bila ditaruh di dalamnya):
   - **Betulkan data SK** untuk kenaikan pangkat dan PMK: Ubah data SK (ADR-068, ADR-118).
   - **Betulkan** SK KGB terakhir yang bersumber dari SK dasar Data Pegawai: Ubah SK dasar (ADR-070), termasuk keselarasannya
     dengan KGB, arsip pindaian, dan riwayat bernomor sama.
   - **+ Catat kenaikan pangkat** dan **+ Catat PMK** untuk SK sesudahnya yang belum tercatat.
   Sesudah tersimpan, linimasa dan perhitungan KGB dimuat ulang.
4. **Menjadikan SK mana pun sebagai Atas dasar** (tombol *Jadikan Atas dasar*) mengisi formulir dengan SK itu, dengan
   peringatan bila SK itu bukan yang terbaru menurut aturan ADR-020. Isiannya tetap bisa disunting seperti sebelumnya.
   Saat Buat SK, SK terbaru ditawarkan lagi dengan tombol Kembalikan (ADR-062); pilihan manual tidak disimpan sebagai
   penanda tersendiri, sebab itu butuh kolom baru dan migrasi database.
5. **Memakai SK yang berbeda** dari isian mengganti seluruh isian, termasuk penetap, supaya pejabat SK lama tidak terbawa ke
   SK baru. Memakai SK yang sama hanya melengkapi isian yang kosong.

## Akibat

- Tidak ada perubahan skema, API, atau aturan penentuan Atas dasar. Hak tetap Super Admin dan Tim SDM KGB, dan isian lanjutan
  Ubah data SK tetap hanya untuk Super Admin (ADR-118).
