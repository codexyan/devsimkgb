# ADR-002: Bahasa visual halaman publik "Jernih"

**Status:** Diterima (menggantikan sebagian ADR-001)
**Tanggal:** 22 September 2026
**Penentu:** Pemilik SIM-KGB (Tim SDM Kanwil Ditjenpas Kalimantan Selatan)
**Cakupan:** `/kgb`, `/tabel-gaji`, `/panduan`, `/login`

## Konteks

Pemilik meminta halaman publik didesain ulang agar lebih elegan, profesional, simpel, bersih, dan minimalis, dengan rujukan clarvos.com: kanvas netral hangat, judul sans besar berbobot ringan dengan huruf rapat, tombol berbentuk pil, kartu putih bersudut lembut, label kecil bernomor, dan ruang kosong yang lapang.

Bahasa "Tangga gaji" dari ADR-001 memakai judul serif, tinta biru tua dengan emas, lanskap three.js di beranda, dan panggung dokumen yang menempel sepanjang tujuh langkah alur. Hasilnya kaya, tetapi berat dan panjang. Bagian alur saja memakan beberapa layar kosong di antara langkahnya, dan lanskap 3D membawa pustaka sekitar 150 KB terkompresi.

## Keputusan

1. **Tipografi.** Judul memakai Inter Tight berbobot 400 dengan tracking negatif. Teks isi tetap Inter, sama dengan dashboard. Newsreader tidak dipakai lagi.
2. **Warna.** Tinta hampir hitam (`#141519`) di atas kanvas `#f5f3ee`, dengan kartu putih. Kuning (`--emas-isi`) tetap satu-satunya aksen, dan artinya tetap "posisi Anda / sekarang": anak tangga yang dipilih, jadwal yang sedang dibuka, sel tabel yang berlaku, dan bagian panduan yang disarankan. Warna status hanya untuk label status.
3. **Bentuk.** Tombol, isian, tab, dan label berbentuk pil. Kartu bersudut 24 sampai 32 px dengan garis rambut. Bayangan hanya untuk kartu yang perlu terangkat (kartu tangga gaji, panel hasil, dialog).
4. **Tanpa 3D.** Lanskap three.js dihapus bersama dependensi `three`. Tangga gaji di beranda menjadi satu kartu dengan grafik batang SVG dari data yang sama (`tanggaGaji()`). Batangnya bisa disorot kursor atau diketuk, sedangkan kendali formulir tetap jalur utama.
5. **Alur menjadi kisi.** Panggung dokumen yang menempel diganti tujuh kartu langkah dan satu kartu ajakan ke panduan (4 × 2 di layar lebar). Rincian surat dan disposisi tetap ada di panduan.
6. **Motif tangga hanya dari data.** Garis tangga dekoratif (`GarisTangga`) dihapus. Motif tangga tersisa di grafik beranda dan ilustrasi halaman masuk, keduanya digambar dari tabel gaji.

## Konsekuensi

- Beranda lebih pendek dan lebih ringan: tidak ada WebGL, tidak ada pustaka 3D, dan tidak ada komponen klien untuk alur.
- Token dan kelas bersama tetap di `publik.css` dengan nama yang sama, ditambah `.pub-eyebrow` dan `.pub-btn-panah`, sehingga halaman lain ikut berubah tanpa mengganti markupnya.
- Butir ADR-001 tentang three.js (keputusan 2 sampai 4, 6) dan judul serif (keputusan 8) tidak berlaku lagi. Butir tentang sumber angka tunggal, kendali formulir sebagai jalur utama, dan tabel gaji sebagai halaman sendiri tetap berlaku.
