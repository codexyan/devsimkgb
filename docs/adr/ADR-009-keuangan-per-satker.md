# ADR-009: Keuangan Kanwil hanya memegang pegawai Kanwil; UPT menyelesaikan KGB pegawainya sendiri

Tanggal: 26 September 2026
Status: berlaku, menggantikan pembagian tugas keuangan pada ADR-007 bagian 3

## Konteks

ADR-007 menetapkan bahwa keuangan Kanwil memeriksa SK pegawai Kanwil dan pegawai UPT, sedangkan UPT hanya
merekamnya di Gaji Web setelah Kanwil mengonfirmasi. Pemilik meluruskannya: keuangan Kanwil hanya
menindaklanjuti KGB pegawai Kanwil di Gaji Web. Setiap UPT punya bagian keuangan dan akun Gaji Web sendiri,
dan mulai bekerja begitu SK bertanda tangan diunggah Tim SDM Kanwil atau Super Admin.

Akibat aturan lama yang terbaca di kode:

- antrian, notifikasi, rekap, dan CSV dasar Gaji Web keuangan Kanwil memuat pegawai dari 18 satker;
- UPT baru dapat mengunduh SK setelah keuangan Kanwil mengonfirmasi, padahal UPT-lah yang merekamnya;
- rapelan pegawai UPT dan pembaruan data gajinya bergantung pada keuangan Kanwil.

## Keputusan

1. **Pembagian menurut satker pegawai** (`dipegangKeuanganKanwil`, lib/aksesUpt.ts). Unit kerja kosong atau
   Kanwil berarti pegawai Kanwil. Unit kerja yang tidak dikenali juga ikut Kanwil agar tidak ada KGB yang
   terlantar. Selain itu pegawainya dipegang UPT satkernya.
2. **Satu penyelesaian untuk dua pihak** (`selesaikanKgb`, lib/selesaikanKgb.ts). Penyelesaian mencakup
   pemeriksaan ulang hukdis dan status aktif, pembaruan gaji pokok dan masa kerja, jadwal siklus berikutnya,
   rapelan, dan status Selesai. Keuangan Kanwil menjalankannya lewat `POST /api/kgb/[id]/konfirmasi-keuangan`,
   yang kini menolak pegawai UPT. Keuangan UPT, lewat akun Admin UPT tanpa peran baru, menjalankannya lewat
   `POST /api/upt/gaji-web`: menetapkan rapelan dan menandai sudah direkam di Gaji Web dalam satu langkah.
3. **UPT mulai begitu SK diunggah.** SK berstatus menunggu keuangan sudah boleh diunduh UPT dan tampil di
   kolom SK terbit. Notifikasinya dikirim langsung dari rute unggah SK: keuangan Kanwil untuk pegawai Kanwil,
   UPT untuk pegawai UPT.
4. **Modul Keuangan Kanwil dibatasi.** Modul ini hanya memuat pegawai Kanwil: antrian, konfirmasi cepat,
   rekap, riwayat, dasar Gaji Web, statistik beranda, dan tindak lanjut ke SDM. `GET /api/kgb` menerapkan
   batas itu untuk peran Keuangan dan untuk permintaan `lingkup=kanwil`, supaya Super Admin yang membuka modul
   yang sama melihat hal yang sama.
5. **Kanwil hanya memantau UPT.** Panel *SK UPT belum direkam* pada dashboard Keuangan dan SDM, dari
   `GET /api/keuangan/gaji-web-upt`, menampilkan per satker jumlah SK yang menunggu dan lama menunggu
   terlama. Panel ini tidak punya tombol yang mengubah data.
6. **Pegawai Kanwil tidak diberi penanda Gaji Web terpisah.** Konfirmasi keuangan Kanwil berarti sudah
   direkam.

## Akibat

- Tidak ada kolom atau migrasi baru. Waktu unggah SK dibaca dari key berkasnya (`sk/<nip>_<ms>.pdf`).
- SK pegawai UPT yang sedang menunggu keuangan Kanwil saat aturan ini berlaku otomatis berpindah ke UPT-nya.
  SK yang telanjur dikonfirmasi Kanwil tetapi belum direkam cukup ditandai UPT, tanpa keputusan rapelan
  baru; pemantauan hanya memuat yang dikonfirmasi dalam 60 hari terakhir.
- Konfirmasi UPT dicatat di audit sebagai `rekam_gaji_web_upt` beserta keputusan rapelannya.
- `konfirmasiKeuanganBy` berisi id pengguna UPT untuk pegawai UPT.
