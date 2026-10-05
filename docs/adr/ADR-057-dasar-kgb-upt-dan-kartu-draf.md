# ADR-057: Dasar KGB berikutnya membaca SK dasar Data Pegawai, kartu draf, dan tombol pilihan

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Tiga laporan dari pengujian Admin UPT Lapas Banjarmasin:

1. **SK yang sudah dimasukkan tidak muncul sebagai dasar KGB berikutnya.** Kolom *Dasar KGB berikutnya* di Data
   Pegawai UPT hanya membaca tiga sumber:
   - riwayat KGB yang selesai di SIM-KGB;
   - SK kenaikan pangkat;
   - SK PMK.

   Ada dua sumber yang tidak dibaca:
   - SK dasar yang tercatat di Data Pegawai (ADR-010), yang diisi Kanwil lewat *Ubah SK dasar* (berikut
     pindaiannya di arsip pegawai) atau tersalin saat usulan UPT disetujui;
   - SK yang diunggah UPT pada draf atau usulan yang belum disetujui.

   Pegawai yang KGB terakhirnya terjadi di luar SIM-KGB, yaitu hampir semua pegawai pada pendataan pertama,
   karena itu tampil "Belum ada SK tercatat", walau SK-nya sudah direkam.
2. **Pegawai dengan KGB Januari 2028 muncul di Perlu dikerjakan.** Kartu itu draf usulan *data* (perbaikan
   data), bukan usulan KGB. Draf memang selalu masuk Perlu dikerjakan, sebab tugas UPT adalah mengajukannya, dan
   Usulan kolektif sengaja mengizinkan perbaikan data pegawai mana pun. Masalahnya, kartu hanya menulis "TMT Jan
   2028", sehingga terbaca sebagai KGB yang seharusnya masih terkunci.
3. **Tombol Belum pernah KGB / Sudah pernah KGB tidak menunjukkan mana yang aktif.** Latar pilihan aktif memakai
   `var(--kartu)`, variabel milik halaman publik yang tidak didefinisikan di dasbor. Latarnya jadi transparan, dan
   bedanya hanya ketebalan huruf.

## Keputusan

1. **`dasarKgbBerikutnya` menerima SK dasar Data Pegawai**: jenis `kgb`, atau `cpns` bila masa kerja golongan 0
   tahun 0 bulan, dengan TMT sama dengan TMT KGB terakhir.
   - Riwayat KGB selesai tetap didahulukan, kecuali SK dasar data pegawai bertanggal lebih akhir.
   - TMT KGB terakhir pegawai ikut menjadi batas bawah SK kenaikan pangkat dan PMK (sejalan dengan ADR-056).
2. **SK pada usulan yang belum selesai dikirim terpisah** (`skDiUsulan`: status, nomor, tanggal, ada tidaknya
   pindaian). Tampil di bawah kolom Dasar KGB berikutnya, dipisah garis putus-putus, dengan penanda *Di draf, belum
   diajukan*, *Menunggu Kanwil*, atau *Dikembalikan*. SK itu baru menjadi dasar setelah usulannya disetujui.
3. **Kartu draf di Perlu dikerjakan menyebut jenis usulannya** (Perbaikan data / Pegawai baru), bukan TMT. Bila KGB
   pegawainya belum dibuka, kartu menambahkan "KGB Jan 2028 belum dibuka (diusulkan Nov 2027); usulan data ini boleh
   diajukan sekarang". Draf **tidak** dikunci: pendataan dan perbaikan data harus dapat diajukan kapan saja,
   termasuk 160 pegawai baru Lapas Banjarmasin yang KGB-nya tersebar sampai 2028.
4. **Tombol pilihan berbentuk radio** (`.kgbm-pilihan` di modal, `.kol-pilihan` di Usulan kolektif). Pilihan aktif:
   - berlatar `var(--card)` dan berbingkai navy;
   - titik radionya terisi dan hurufnya tebal;
   - terlihat tanpa bergantung pada warna latar saja, dan punya cincin fokus.
5. Halaman Panduan menjelaskan kedua hal di atas.

## Akibat

- Uji lokal Admin UPT:
  - pegawai dengan SK dasar di Data Pegawai menampilkan "SK KGB terakhir · nomor · tanggal";
  - pegawai yang SK-nya baru ada di draf menampilkan "Belum ada SK tercatat" dengan penanda *Di draf, belum
    diajukan* dan nomornya;
  - kartu draf menyebut KGB-nya belum dibuka.
- Dokumen yang hanya diunggah di tab Dokumen (tanpa Ubah SK dasar) tetap arsip, belum SK dasar. Daftar arsip
  dibaca dari R2 per pegawai, terlalu mahal untuk daftar satker di Worker yang dibatasi CPU.
