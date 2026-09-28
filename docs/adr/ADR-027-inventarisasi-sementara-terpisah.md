# ADR-027: Modul inventarisasi sebagai pengumpul data sementara, terpisah dari modul pegawai

Tanggal: 28 September 2026
Status: berlaku; mengubah sebagian ADR-023 dan ADR-024

## Konteks

Modul inventarisasi KGB (ADR-022) hanya sarana sementara untuk mengumpulkan data dan SK pegawai. Data Pegawai
diremajakan secara lengkap lewat modul Data Pegawai. Setelah pendataan selesai, modul inventarisasi akan dihapus.

ADR-023 dan ADR-024 sempat mengaitkan kedua modul:
- isian kiriman dapat diterapkan ke Data Pegawai dari panel Periksa;
- berkas kiriman otomatis disalin ke arsip pegawai saat ditandai sesuai;
- halaman pegawai memuat kiriman formulir.

## Keputusan (pemilik, 28 September 2026)

1. **Ketergantungan satu arah.** Modul inventarisasi boleh membaca Data Pegawai dan memakai API arsip dokumen
   pegawai. Modul pegawai tidak bergantung pada inventarisasi: bila rute inventarisasi gagal atau sudah tidak ada,
   halaman pegawai tetap berfungsi.
2. **Peremajaan data di modul Data Pegawai.** Panel Periksa di inventarisasi hanya rujukan: perbandingan,
   peringatan, berkas, dan catatan pegawai, ditambah tombol *Buka di Data Pegawai*. Menyunting dan menerapkan
   isian dari kiriman serta Catat KP/PMK dari kiriman dihapus. Status tindak lanjut tetap ada sebagai catatan kerja
   modul inventarisasi.
3. **Berkas disalin manual, per berkas.** Tombol *Simpan ke arsip* menyalin satu berkas kiriman menjadi dokumen
   arsip milik pegawai (salinan mandiri di awalan R2 `dokumen/<id pegawai>/`), tercatat di log aktivitas. Tidak ada lagi
   penyalinan otomatis saat status ditandai. Kode penyalinannya ada di sisi inventarisasi (`lib/inventarisArsip.ts`,
   `POST /api/inventarisasi/arsip`). Modul pegawai hanya menyediakan `simpanDokumenArsip` yang umum.
4. **Jejak di modul pegawai dipertahankan selama pendataan berjalan**, karena belum semua pegawai mengirim.
   Jejaknya:
   - penanda status kiriman di daftar Data Pegawai;
   - bagian *Kiriman formulir inventarisasi* di tab pegawai;
   - sumber *Formulir inventarisasi* di daftar dokumen.

   Semuanya ditandai komentar `JEJAK-INVENTARISASI (ADR-027)`.

## Menghapus modul inventarisasi

Sebelum menghapus:
- unduh ZIP terakhir tiap kegiatan ke Google Drive;
- salin ke arsip pegawai berkas yang masih dibutuhkan.

Lalu:

1. Cari `JEJAK-INVENTARISASI` dan hapus tiap bagian yang ditandai:
   - `app/dashboard/pegawai/page.tsx`: penanda status di daftar;
   - `app/dashboard/pegawai/[id]/riwayat/TabDokumenPemutakhiran.tsx`: bagian kiriman (tabnya sudah bernama *Dokumen*, ADR-028);
   - `app/api/pegawai/[id]/dokumen/route.ts`: sumber inventaris;
   - `lib/dokumenPegawai.ts`: sumber `inventaris` dan labelnya;
   - `app/api/pegawai/[id]/pemutakhiran/`: seluruh rute;
   - `app/dashboard/components/Sidebar.tsx`: menu *Inventarisasi KGB*;
   - `worker-entry.js`: `PATH_INVENTARIS` dan `layaniInventaris`. Durable Object pembatas tetap dipakai cek KGB.
2. Hapus berkas dan folder modulnya:
   - halaman: `app/(publik)/inventarisasi-kgb/`, `app/dashboard/inventarisasi/`,
     `app/dashboard/components/inventarisasi/`;
   - rute: `app/api/inventarisasi/`, `app/api/public/inventarisasi/`;
   - pustaka: `lib/inventarisKgb.ts`, `lib/inventarisServer.ts`, `lib/inventarisArsip.ts`,
     `lib/kegiatanInventaris.ts`, `lib/pemutakhiranPegawai.ts`, beserta tesnya;
   - dokumen: `docs/inventarisasi-kgb/`.
3. Setelah terpasang, hapus awalan R2 `inventaris/` dari bucket SK. Salinan di arsip pegawai tidak ikut terhapus
   karena letaknya terpisah.

Kolom `asal` pada dokumen arsip boleh tetap ada. Kolom itu hanya penanda salinan dan tidak dibaca modul pegawai.

## Akibat

- Data Pegawai hanya berubah lewat modul Data Pegawai (dan Usulan UPT), sehingga riwayat perubahannya satu jalur.
- Berkas kiriman yang tidak disalin hanya ada di kiriman dan ZIP. Setelah modul dihapus, berkas itu tidak lagi
  ada di SIM-KGB.
