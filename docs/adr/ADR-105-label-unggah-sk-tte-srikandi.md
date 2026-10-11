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
   - pesan sesudah Buat SK atau Cetak SK;
   - log aktivitas (`upload_sk`), notifikasi review SK, dan alasan penolakan review SK (`lib/reviewSkUpt.ts`);
   - Panduan.
2. **Jalur tanda tangan basah tetap ada, lewat tombol yang sama.** Pesan sesudah "Cetak untuk tanda tangan basah" kini
   berbunyi: unggah pindaiannya lewat Unggah SK TTE Srikandi dan centang pernyataan tanda tangan basah. Pernyataan itu
   sudah ada di jendela unggah (`PemeriksaanTte`, ADR-096).
3. Teks yang menyebut berkasnya, bukan tombolnya, tidak diubah, misalnya "Tim SDM Kanwil mengunggah SK bertanda tangan"
   dan "pindaian SK bertanda tangan basah". Jendela unggah tetap menyebut kedua bentuk berkas yang diterima.
4. **KGB arsip memakai label "Unggah berkas SK"** (ditetapkan pengguna sesudah butir 1 berlaku). Tombol yang sama muncul
   untuk KGB arsip berstatus Selesai yang belum punya berkas SK, padahal SK lama di arsip bisa saja bertanda tangan basah
   dan tidak berasal dari Srikandi.
   - Label ini dipakai di detail Proses KGB (bila `isArsip`) dan di riwayat pegawai.
   - Pesan sesudah Arsip KGB disimpan tanpa berkas, catatan detail KGB arsip, dan Panduan Arsip KGB ikut menyebutnya.
   - Jendela unggahnya tetap sama.
5. **Log Aktivitas memisahkan unggahan berkas SK arsip dengan label "Unggah berkas SK"** (ditetapkan pengguna sesudah
   butir 4).
   - `POST /api/kgb/[id]/upload-sk` mencatat unggahan untuk KGB arsip sebagai aksi `upload_sk_arsip`; unggahan lain tetap
     `upload_sk`. Ini sejalan dengan Arsip KGB yang sudah punya aksi sendiri (`input_kgb_arsip`).
   - Entri lama tetap tersimpan sebagai `upload_sk`, tetapi detailnya memuat "file SK arsip". `aksiAudit`
     (`lib/aksiAudit.ts`, diuji) membaca entri itu sebagai `upload_sk_arsip`, dan `GET /api/audit-log` memakainya untuk
     saringan jenis aksi, ringkasan per jenis, dan data yang dikirim. Jadi entri lama dan baru tampil dengan label yang
     sama tanpa mengubah satu baris pun di jejak audit.

## Akibat

- Butir 1 sampai 4 hanya mengubah teks antarmuka. Butir 5 menambah satu nilai aksi audit untuk entri baru; tidak ada
  perubahan data lama, izin, atau migrasi.
- Entri log aktivitas lama ikut tampil dengan label baru: unggahan biasa sebagai "Unggah SK TTE Srikandi", unggahan arsip
  sebagai "Unggah berkas SK" (butir 5).
