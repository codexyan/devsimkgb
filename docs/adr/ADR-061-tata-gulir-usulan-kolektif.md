# ADR-061: Tata gulir Usulan kolektif dan saringan kelengkapan di langkah Lengkapi

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Langkah 2 Usulan kolektif ("Lengkapi data & berkas") memakai susunan daftar di kiri dan detail di kanan (ADR-029),
tetapi seluruh halaman bergulir sebagai satu kesatuan. Dengan 159 pegawai baru hasil Unggah daftar (ADR-060):

- daftar kiri setinggi ±8.000 px menentukan tinggi halaman;
- mengklik pegawai ke-150 membuka detailnya di puncak halaman, jauh di atas layar;
- detail yang panjang menggulir kepala halaman, penanda langkah, dan nama pegawai yang sedang dikerjakan keluar layar.

Langkah 1 (kartu pilih) dan langkah 3 (daftar pada surat) mengalami hal yang sama: saringan, kotak cari, dan isian
surat ikut tergulir hilang.

Pemilik juga menanyakan ke mana isian langkah ini berlari. Jawabannya, yang juga dicatat di sini: isian disimpan
sebagai **draf usulan** (`POST`/`PATCH /api/upt/usulan`), bukan langsung ke Data Pegawai. Draf diajukan bersama satu
surat Srikandi (`/api/upt/usulan/ajukan`). Data Pegawai baru berubah ketika Kanwil menyetujuinya
(`lib/setujuiUsulan.ts`): usulan pegawai baru membuat data pegawainya, dan usulan perbaikan memperbarui data induk
beserta SK dasarnya. Sebelum itu Data Pegawai hanya menandai "di draf, belum diajukan" atau "menunggu tinjauan".

## Keputusan

Model gulir halaman kerja ADR-003 diterapkan ke Usulan kolektif (`data-muat-layar`, panel `dsb-penuh`).

1. **Layar kerja (lebar ≥ 1200 px, tinggi ≥ 720 px): halaman pas satu layar.** Kepala halaman, penanda langkah, dan
   kaki panel diam. Yang bergulir di tiap langkah:
   - langkah 1: kartu pegawai (`.kol-gulir`); saringan dan kotak cari diam, dan kepala kelompok (bulan TMT, pegawai
     baru) beserta "Pilih semua" menempel;
   - langkah 2: daftar kiri dan isi detail, masing-masing sendiri; kotak cari, saringan, dan kepala detail (urutan,
     nama, NIP, ‹ ›) diam;
   - langkah 3: daftar pegawai pada surat, dengan kepala daftarnya menempel; isian surat menempel di sampingnya.
2. **Layar lebar tetapi pendek atau sempit (≥ 1024 px):** halaman bergulir seperti biasa. Daftar kiri langkah 2
   menempel setinggi layar dan bergulir sendiri, kepala detail menempel di atas, kaki menempel di bawah.
   - Tinggi kaki diukur (`ResizeObserver` → `--kol-kaki`), karena kaki menjadi dua baris bila panelnya sempit.
   - Yang menempel merapat ke tepi layar melewati bantalan `<main>` (`--bantal`), dan celah di bawah kaki ditutup
     warna latar. Dengan begitu isi yang tergulir tidak mengintip di sela-selanya.
3. **Di bawah 1024 px** daftar menjadi baris geser di atas detail, dan halaman memakai satu gulir tanpa gulir bersarang.
   Batasnya naik dari 900 px ke 1024 px, sama dengan batas menu samping: di bawahnya menu menjadi tombol melayang di pojok
   kiri atas yang akan menutupi kolom yang menempel.
4. **Pegawai yang dibuka selalu terlihat di daftar kiri**, saat berpindah dengan ‹ ›, kembali dari langkah lain,
   ataupun saat daftarnya disaring dan dicari. Yang digulir hanya daftarnya, dihitung dari bagian yang benar-benar
   tampak (tidak tertutup kaki dan tidak di luar layar).
   - Berpindah pegawai saat halaman sudah tergulir melewati detail menampilkan detail baru dari atasnya.
   - Berpindah langkah memulai halaman dari atas.
5. **Saringan kelengkapan "Semua / Kurang / Lengkap"** di samping kotak cari, bila pegawainya lebih dari delapan.
   - Pegawai yang sedang dibuka tetap tampil walau baru saja lengkap, supaya tidak lenyap selagi disunting; ia lepas
     begitu berpindah.
   - ‹ › mengikuti daftar yang tampil ("Pegawai 2 dari 34 yang tampil").
   - Pencarian tanpa hasil menulis "Tidak ada pegawai yang cocok."
6. Kartu surat langkah 3 menempel dengan `top: 0`, tepat di dalam bantalan wadah gulirnya, sehingga saat diam ia sejajar
   dengan daftar. Sebelumnya `top: 16px` menggesernya 16 px ke bawah.

## Akibat

Diuji di server lokal dengan 47 pegawai terpilih (40 draf pegawai baru fiktif), lewat Chrome tanpa layar:

| Ukuran | Hasil |
|---|---|
| 1920×1000, 1280×720 | Halaman tidak bergulir. Daftar kiri (2.519 px dalam 637 px) dan isi detail bergulir sendiri. Kaki di 922–979. Sesudah 25 kali ›, pegawai ke-26 tetap terlihat di daftar. |
| 1366×657, 1100×800 | Daftar menempel di atas kaki, kepala detail menempel di tepi atas (0 px). Memilih pegawai dari dasar detail mengembalikan detail ke atas. Kaki dua baris di 1100 px tidak menutupi daftar. |
| 1000×800, 390×844 | Daftar menjadi baris geser. Pegawai aktif tetap terlihat sesudah ›, saringan "Kurang", dan pencarian. |

Saringan "Kurang" menyisakan 34 baris (33 belum lengkap ditambah pegawai yang sedang dibuka), "Lengkap" 14, dan
mencari "uji 3" 10 baris.
