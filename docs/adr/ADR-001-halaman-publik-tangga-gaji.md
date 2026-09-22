# ADR-001: Bahasa visual dan arsitektur halaman publik "Tangga gaji"

**Status:** Diterima, sebagian digantikan [ADR-002](ADR-002-halaman-publik-jernih.md) (tipografi, three.js, panggung alur)
**Tanggal:** 18 September 2026
**Penentu:** Pemilik SIM-KGB (Tim SDM Kanwil Ditjenpas Kalimantan Selatan)
**Cakupan:** `/kgb`, `/tabel-gaji`, `/panduan`, `/login`

## Konteks

Halaman publik SIM-KGB sebelumnya meniru bahasa visual portal SDM Pas Kalsel: latar abu kebiruan, judul sans tebal, dan lambang IMIPAS dari ribuan partikel three.js yang diadaptasi dari bundel portal. Pemilik menilai hasilnya terlalu mirip portal dan meminta konsep sendiri: tetap three.js, tetap terang, tetapi interaktif, minimalis, dan bergerak halus.

Kendala yang membentuk keputusan:

- Halaman ini dipakai dua kelompok: pegawai yang hanya ingin mengecek status KGB lewat NIP, dan admin UPT atau Tim SDM yang perlu panduan dan aturan. Kecepatan sampai ke kotak NIP tidak boleh dikorbankan demi visual.
- Aplikasi berjalan di Cloudflare Workers lewat OpenNext. Berkas statis dan ukuran bundel klien berpengaruh langsung pada biaya dan waktu muat.
- Sumber angka satu-satunya adalah `lib/tabelGaji.ts` (Lampiran PP Nomor 5 Tahun 2024). Halaman publik tidak boleh menampilkan angka contoh yang dikarang.
- Halaman masuk dibuka petugas setiap hari, sehingga tidak layak membawa beban 3D.

## Keputusan

1. **Motif dan data yang sama.** Identitas halaman publik adalah "anak tangga": gaji pokok naik bertahap setiap KGB. Motif ini diambil dari data aplikasi sendiri, bukan dekorasi: lanskap 3D di beranda, grafik di halaman masuk, penomoran bagian, penanda daftar isi, dan garis kaki halaman semuanya digambar dari `tanggaGaji()`.
2. **three.js hanya di beranda,** dimuat lewat `next/dynamic` (`ssr: false`) setelah halaman tenang (`requestIdleCallback`), dilewati bila `navigator.connection.saveData` aktif. Halaman lain memakai SVG.
3. **Satu draw call untuk 272 balok.** `InstancedBufferGeometry` + `ShaderMaterial` sendiri, dengan atribut per balok (kotak, info, sorotan). Tidak ada `InstancedMesh`, tidak ada pustaka bantu.
4. **Render atas permintaan.** Tidak ada loop yang berjalan terus. Bingkai digambar hanya selama ada yang berubah (tumbuh awal, sorotan berpindah, kamera mengikuti kursor atau gulir), lalu berhenti. Render juga berhenti saat panggung keluar layar.
5. **Kendali formulir sebagai jalur utama.** Pilihan golongan dan masa kerja dipegang `PenjelajahTangga` dan dikendalikan `<select>` serta `<input type="range">`. Lanskap 3D `aria-hidden` dan hanya jalur tambahan (kursor dan sentuh).
6. **Geometri murni dipisah dan diuji.** `tangga/tata.ts` berisi tata letak dan uji potong sinar tanpa impor three.js, sehingga bisa diuji dengan `node --test`.
7. **Tabel gaji menjadi halaman sendiri** (`/tabel-gaji`) sebagai digitalisasi lampiran peraturan, dengan tab per golongan dan pencarian masa kerja.
8. **Tipografi:** judul serif (Newsreader) untuk suara dokumen dinas, teks isi Inter yang sama dengan dashboard. Palet: tinta biru tua dan biru arsip, dengan emas sebagai satu-satunya aksen yang artinya tetap, yaitu "posisi Anda atau sekarang".

## Pilihan yang dipertimbangkan

### A. Lanskap tangga gaji 3D dari tabel resmi (dipilih)

