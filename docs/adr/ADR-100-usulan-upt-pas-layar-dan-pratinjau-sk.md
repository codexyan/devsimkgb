# ADR-100: Halaman Usulan UPT pas satu layar di laptop; pratinjau SK tetap hanya di sisi UPT

Tanggal: 10 Oktober 2026
Status: berlaku. Melengkapi ADR-099 dan model gulir halaman kerja (ADR-003).

## Konteks

Pengguna melaporkan tombol **Setujui dan terapkan** di detail usulan tidak tampil. Pengguna juga bertanya apakah pratinjau
SK yang diusulkan diperlukan, sebab SK nanti tetap direview Admin UPT di papan.

**Tombol yang tidak tampil.** Model gulir ADR-003 membuat halaman pas satu layar hanya pada layar kerja: lebar minimal
1200 px dan tinggi minimal 720 px. Laptop 1366×768 hanya menyisakan tinggi halaman sekitar 650 px, jadi model itu tidak
aktif. Uji lokal dengan 43 usulan menunggu pada 1366×650 menunjukkan:
- daftar pegawai memanjang sampai 4.125 px;
- kolom detail ikut memanjang setinggi itu;
- tombol Setujui dan terapkan berada di y = 4.351, dan bilah Setujui yang dicentang juga terdorong ke bawah.

Pada 1280×720 dan 1440×900 keduanya tampak.

**Di mana SK dilihat sepanjang alur:**
1. **UPT, saat mengisi usulan:** tombol Pratinjau SK, opsional, bertanda air (ADR-078).
2. **Kanwil, saat meninjau usulan:** tanpa pratinjau. Detail sudah memuat bahan SK:
   - golongan, masa kerja golongan, dan gaji pokok;
   - TMT KGB terakhir dan berikutnya, yang sudah dihitung menurut SK;
   - SK dasar beserta penetapnya, dan SK yang mengubah gaji pokok;
   - catatan pencocokan masa kerja.
3. **Kanwil, saat Buat SK.**
4. **UPT, saat Periksa SK di papan:** wajib (ADR-087).

## Keputusan

Pilihan pengguna: pratinjau di UPT tetap opsional, dan Kanwil tidak diberi pratinjau.

1. **Pratinjau SK tidak ditambahkan di tinjauan Kanwil.**
   - Pratinjau disusun dari data dan rumus yang sama dengan yang sudah tampil di detail, jadi tidak menangkap kesalahan
     baru.
   - Nomor, tanggal, dan penandatangan SK belum ada pada tahap usulan.
   - Menambahkannya berarti satu langkah lagi per pegawai, berlawanan dengan tujuan ADR-099.
   - SK utuh tetap dilihat Kanwil saat Buat SK dan diperiksa UPT di papan.
2. **Pratinjau SK di formulir UPT tetap ada dan tetap opsional.** UPT dapat menemukan kesalahan sebelum mengajukan, yang
   lebih murah daripada memperbaikinya setelah SK dibuat. Pemeriksaan akhir yang wajib tetap Periksa SK.
3. **Halaman Usulan UPT pas satu layar mulai lebar 900 px dan tinggi 560 px**, lebih rendah dari ambang layar kerja.
   - Daftar pegawai dan isi detail bergulir sendiri-sendiri.
   - Kepala detail, Kembalikan ke UPT, Setujui dan terapkan, dan bilah Setujui yang dicentang selalu tampak.
   - Di bawah tinggi 560 px, halaman bergulir biasa, tetapi kisi daftar dan detail dibatasi setinggi layar. Sesudah halaman
     digulir, tombol dan bilah tetap tampak.
   - Aturan ini hanya untuk halaman yang memuat `.usl-kerja`; halaman lain tetap memakai ambang ADR-003.
4. **Bilah saringan** (Perlu dilihat, UPT, dan pencarian) memakai satu baris penuh saat terdorong ke bawah tab. Pada
   1366 px ia tidak lagi pecah menjadi tiga baris.

## Uji

Uji lokal dengan 43 usulan menunggu:

| Ukuran | Hasil |
| --- | --- |
| 1366×650 | daftar 400 px, tombol Setujui di y = 586, bilah di y = 551, keduanya terlihat |
| 1280×720 | keduanya terlihat |
| 1440×900 | keduanya terlihat |
| 1024×600 | keduanya terlihat |
| 1366×520 | kisi 496 px; sesudah halaman digulir, keduanya terlihat |
| 390×844 | tidak berubah, tanpa gulir mendatar |

Hanya tampilan; tidak ada perubahan data, rute, maupun aturan.
