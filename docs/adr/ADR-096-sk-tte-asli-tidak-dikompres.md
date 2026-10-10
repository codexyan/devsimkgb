# ADR-096: SK bertanda tangan disimpan asli; batas 5 MB, pemeriksaan keutuhan TTE, sidik SHA-256, logo kop diperkecil

Tanggal: 10 Oktober 2026
Status: berlaku. Mengubah batas unggah SK pada ADR-037.

## Konteks

Pengguna melaporkan bahwa SK TTE dari Srikandi rusak bila dikompres: QR-nya tidak lagi sah. Pemeriksaan terhadap 38 SK
bertanda tangan di R2 produksi (dibaca di komputer pengelola, lalu dihapus; tanpa nama atau isi) menemukan:

| Diunggah | Batas unggah | SK | Tanda tangan digital |
| --- | --- | --- | --- |
| 28–30 Sep 2026 | 10 MB | 14 | 9 ada, **semuanya utuh** |
| 5 Okt 2026 | 500 KB | 24 | **tidak ada satu pun**; 77–135 KB, 4 tercatat diolah iLovePDF |

Rinciannya:
- TTE Srikandi adalah tanda tangan PAdES (`ETSI.CAdES.detached`). Untuk 9 SK yang memuatnya, sidik SHA-256 bagian yang
  ditandatangani sama dengan `messageDigest` di dalam tanda tangannya.
- Sesudah tanda tangan, BSrE menambahkan data validasi jangka panjang (`/DSS`, `/VRI`: sertifikat, OCSP, CRL) sebesar
  13–500 KB. Karena itu SK TTE asli berukuran 185 KB sampai 1 MB.
- Sejak ADR-037, batas 500 KB dan pesan "perkecil berkasnya" memaksa petugas mengompres. Kompresi menulis ulang PDF dan
  menghapus tanda tangannya.
- Aplikasi sendiri tidak mengubah berkas: unggahan disimpan apa adanya ke R2 dan diunduhkan apa adanya.
- SK buatan aplikasi sudah ±450 KB sebelum ditandatangani, karena logo kop PNG 678×678 berukuran 364 KB.

Basis data tidak terbebani oleh ukuran berkas. Isi SK mengalir dari peramban ke Worker lalu ke R2; D1 hanya menyimpan
jalur, ukuran, dan sidik. R2 tidak memungut biaya egress. Redis tidak diperlukan: Redis adalah cache di memori untuk data
kecil, bukan penyimpanan berkas, dan tidak menjaga keaslian isi.

## Keputusan

Pilihan pengguna:
- batas 5 MB;
- TTE rusak ditolak, dan tanpa TTE ditanyakan;
- SK lama dibiarkan;
- logo diperkecil.

1. **Batas khusus SK bertanda tangan 5 MB** (`BATAS_UNGGAH_SK_BYTE`). Unggahan lain tetap 500 KB. Pesannya tidak lagi
   menyarankan memperkecil berkas.
2. **Pemeriksaan keutuhan TTE** (`lib/tteSk.ts`, tanpa pustaka; Worker dan peramban):
   - setiap `/ByteRange` dibaca, lalu sidik bagian yang ditandatangani dicocokkan dengan `messageDigest` pertama di CMS
     `/Contents` (SHA-256, SHA-384, atau SHA-512);
   - stempel waktu dokumen (`ETSI.RFC3161`) dilewati;
   - hasilnya `utuh`, `rusak`, `tanpa`, atau `takTerperiksa`.

   Yang diperiksa keutuhan isi, bukan keabsahan sertifikat; keabsahan tetap lewat verifikasi BSrE atau pindai QR.
3. **Aturan unggah** (server menentukan, peramban menampilkan lebih dulu):
   - `rusak` ditolak;
   - `tanpa` diterima hanya bila petugas mencentang "Ini pindaian SK bertanda tangan basah";
   - `utuh` dan `takTerperiksa` diterima.

   Aturan ini berlaku di jendela Unggah SK dan Arsip KGB.
4. **Berkas disimpan byte demi byte**, beserta bukti keasliannya:
   - R2 menerima isi yang sama, dengan `sha256` agar R2 menolak berkas yang rusak di perjalanan;
   - `surat_kgb` mencatat `sha256_berkas`, `ukuran_berkas`, dan `status_ttd` (`tte`, `tte_tak_terperiksa`, `basah`);
     D1 `0005_sk_sidik_ttd.sql` membuat ulang trigger jejaknya, dan ada migrasi Supabase yang sejalan;
   - unduhan diberi `Cache-Control: private, no-store, no-transform`.
5. **Label** "TTE utuh" atau "Tanda tangan basah" tampil di detail Proses KGB dan kartu SK terbit Admin UPT.
6. **Logo kop** diperkecil ke 300 px dengan palet 256 warna: 364 KB menjadi 28 KB, tanpa beda kasatmata. Ukuran SK berubah:
   - versi Srikandi: ±451 KB menjadi 192 KB;
   - SK biasa: ±450 KB menjadi 93 KB.
7. SK yang sudah tersimpan tidak diperiksa ulang; kolom barunya kosong.

## Uji

- Pada 38 SK produksi (di komputer pengelola), `periksaTte` membaca 9 utuh dan 29 tanpa TTE. Satu bit yang diubah pada
  salinan terbaca rusak. Waktunya paling lama 46 ms per berkas 1 MB.
- Uji unit dengan PDF bertanda tangan sintetis: utuh (SHA-256, SHA-384), revisi `/DSS` tetap utuh, satu bit berubah
  terbaca rusak, tanpa tanda tangan, stempel waktu dokumen dilewati, dan bentuk yang tidak dikenali.
- Uji di peramban lokal:
  - TTE rusak menampilkan catatan merah dan tombol Unggah nonaktif;
  - tanpa TTE menampilkan kotak centang; setelah dicentang, unggahan tercatat `basah`;
  - TTE utuh tercatat `tte`;
  - server menolak kiriman langsung yang melanggar aturan;
  - berkas yang diunduh kembali sama persis (SHA-256) dengan aslinya.

## Akibat

- Migrasi D1 0005 harus diterapkan **sebelum** kode dirilis; tanpa kolom itu, unggah SK gagal.
- 24 SK yang diunggah 5 Oktober tetap tanpa tanda tangan digital. Mengganti dengan berkas asli dari Srikandi dapat
  dilakukan kapan saja lewat Unggah SK bertanda tangan.