| Dimensi | Penilaian |
|---|---|
| Kerumitan | Sedang: shader sendiri, tetapi tanpa pustaka tambahan |
| Biaya | three.js ±150 KB terkompresi, hanya di beranda dan hanya setelah halaman tenang |
| Kemampuan skala | Tetap satu draw call walau seluruh tabel ditampilkan |
| Keakraban tim | Rendah untuk shader; ditekan dengan memisahkan logika ke `tata.ts` yang diuji |

**Kelebihan:** visual berasal dari data resmi, sehingga sekaligus menjelaskan KGB; berbeda jelas dari portal; bisa dipakai lewat keyboard karena kendalinya formulir biasa.
**Kekurangan:** shader sendiri harus dirawat; ada kode cadangan (SVG) yang menambah jalur uji.

### B. Tumpukan SK 3D yang bergerak mengikuti alur

**Kelebihan:** naratif, dekat dengan pekerjaan sehari-hari.
**Kekurangan:** tidak membawa data; sebagian besar isinya harus dikarang, dan bagian "Perjalanan satu usulan" sudah menceritakan alur itu dengan dokumen datar yang lebih murah.

### C. Heliks siklus dua tahunan

**Kelebihan:** paling tenang dan paling ringan.
**Kekurangan:** abstrak; tidak menjawab pertanyaan yang benar-benar ditanyakan pegawai ("berapa gaji pokok saya setelah KGB").

### D. Tanpa 3D sama sekali

**Kelebihan:** paling ringan dan paling mudah dirawat.
**Kekurangan:** permintaan pemilik menyebut three.js secara khusus; grafik SVG tetap dipertahankan sebagai cadangan sehingga manfaat D sudah didapat pada perangkat tanpa WebGL.

## Analisis pertukaran

- **Berat halaman vs identitas.** three.js hanya masuk di beranda dan hanya setelah idle; sampai ia siap, pengguna sudah melihat grafik SVG dari data yang sama. Kotak NIP tidak menunggu 3D.
- **Shader sendiri vs bahan bawaan three.js.** Bahan bawaan memerlukan lampu dan `InstancedMesh` dengan matriks per balok, dan tidak bisa menganimasikan pertumbuhan per balok tanpa menulis ulang matriks tiap bingkai. Shader sendiri membuat pertumbuhan, sorotan, dan peredupan baris menjadi urusan GPU dengan satu atribut kecil yang diperbarui di CPU.
- **Uji sinar sendiri vs `Raycaster` three.js.** `Raycaster` pada `InstancedMesh` memerlukan matriks per instance. Karena balok sudah dihitung di `tata.ts`, uji slab sendiri lebih ringkas, dapat diuji tanpa browser, dan ikut memperhitungkan balok yang sedang terangkat saat disorot.
- **Emas sebagai aksen.** Emas gagal kontras sebagai teks pada kertas, jadi dipisah menjadi tiga token: `--emas` (teks, 5,45:1), `--emas-garis` (garis dan penanda, 3,21:1), dan `--emas-isi` (bidang di dalam bingkai tinta).

## Konsekuensi

**Menjadi lebih mudah**

- Menambah halaman publik baru: token, kerangka, dan motif sudah terkumpul di `publik.css` dan `kerangka.css`.
- Menjelaskan aturan KGB: lanskap, tabel gaji, dan panduan memakai satu sumber angka.
- Menguji bagian yang rawan: tata letak lanskap dan lookup MKG punya uji sendiri.

**Menjadi lebih sulit**

- Perubahan tabel gaji (misalnya PP gaji baru) sekarang berdampak ke tiga tampilan sekaligus; semuanya lewat `tanggaGaji()`, tetapi tetap perlu diperiksa ulang.
- Shader memerlukan pengetahuan GLSL untuk diubah.

**Perlu ditinjau ulang**

- Ukuran bundel beranda setelah build produksi (`opennextjs-cloudflare build`) belum diukur.
- Bila tabel gaji dipakai di dashboard juga, `tanggaGaji()` sebaiknya pindah ke lapisan data bersama.

## Tindak lanjut

1. [ ] Ukur ukuran bundel dan waktu muat beranda pada build produksi, bandingkan dengan sebelum redesain.
2. [ ] Uji lanskap pada perangkat Android kelas menengah (target utama pegawai UPT), termasuk mode hemat data.
3. [ ] Tinjau ulang keputusan ini bila terbit peraturan gaji pengganti PP 5/2024.
