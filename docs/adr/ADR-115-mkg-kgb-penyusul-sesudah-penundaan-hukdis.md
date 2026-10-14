# ADR-115: MKG pada KGB penyusul sesudah penundaan hukdis bertambah sebesar bulan yang berlalu

Tanggal: 14 Oktober 2026
Status: berlaku. Melengkapi ADR-080 (periode KGB tetap 24 bulan): jadwalnya sudah benar, yang diperbaiki adalah
masa kerja golongan (MKG) pada KGB penyusul dan jalur KGB pertama CPNS yang tertunda.

## Konteks

Pemilik meminta logika hukdis diuji dengan skenario berikut. Siklus KGB setiap 1 April tahun genap. KGB 1 April 2024 MKG
10 tahun, jadwal berikutnya 1 April 2026. Hukdis Sedang pertengahan 2025 menunda KGB 2026 ke 1 April 2027. Syaratnya:
penundaan dihitung penuh sebagai masa kerja, KGB berikutnya kembali ke jalur asal (1 April 2028, bukan 2029), dan MKG pada
tiap SK sejajar dengan masa kerja nyata, tidak ada tahun yang hilang maupun berlebih.

Uji dengan fungsi asli sistem (III/b) menunjukkan:

- **Jadwal sudah benar.** TMT berikutnya 2026-04 menjadi 2027-04 selama penundaan, MKG dan gaji terkunci (TMT KGB terakhir
  tetap 2024-04), KGB tertunda terbit 2027-04, berikutnya 2028-04, lalu 2030-04.
- **MKG pada KGB penyusul berlebih setahun.** `kalkulasiKGB` menambah `max(langkah, bulan berlalu)`. Pada KGB 2028-04 bulan
  yang berlalu sejak 2027-04 hanya 12, tetapi yang ditambahkan 24 (langkah), sehingga MKG tercetak 15 th, bukan 14 th.
  Selisih itu bertambah satu tahun untuk setiap episode penundaan. Pada episode pertama gajinya kebetulan sama (langkah
  tabel yang sama), tetapi sesudah episode kedua gaji melebihi masa kerja nyata (2033-04: Rp 3.959.200, seharusnya
  Rp 3.838.300; 2034-04: Rp 4.083.900, seharusnya Rp 3.959.200). Itu kelebihan bayar, dan MKG di SK tidak sejajar dengan
  masa kerja.
- **KGB pertama CPNS yang tertunda mundur setahun.** CPNS II/a (KGB pertama 12 bulan, lalu 24) yang KGB pertamanya tertunda
  12 bulan jadwalnya 2027-06, tetapi KGB berikutnya jatuh 2029-06; jalur asalnya 2028-06. Sebabnya penundaan diukur dari 24
  bulan, padahal jadwal semula KGB pertama itu 12 bulan. Pegawai kehilangan satu tahun gaji pada langkah yang lebih tinggi.

## Keputusan (pemilik, 14 Oktober 2026)

1. **Masa kerja bertambah sebesar bulan yang benar-benar berlalu sejak TMT KGB terakhir** (`kalkulasiKGB`,
   `lib/tabelGaji.ts`), sebab MKG yang tersimpan adalah keadaan pada TMT itu.
   - Jarak lebih panjang dari jadwal (KGB tertunda): selisihnya dihitung penuh (tidak berubah dari ADR-080).
   - Jarak lebih pendek dari siklus 24 bulan (KGB penyusul sesudah penundaan): hanya bulan yang berlalu yang ditambahkan.
     Contoh: 2027-04 (13 th) ke 2028-04 menambah 12 bulan, jadi 14 th.
   - Langkah awal tabel yang bukan siklus 24 bulan (KGB pertama CPNS, atau golongan yang tabelnya dimulai di masa kerja
     lebih tinggi) tetap menjadi batas bawah, seperti sebelumnya.
2. **Penundaan diukur dari jadwal semula**, yaitu 24 bulan atau langkah awal tabel bila KGB pertama sejak SK CPNS yang
   tertunda. CPNS II/a yang KGB pertamanya tertunda 12 bulan kembali ke 2028-06. Untuk jadwal 24 bulan hitungannya sama
   dengan sebelumnya.
3. **MKG pada SK KGB yang tertunda memakai masa kerja nyata**: pada skenario di atas 13 tahun, bukan 12. Penundaan dihitung
   penuh sebagai masa kerja (tidak ada tahun yang hilang). Pada III/b gajinya sama dengan langkah 12 tahun
   (Rp 3.497.300); pada golongan yang langkah gajinya di tahun ganjil (misalnya I/b) mencetak 12 membuat gaji pegawai lebih
   rendah setahun, karena itu 13 yang dipakai.
4. **Hukdis Berat tetap tidak menunda KGB** (katalog tidak berubah: hanya pemotongan tunjangan kinerja jenis Sedang yang
   menunda 12 bulan), dan **SKP serta status "Ditunda 1 Tahun" tidak dimodelkan**. Penundaan tetap dipicu hukdis yang
   dicatat Kanwil. Keduanya keputusan pemilik pada hari yang sama.

## Akibat dan batasan yang disengaja

- Tidak ada skema, kolom, atau migrasi baru. Hanya perhitungan di `kalkulasiKGB` yang berubah, sehingga placeholder KGB,
  pratinjau di modal Input KGB, dan SK yang diterbitkan memakai angka yang sama (satu fungsi).
- **Placeholder KGB penyusul yang sudah ada tidak dihitung ulang otomatis.** Placeholder yang dibuat sebelum perbaikan ini
  menyimpan MKG lama (satu tahun berlebih) sampai dibuat ulang oleh Kanwil lewat Proses KGB, KGB yang diproses ulang, atau
  perubahan jadwal pegawai. SK yang sudah terbit tidak berubah. Pegawai yang pernah menjalani penundaan hukdis dan sudah punya
  KGB penyusul terbit sebelum perbaikan perlu diperiksa Kanwil (MKG sekarang vs masa kerja nyata).
- KGB yang jaraknya lebih pendek dari 24 bulan karena sebab lain (misalnya TMT diedit tangan lebih awal) kini bertambah
  sebesar jaraknya, bukan 24 bulan penuh. Itu sengaja: MKG mengikuti masa kerja nyata.
- Dasar hukum penundaan di repo mengutip PP 7/1977 Pasal 11 dan 13 serta PP 94/2021 Pasal 42 yang merujuk PP 53/2010
  Pasal 7 ayat (3). Pasal 19 PP 7/1977 yang disebut pemilik belum diverifikasi terhadap teks resminya.

## Uji

`lib/tabelGaji.test.ts`: KGB penyusul sesudah penundaan 12 bulan menambah 12 bulan (14 th, bukan 15) dan kembali ke 2030;
penundaan 6 bulan menambah 18 bulan; KGB pertama CPNS II/a yang tertunda 12 dan 6 bulan kembali ke jalurnya (2028-06); hasil
tanpa penundaan tidak berubah (KGB pertama tepat waktu, TMT terakhir tidak terbaca). `lib/jadwalKgb.test.ts`: rantai
lengkap skenario pemilik (terkunci selama penundaan, 2027 MKG 13 gaji langkah 12, 2028 MKG 14, 2030), lalu episode kedua
dengan MKG tiap KGB sama dengan masa kerja nyata. Uji baru gagal pada kode sebelum perbaikan (4 uji).
