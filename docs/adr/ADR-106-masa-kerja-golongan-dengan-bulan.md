# ADR-106: Masa kerja golongan dicatat dengan tahun dan bulan sesuai SK

Tanggal: 12 Oktober 2026
Status: berlaku. Mengubah cara memilih masa kerja di ADR-040 (Koreksi dasar gaji).

## Konteks

Pengguna melaporkan: pada **Ubah dasar KGB** di Super Admin, bulan masa kerja golongan tidak dapat dipilih, sehingga
selalu 0 bulan. Padahal SK dapat menulis masa kerja dengan bulan, misalnya 8 tahun 4 bulan, sedangkan hitungan nominal
gajinya tetap.

Pemeriksaan kodenya:

1. Isian masa kerja pada Koreksi dasar gaji (`ModalUbahPegawai`) adalah satu daftar pilihan dari `getMKGOptions`, yaitu
   **langkah tabel gaji** saja (0, 2, 4, … tahun; II/a 0, 1, 3, … tahun), semuanya 0 bulan. Bulan tidak dapat dipilih,
   dan tahun di antara dua langkah (mis. III/a 9 tahun) juga tidak.
2. `gajiPokokUntuk` hanya menerima langkah yang persis ada di tabel. Uji ADR-040 bahkan menyatakan "masa kerja dengan
   sisa bulan ganjil tidak ada di tabel; jangan ditebak".
3. Server sudah menerima bulan 0 sampai 11 (`bacaMkg`) dan menghitung gaji pokok dengan `getGajiPokok`: langkah tertinggi
   yang tidak melebihi masa kerja. Jadwal KGB berikutnya (`bulanKeKgbBerikutnya`) tetap 24 bulan sesudah langkah pertama.
   Jadi yang menolak bulan hanya tampilannya.
4. Formulir Tambah pegawai di Data Pegawai (Kanwil) memakai daftar langkah yang sama dan mengalami keterbatasan serupa.

## Keputusan

1. **Masa kerja golongan dipilih dalam dua isian: tahun dan bulan (0 sampai 11)**, di Koreksi dasar gaji dan di formulir
   Data Pegawai. Pilihan tahun mencakup tahun di antara langkah tabel.
2. **Gaji pokok tetap mengikuti langkah tabel PP 5/2024 di bawahnya.** 8 tahun 4 bulan bergaji sama dengan 8 tahun
   0 bulan. Ini sama dengan hitungan server (`getGajiPokok`), jadi tidak ada perubahan nominal maupun jadwal KGB.
3. **Rentang yang dapat dipilih** (`rentangMkg`, `lib/koreksiDasarGaji.ts`, diuji): dari langkah pertama tabel golongan
   itu sampai sebelum satu siklus KGB (24 bulan) sesudah langkah terakhir. Di bawah langkah pertama (mis. II/c di bawah
   3 tahun) tidak ada gaji pokok. Nilai tersimpan di luar rentang tetap ditampilkan apa adanya.
4. **Mengganti golongan mempertahankan tahun dan bulan** selama masih dalam rentang golongan baru. Bila tidak, masa kerja
   digeser ke langkah terdekat dan layar menyatakannya, seperti sebelumnya.
5. Pada Koreksi dasar gaji, pilihan tahun tidak lagi memuat nominal gaji karena kolomnya sempit. Gaji pokok hasil
   koreksi tetap tampil di baris **Gaji pokok** (Tercatat → Menjadi). Formulir Data Pegawai tetap menampilkan nominal pada
   pilihan tahun.

## Akibat

- Masa kerja yang tertulis di SK, termasuk bulannya, dapat dicatat tanpa mengubah gaji pokok dan TMT KGB berikutnya.
- Uji `gajiPokokUntuk` dari ADR-040 untuk sisa bulan diganti: kini menghasilkan gaji langkah di bawahnya, bukan null.
- Tidak ada perubahan skema, API, maupun data tersimpan.
