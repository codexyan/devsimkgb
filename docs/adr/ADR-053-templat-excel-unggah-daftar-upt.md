# ADR-053: Templat Excel untuk Unggah daftar UPT, panduan kolom dasarBaru, dan tolak tanggal bulan/hari

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Lapas Banjarmasin mengirim daftar 160 pegawai untuk Unggah daftar dalam bentuk Excel buatan sendiri. Berkas
itu tidak dapat diunggah langsung, dan memperbaikinya menunjukkan empat celah pada jalur CSV dan panduannya:

1. **Templatnya hanya CSV.** Excel membaca NIP 18 angka sebagai bilangan, dan kolom berpilihan (golongan,
   eselon, jenis jabatan, pendidikan, jenis kelamin) diketik bebas: `Eselon III.a`, `S-1`, `L`. Berkas UPT
   akhirnya dibuat di Excel lalu harus dipetakan tangan ke CSV.
2. **CSV yang disimpan ulang Excel berbahasa Inggris terbaca tertukar tanpa peringatan.** Berkas hasil
   perbaikan yang dibuka lalu disimpan Excel berlokal Inggris berubah menjadi berpemisah koma dengan tanggal
   `m/d/yyyy`. Pembacanya membaca `d/m/yyyy`: 101 dari 160 baris tertolak (`12/16/1971`), dan **59 sisanya
   lolos dengan tanggal tertukar** (`4/1/2024` terbaca 4 Januari, padahal 1 April). Sebaris demi sebaris
   tanggal itu sah, jadi tidak ada yang menandainya.
3. **Masa kerja golongan setelah naik dari golongan II ke III/a tidak dijelaskan.** Dua belas pegawai III/a
   ditulis dengan masa kerja ganjil (7, 15, 17) yang sama persis dengan lama kerja sejak CPNS: masa kerja
   golongan II dari SK KGB terakhir yang belum dipotong 5 tahun. Sistem lalu menjadwalkan KGB mereka setahun
   sesudah KGB terakhir (sepuluh tampil terlambat sejak Desember 2025) dengan gaji pokok yang salah. Panduan
   kolom hanya berbunyi "disalin dari SK KGB terakhir".
4. **Enam kolom dasarBaru tidak punya panduan pengisian.** Keterangannya per kolom ada, tetapi tidak ada yang
   menjawab kapan keenamnya diisi, kapan dikosongkan, dan bagaimana kolom golongan pada baris yang sama ditulis.

## Keputusan

1. **Templat utama menjadi Excel (.xlsx)**, ditulis di peramban (`lib/templatUnggahUpt.ts`) dari
   `KOLOM_TEMPLAT_UPT` dan `PANDUAN_DASAR_BARU`, sumber yang sama dengan panduan di layar:
   - lembar *Data Pegawai*: hanya judul kolom; kolom `nip` dan teks lain berformat Text, kolom tanggal
     berformat tanggal, kolom berpilihan berupa daftar pilihan untuk 500 baris; judul diwarnai menurut peran
     (merah wajib, kuning ditagih saat diajukan, abu-abu boleh kosong);
   - lembar *Panduan kolom*, *Panduan dasarBaru*, dan *Contoh* (tiga pegawai rekaan yang lolos pemeriksaan).
   Templat CSV tetap tersedia dan tetap diterima.
2. **Layar Unggah daftar menerima .xlsx.** Berkasnya diurai di peramban (`lib/xlsx.ts`), lembar *Data
   Pegawai* atau lembar pertama, lalu dikirim ke server sebagai baris yang sama dengan hasil PapaParse;
   pemeriksaannya tetap satu, di server. Tanggal Excel dibaca dari nomor serinya, jadi tidak bergantung lokal.
3. **Pembaca/penulis .xlsx ditulis sendiri di atas fflate**, tidak memakai pustaka spreadsheet. Yang
   dibutuhkan hanya teks, angka, tanggal, format kolom, dan daftar pilihan; pustaka lengkap ratusan KB untuk
   peramban. Pembacanya toleran terhadap XML Excel, LibreOffice, dan Google Sheets (teks bersama, teks kaya,
   bacaan fonetik, rumus, sistem tanggal 1904) dan diuji dengan buku kerja buatan tangan. Keduanya dimuat
   dinamis, hanya saat tombol unduh ditekan atau berkas .xlsx dipilih.
4. **Judul kolom dikenali longgar** (`kunciKolomTemplat`): huruf besar-kecil, spasi, tanda bintang, garis
   bawah, dan nama isiannya (`Golongan/ruang`) dipetakan ke kunci templat, untuk CSV maupun .xlsx.
5. **Berkas bertanggal bulan/hari ditolak, bukan dibaca tertukar** (`berkasBertanggalBulanHari`). Bila ada
   tanggal berpemisah dengan angka kedua lebih dari 12 dan tidak satu pun dengan angka pertama lebih dari 12,
   baris bertanggal berpemisah ditolak dengan sebabnya; baris bertanggal `yyyy-mm-dd` tetap terbaca. Syarat
   kedua menjaga berkas hari/bulan yang memuat satu salah ketik agar tidak tertolak seluruhnya.
6. **Panduan kolom diperjelas**: masa kerja golongan adalah masa kerja pada TMT KGB terakhir, dipotong 5 tahun
   bila sesudahnya naik dari golongan II ke III/a (6 tahun dari I ke II/a), sama dengan cara
   `catatKenaikanPangkat` mencatatnya; TMT KGB terakhir tidak diganti TMT kenaikan pangkat.
7. **Panduan dasarBaru per keadaan** (`PANDUAN_DASAR_BARU`, `ATURAN_DASAR_BARU`): pegawai baru, tercatat tanpa
   perubahan golongan, naik pangkat reguler, penyesuaian ijazah, PMK, dan koreksi, masing-masing dengan isian
   keenam kolom dan cara menulis golongan serta masa kerja pada baris yang sama. Tampil di layar Unggah daftar,
   di lembar templat, dan di halaman Panduan (`#kolom-dasar-baru`). Setiap contohnya diuji lolos
   `periksaImporUpt` tanpa kekurangan sebab.
8. Saran NIP (`SARAN_NIP_EXCEL`) kini menyebut templat Excel lebih dulu, lalu cara aman untuk CSV.

## Akibat

- Tiga kesalahan CSV yang paling sering (NIP rusak, tanggal tertukar, isian pilihan yang salah tulis) tidak
  dapat terjadi pada templat Excel. NIP yang telanjur diketik sebagai bilangan di .xlsx tetap tertolak, sebab
  Excel hanya menyimpan 15 angka berarti dan nomor urutnya menjadi 000 (lib/nipPns.ts).
- Berkas CSV simpanan Excel berbahasa Inggris kini tertolak seluruhnya dengan sebab yang jelas, alih-alih
  sebagian tersimpan bertanggal salah.
- Masa kerja golongan ganjil pada golongan III/IV belum diberi peringatan di layar pratinjau; panduannya yang
  menjelaskan. Peringatan otomatis dapat ditambahkan kemudian, sama dengan `peringatanKiriman` inventarisasi.
- Pengujian: `lib/xlsx.test.ts` dan tambahan `lib/imporUsulanUpt.test.ts`; uji asap lokal mengunggah berkas
  Lapas Banjarmasin 160 baris sebagai .xlsx dan CSV, keduanya 160 pegawai baru, 0 ditolak, isi identik.
