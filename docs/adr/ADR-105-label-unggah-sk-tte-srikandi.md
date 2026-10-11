# ADR-105: Tombol unggah SK bernama "Unggah SK TTE Srikandi"

Tanggal: 11 Oktober 2026
Status: berlaku. Mengubah butir 4 ADR-095 (nama tombol unggah SK).

## Konteks

ADR-095 menamai tombol unggah SK "Unggah SK bertanda tangan", karena jendela unggahnya menerima hasil TTE maupun
pindaian SK bertanda tangan basah. Di kartu Sedang diproses, tombol itu berdampingan dengan "Unduh untuk TTE", jalur
utama sejak ADR-095.

Pengguna menetapkan nama tombol "Unggah SK TTE Srikandi". Dengan nama itu, kedua tombol di kartu menyebut langkah yang
sama: unduh versi Srikandi, tanda tangani dengan TTE di Srikandi, lalu unggah hasilnya.

## Keputusan

1. **"Unggah SK bertanda tangan" menjadi "Unggah SK TTE Srikandi"** di semua tempat yang menyebut tombol itu:
   - kartu dasbor Kanwil, detail dan baris Proses KGB, dan riwayat pegawai;
   - pesan sesudah Buat SK atau Cetak SK, dan pesan Arsip KGB;
   - log aktivitas (`upload_sk`), notifikasi review SK, dan alasan penolakan review SK (`lib/reviewSkUpt.ts`);
   - Panduan.
2. **Jalur tanda tangan basah tetap ada, lewat tombol yang sama.** Pesan sesudah "Cetak untuk tanda tangan basah" kini
   berbunyi: unggah pindaiannya lewat Unggah SK TTE Srikandi dan centang pernyataan tanda tangan basah. Pernyataan itu
   sudah ada di jendela unggah (`PemeriksaanTte`, ADR-096).
3. Teks yang menyebut berkasnya, bukan tombolnya, tidak diubah, misalnya "Tim SDM Kanwil mengunggah SK bertanda tangan"
   dan "pindaian SK bertanda tangan basah". Jendela unggah tetap menyebut kedua bentuk berkas yang diterima.

## Akibat

- Hanya teks antarmuka yang berubah. Tidak ada perubahan data, rute API, izin, atau migrasi.
- Riwayat log aktivitas lama ikut tampil dengan label baru, karena labelnya dibaca dari jenis aksi `upload_sk`.
