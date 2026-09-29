# ADR-032: Panduan dibatasi per peran di sisi server, dan panduan Admin UPT bergambar

Tanggal: 29 September 2026
Status: berlaku

## Konteks

- **Penyaringan panduan hanya kosmetik.** `IsiPanduan` merender seluruh 15 bagian untuk setiap pembaca, dan
  yang tidak relevan hanya disembunyikan CSS (`panduan.css`, `.pg-dasbor[data-peran] .pg-bagian`). Akibatnya
  isi kerja internal Kanwil tetap terkirim ke halaman Admin UPT: terbaca lewat Ctrl+F, sumber halaman, atau
  mode baca peramban.
- **Pemilih peran terbuka untuk semua.** Tombol kelima peran beserta "Semua" ditampilkan kepada siapa pun,
  sehingga Admin UPT cukup menekan "Semua" untuk membaca bagian Kanwil. `?peran=` di URL pun diterima tanpa
  pemeriksaan role, dan tautan ke bagian yang tersembunyi otomatis membuka seluruh panduan.
- **Panduan Admin UPT tidak bergambar.** Isinya prosa padat berisi sebelas butir bernomor tanpa satu pun
  gambar layar. Dua `<figure>` yang ada adalah tiruan surat, bukan layar SIM-KGB. Operator UPT harus
  mencocokkan sendiri kalimat panduan dengan tombol di layarnya.

## Keputusan (pemilik, 29 September 2026)

1. **Peran yang boleh dibaca ditentukan server** (`peranBolehUntukRole`), bukan di peramban:
   - **Super Admin** membaca seluruh peran dan tetap dapat berpindah peran;
   - **Admin UPT, Keuangan, Tim SDM KGB, dan Tim SDM Hukdis** masing-masing hanya membaca panduan perannya
     sendiri.
2. **Bagian di luar itu tidak dirender sama sekali.** Setiap bagian dibungkus komponen `<Bagian>` yang
   menghasilkan `null` bila tertutup bagi akun pembaca. CSS penyembunyi tetap ada, tetapi sekarang hanya
   melayani Super Admin yang berpindah peran tanpa memuat ulang halaman.
3. **Pemilih peran hanya muncul bila akun membaca lebih dari satu peran**, yakni Super Admin saja.
   `?peran=` dijepit ke peran yang terbuka (`pilihanSahUntuk`), dan tautan ke bagian yang tidak ada tidak
   lagi membuka seluruh panduan bagi pembaca berperan tunggal.
4. **Panduan Admin UPT disusun ulang sebagai enam langkah bergambar**, urut dari membuka SIM-KGB sampai SK
   direkam di Gaji Web, masing-masing dengan replika layarnya dan nomor sorotan yang dijelaskan tepat di
   bawah gambar. Bahasanya dibuat lebih lugas: prosa panjang dipecah menjadi langkah, dan aturan yang
   menentukan benar atau tidaknya isian dikumpulkan menjadi satu daftar bernomor.
5. **Gambarnya replika HTML, bukan tangkapan layar PNG** (`app/dashboard/panduan/LayarUpt.tsx`). Alasannya:
   tetap tajam saat dizoom maupun dicetak; ikut mode gelap dan lebar ponsel tanpa berkas kedua; teksnya teks
   sungguhan sehingga dapat dicari dengan Ctrl+F dan dibacakan pembaca layar; dan perubahannya terlihat
   sebagai baris di git diff. Nama menu, tombol, tanda, serta kalimat sistem pada replika ditulis persis sama
   dengan yang tampil di aplikasi.

## Akibat

- Muatan halaman panduan bagi Admin UPT menjadi 9 bagian, bukan 15; bagi Keuangan 7 bagian.
- Pembaca berperan tunggal tidak lagi dapat membaca panduan peran lain. Bila seseorang memang perlu
  membacanya, jalurnya menambah peran pada akunnya, bukan menekan tombol di halaman panduan.
- Bagian **Alur singkat** tetap dibaca semua peran, termasuk Admin UPT. Bagian itu memang menyebut langkah
  Kanwil secara ringkas, dan itu disengaja: UPT perlu tahu ke mana usulannya pergi. Yang ditutup adalah
  bagian rincinya (`kewenangan`, `di-kanwil`, `di-sim-kgb`, `keuangan`, `pengiriman-sk`, `dasar-hukum`).
- Replika layar perlu dirawat bila antarmuka berubah. Karena isinya HTML biasa di satu berkas, perubahannya
  dikerjakan bersama perubahan antarmukanya dan terlihat pada tinjauan kode.
- `app/dashboard/panduan/peran.test.ts` menjaga pembatasannya, termasuk penjaga regresi agar bagian tidak
  kembali dirender sebagai `<section>` yang sekadar disembunyikan CSS.
