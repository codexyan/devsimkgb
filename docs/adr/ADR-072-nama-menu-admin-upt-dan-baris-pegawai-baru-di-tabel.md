# ADR-072: Nama menu Admin UPT dan baris pegawai baru di tabel

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Pengguna menyampaikan bahwa nama modul "Data Pegawai" merancukan modul "Usulan kolektif": hasil Unggah daftar ternyata
"masuk" ke Usulan kolektif, padahal pintunya dari Data Pegawai. Penelusuran menemukan empat sumber kerancuan:

1. **Pintu masuk dan tujuan berbeda.** Unggah daftar dan Tambah pegawai ada di Data Pegawai, tetapi hasilnya (draf
   pegawai baru dan draf perbaikan) hidup di Perlu dikerjakan pada Dashboard dan di Usulan kolektif. Tabel Data Pegawai
   hanya memuat pegawai yang sudah tercatat di SIM-KGB, jadi pegawai baru tidak terlihat di sana sampai Kanwil
   menyetujuinya.
2. **Label induk bertabrakan.** Halaman Data Pegawai, Unggah daftar pegawai, dan Usulan kolektif sama-sama bertuliskan
   "Data Pegawai" di atas judulnya, padahal di menu samping Usulan kolektif sejajar dengan Data Pegawai.
3. **Nama menjanjikan data induk.** Di sisi UPT isinya status KGB dan usulan; datanya baru berubah setelah Kanwil
   menyetujui. Kanwil punya menu bernama sama yang benar-benar mengubah data induk.
4. **Dua tempat mengerjakan draf yang sama:** Perlu dikerjakan di Dashboard dan Usulan kolektif. Tidak diubah di sini.

Pengguna memilih dua keputusan di bawah dari pilihan yang diajukan.

## Keputusan

1. **Nama menurut fungsi.**
   - Menu UPT "Data Pegawai" menjadi **Pegawai Satker**, sesuai isinya: daftar pegawai satker beserta status KGB-nya.
   - Menu UPT "Usulan kolektif" menjadi **Usul KGB Kolektif**, sesuai fungsinya: usul KGB banyak pegawai dalam satu surat
     Srikandi (ADR-063).
   - "Data Pegawai" tetap nama menu Kanwil.
   - Label di atas judul halaman mengikuti menunya:
     - Pegawai Satker: halaman daftar pegawai dan halaman Unggah daftar;
     - Usulan ke Kanwil: halaman Usul KGB Kolektif, yang judulnya kini "Usul KGB Kolektif".
   - Judul halaman Pegawai Satker kini nama satkernya, karena labelnya sudah menyebut isinya.
   - Teks Panduan, layar contoh, Pengingat, templat Excel, dan tombol ikut disesuaikan. Nama lembar "Data Pegawai" pada
     templat Excel tidak diubah supaya templat yang sudah diunduh tetap terbaca.
   - Kata "Data Pegawai" pada kalimat tentang data induk (mis. "belum mengubah Data Pegawai") diganti "data pegawai di
     SIM-KGB", supaya tidak terbaca sebagai nama menu.
2. **Pegawai baru yang belum tercatat tampil di tabel Pegawai Satker.**
   - Barisnya muncul untuk pegawai baru berstatus draf, dikembalikan Kanwil, atau menunggu tinjauan, dengan tanda
     **Pegawai baru** dan keterangan "belum di SIM-KGB".
   - Statusnya tampil per baris:
     - **Draf pegawai baru:** menyebut yang masih kurang, atau "Lengkap, siap diajukan di Usul KGB Kolektif".
     - **Dikembalikan Kanwil:** beserta alasannya.
     - **Menunggu tinjauan Kanwil:** beserta nomor suratnya.
   - Tindakannya: Lengkapi atau Ubah draf, Perbaiki usulan, Hapus, dan Batalkan usulan. Semuanya memakai jalur yang
     sama dengan Perlu dikerjakan.
   - Saringan baru **Belum tercatat** memuat barisnya saja. Saringan itu hilang sendiri bersama barisnya.
   - Baris hilang sendiri begitu Kanwil menyetujui dan pegawainya tercatat. Ia berpindah menjadi baris biasa.
   - Memilih dan mengajukan tetap di Usul KGB Kolektif. Layar selesai Unggah daftar menyebut tiga tempat drafnya
     terlihat: Pegawai Satker, Perlu dikerjakan, dan Usul KGB Kolektif.

## Akibat

- Tabel Pegawai Satker memuat semua orang satker: yang tercatat dan yang masih dalam proses. Jumlah di judul tabel
  menghitung keduanya.
- Rute, tautan, dan nama berkas di kode (`/dashboard/upt/pegawai`, `/dashboard/upt/kolektif`, komponen
  `UsulanKolektif`) tidak berubah, sehingga tautan lama tetap berlaku.
- Kerancuan nomor 4 (dua tempat mengerjakan draf yang sama) belum ditangani; bila ingin, pemisahan tugasnya dibahas
  tersendiri.
