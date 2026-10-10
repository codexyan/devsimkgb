# ADR-098: Modul inventarisasi dihapus; berkas kiriman disalin ke arsip pegawai dulu, data R2 disimpan

Tanggal: 10 Oktober 2026
Status: berlaku, tahap 1 (salin semua) dan tahap 2 (hapus modul). Menjalankan rencana ADR-027.

## Konteks

Pengguna menyatakan modul inventarisasi sudah tidak dibutuhkan dan meminta modul itu dihapus dengan sangat hati-hati.
Data modul tidak ada di basis data, hanya di R2 dengan awalan `inventaris/`. Isinya di produksi per 10 Oktober 2026:

- **127 objek (22,5 MB)**: kiriman **42 pegawai** dari kegiatan "kanwil", berisi **84 berkas** SK.
- **44 berkas** sudah disalin ke arsip dokumen **22 pegawai** (awalan `dokumen/`). Salinan itu milik modul pegawai dan
  tetap ada setelah modul dihapus.
- **40 berkas** milik **20 pegawai** belum pernah disalin: SK CPNS 11, SK PNS 11, SK KGB terakhir 9, SK KP terakhir 9.

## Keputusan

Pilihan pengguna: salin semua ke arsip dulu, dan biarkan data R2 untuk dihapus nanti.

1. **Tahap 1: salin semua.**
   - Tombol **Salin semua ke arsip pegawai** di halaman Inventarisasi, khusus Super Admin
     (`POST /api/inventarisasi/arsip { semua: true }`).
   - Memakai `salinBerkasKeArsip` yang sama dengan tombol per berkas. Berkas yang sudah tersalin dilewati, jadi menjalankan
     ulang aman.
   - Kiriman dari NIP yang belum terdaftar di Data Pegawai dilaporkan namanya.
   - Hasilnya tercatat di Log Aktivitas.
2. **Tahap 2: hapus modul**, dirilis setelah penyalinan di produksi diperiksa: tidak ada berkas kiriman yang belum
   tersalin, kecuali milik NIP yang belum terdaftar. Yang dihapus mengikuti daftar ADR-027:
   - titik `JEJAK-INVENTARISASI`:
     - penanda "Pemutakhiran" di daftar Data Pegawai;
     - bagian "Kiriman formulir inventarisasi" dan saringan "Formulir" di tab Dokumen pegawai;
     - sumber dokumen `inventaris` di `GET /api/pegawai/[id]/dokumen`;
     - menu Inventarisasi KGB;
     - pembatas `/api/public/inventarisasi` di `worker-entry.js`;
   - halaman `/inventarisasi-kgb` dan `/dashboard/inventarisasi`;
   - rute `/api/inventarisasi/*`, `/api/public/inventarisasi`, dan `/api/pegawai/[id]/pemutakhiran`;
   - pustaka `inventarisKgb`, `inventarisServer`, `inventarisArsip`, `kegiatanInventaris`, `pemutakhiranPegawai` beserta
     24 ujinya;
   - aturan CSS modul (`inv-*`, `pmh-*`) yang tidak dipakai lagi;
   - skrip Google Form dan `docs/inventarisasi-kgb/`.

   Yang tetap:
   - salinan di arsip pegawai, yang tampil sebagai "Arsip dokumen" dengan keterangan "Dari kiriman …" dan dibuka lewat
     rute dokumen pegawai, bukan rute modul;
   - Durable Object pembatas, yang dipakai cek KGB (instance `global`; instance `inventarisasi` tidak dipanggil lagi);
   - kelas `inv-atur`, `inv-bidang`, `inv-bantu`, `inv-lebar` (modal Ubah data pegawai) serta `pmh-galat` dan
     `pmh-bidang`.
3. **Data R2 `inventaris/` tidak disentuh.** Data itu tidak lagi terlihat di aplikasi, dapat dipulihkan bila perlu, dan
   dapat dihapus belakangan atas keputusan pengguna. ADR ini dan ADR terdahulu tetap disimpan sebagai riwayat keputusan.

## Akibat

- Setelah tahap 1, semua berkas kiriman dari pegawai yang terdaftar ada di tab Dokumen pegawainya, dengan keterangan
  "Dari kiriman …".
- Setelah tahap 2, formulir publik `/inventarisasi-kgb` dan menu Inventarisasi KGB tidak ada lagi. Data Pegawai, Usulan
  UPT, dan cek KGB tidak terpengaruh.
- Tidak ada migrasi basis data; modul ini tidak punya tabel.

## Pemeriksaan tahap 1 di produksi

Tahap 1 dirilis 10 Oktober 2026 (versi 85da2d2c). Tombol Salin semua dijalankan pukul 22.35 WITA. Log Aktivitas
mencatat 40 berkas disalin untuk 20 pegawai, 44 sudah ada, dan 0 tidak terbaca.

Pemeriksaan hanya-baca lewat API R2 sesudahnya:
- 84 berkas kiriman dari 42 pegawai, semuanya dirujuk `data.json`, dan tidak ada berkas yatim;
- 84 berkas memiliki penanda asal di arsip pegawai (42 pegawai), dan 0 belum tersalin;
- salinan sama byte demi byte dengan aslinya: ETag dan ukuran cocok untuk 84 berkas, dan tidak ada objek salinan yang
  hilang.

## Uji tahap 2

- tsc bersih. Galat eslint hanya di 14 berkas lama yang tidak disentuh.
- 655 uji lulus: 679 sebelumnya dikurangi 24 uji modul yang dihapus.
- Di server lokal:
  - kedelapan halaman dan rute modul menjawab 404;
  - Data Pegawai tampil, dan menu tanpa Inventarisasi KGB;
  - `GET /api/pegawai/[id]/dokumen` menjawab 200 untuk 49 pegawai, tanpa sumber `inventaris`;
  - salinan kiriman di tab Dokumen terbuka sebagai PDF lewat rute dokumen pegawai;
  - modal Ubah data pegawai tetap bertata letak grid.
