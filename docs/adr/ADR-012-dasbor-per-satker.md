# ADR-012: Dasbor Super Admin dan SDM dipisah per satker, tanpa angka berulang

Tanggal: 27 September 2026
Status: berlaku; menyempurnakan susunan dasbor pada ADR-003

## Konteks

Dasbor Super Admin dan SDM mengulang fakta yang sama di banyak tempat. Contohnya, "lewat batas input"
muncul di dua kartu angka, panel Perlu tindakan, kepala kolom papan, tiap kartu, dan panel Satker & UPT.
Kolom kanan berisi empat panel: Perlu tindakan, KGB per bulan, SK UPT belum direkam, dan Satker & UPT.
Sebagian besar isinya mengulang papan.

Pegawai 18 satker juga bercampur dalam satu antrian tanpa saringan. Padahal pekerjaan Kanwil atas keduanya
berbeda (ADR-009):

- **Pegawai Kanwil** diproses penuh, sampai keuangan Kanwil.
- **Pegawai UPT** diproses sampai SK diunggah. Sesudah itu Kanwil hanya memantau usulan UPT dan rekam
  Gaji Web oleh keuangan UPT.

Kalender 12 ubin hanya menampilkan angka, tanpa jendela input yang justru menentukan kapan harus bekerja.

## Keputusan

1. **Saringan satker di atas antrian.** Pilihannya Semua, Kanwil, UPT, atau satu UPT tertentu,
   masing-masing dengan jumlahnya. Saringan berlaku untuk daftar, papan, dan lini masa.
2. **Kolom papan "Di keuangan" dipecah.**
   - *Keuangan Kanwil* memuat pegawai Kanwil yang menunggu konfirmasi keuangan Kanwil.
   - *Rekam UPT* memuat SK pegawai UPT yang menunggu direkam keuangan UPT.

   Menyeret kartu dari Sedang diproses ke salah satunya tetap membuka Unggah SK TTE.
3. **Kolom kanan tinggal dua panel.**
   - *Perlu tindakan*: lewat batas, batas ≤ 7 hari, usulan UPT menunggu, dan follow up keuangan. Butir
     "TMT bulan X belum dikirim" dihapus karena kini tampil di lini masa.
   - *Pantau satker*: satu baris per satker yang punya pekerjaan, dengan jumlah lewat batas, perlu input,
     diproses, usulan UPT, dan belum direkam beserta lama menunggunya. Kanwil selalu di atas. Klik baris
     menyaring antrian.

   Panel Satker & UPT dan SK UPT belum direkam dilebur ke panel ini. Ringkasan lengkap per satker tetap ada
   di modul Satker & UPT.
4. **Lini masa jendela input menggantikan kalender** (`LiniMasaKgb`). Lini masa mencakup dua bulan TMT ke
   belakang sampai lima ke depan. Tiap bulan menampilkan:
   - jumlah KGB;
   - bilah status bertumpuk (selesai, di keuangan, diproses, belum diinput, lewat batas);
   - rentang jendela input (dibuka sampai batas input SDM);
   - keadaannya hari ini.

   Jendela yang sedang terbuka disorot emas. Klik bulan menyaring antrian.
5. **Kartu angka tidak saling mengulang.** Jumlah lewat batas hanya disebut di kartu Belum diproses. Kartu
   Berpotensi rapelan menyebut keputusan keuangannya. Kartu Dalam proses memisahkan keuangan Kanwil dan
   rekam UPT.

## Akibat

- Tidak ada perubahan data atau API. Satker pegawai dibaca dari unit kerjanya (`kodeSatkerPegawai`), dan
  pembagian keuangan memakai `dipegangKeuanganKanwil`.
- `PemantauanSatker` dihapus. `PanelGajiWebUpt` tetap dipakai dashboard Keuangan.
