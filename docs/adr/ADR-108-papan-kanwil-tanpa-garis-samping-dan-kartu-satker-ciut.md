# ADR-108: Kartu papan Kanwil tanpa garis warna di sisi kiri, dan kartu satker dapat diciutkan satu per satu

Tanggal: 12 Oktober 2026
Status: **berlaku sebagian.** Keputusan 2 sampai 5 (kartu satker dapat diciutkan) tetap berlaku dan menambah ADR-050
(panel rail dapat diciutkan). **Keputusan 1 (kartu papan tanpa garis warna samping) dibatalkan pada hari yang sama:**
pemilik meminta desain sebelumnya dikembalikan, jadi garis merah, hijau, kuning, dan ungu pada `.dsb-kartu-kgb[data-nada]`
kembali seperti sebelum ADR ini, dan teks Panduan kolom Sedang diproses kembali menyebut garis merah dan hijau. Kartu
papan Admin UPT tetap tanpa garis (ADR-103), karena itu bukan bagian dari permintaan pengembalian.

## Konteks

Pemilik menyampaikan dua hal sesudah kalender KGB masuk ke dasbor Kanwil (ADR-107):

1. **Pekerjaan per satker seharusnya bisa diminimalkan.** Panelnya sudah dapat diciutkan seluruhnya (ADR-050), tetapi
   kartu satker di dalamnya tidak. Dengan belasan UPT yang punya pekerjaan, daftarnya panjang dan hanya bisa digulir;
   yang dibutuhkan adalah memindai nama satker beserta angkanya, lalu membuka satu-dua yang perlu dilihat.
2. **Kartu di papan kerja tidak boleh bergaris warna di sisi kiri**, seperti kartu di kolom Perlu diinput. Ini pola yang
   sama dengan yang sudah ditolak untuk Admin UPT (ADR-103 poin 4), tetapi saat itu kartu peran lain sengaja tidak diubah.

Pemeriksaan kodenya:

- Garis itu datang dari `.dsb-kartu-kgb[data-nada]` (`box-shadow: inset 3px 0 0`) di `dasbor.css`: merah untuk lewat batas,
  hijau untuk SK siap cetak, kuning, dan ungu. Kartu UPT (`upt-kartu`) sudah menimpa aturan itu dengan bayangannya sendiri,
  jadi tidak terpengaruh.
- Keadaan yang sama sudah tertulis di dalam kartu: label (Perbaiki SK, Siap cetak), teks merah "lewat batas N hari", titik
  tanda, dan keterangan di kepala kolom ("5 lewat batas"). Jadi garisnya hanya penguat warna, bukan satu-satunya petunjuk.
- Kartu satker (`PanelKartuSatker`) adalah satu tombol kepala yang mengunci fokus papan, lalu daftar baris TMT. Tidak ada
  cara menyembunyikan baris TMT satu satker.

## Keputusan (pemilik, 12 Oktober 2026)

1. **(Dibatalkan, lihat status di atas.) Kartu papan Kanwil tanpa garis warna di sisi kiri.** Aturan garis merah, hijau, kuning, dan ungu pada
   `.dsb-kartu-kgb[data-nada]` dihapus. Kartu menjadi netral; keadaannya terbaca dari label, teks, dan titik di dalamnya.
   Kartu yang menunggu UPT tetap diredupkan dengan bingkai putus-putus (ADR-089). Tidak ada bingkai berwarna sebagai
   gantinya: itu bisa ditambahkan nanti bila kartu mendesak terasa kurang menonjol.
2. **Setiap kartu satker punya tombol ciut** di kepalanya, di samping tombol kunci fokus. Kartu yang diciutkan tinggal
   kepalanya: nama satker, jumlah pekerjaan, penanda posisi paling mendesak, dan gembok. Baris TMT dan keterangan kaki
   (TMT belum tercatat, usulan menunggu) disembunyikan.
3. **Tombol Ciutkan semua satker / Bentangkan semua satker** di atas daftar, tampil bila ada lebih dari satu kartu.
4. **Pilihan diingat per peramban** sebagai peta kode satker ke boolean (`kgb-satker-ciut` di `localStorage`), seperti
   panel rail (`kgb-panel-ciut`). Satker yang belum pernah disentuh terbentang. Gagalnya penyimpanan (mode privat) hanya
   berarti pilihan tidak diingat.
5. **Mengunci fokus tidak ikut berubah.** Menekan kepala kartu tetap mengunci fokus papan ke satker itu; kartu yang
   diciutkan tetap bertanda aktif bila satker atau salah satu TMT-nya terkunci.

## Akibat

- Tidak ada API, skema, atau data baru; hanya tampilan.
- Kartu papan di dasbor peran lain tidak berubah: Admin UPT sudah tanpa garis (ADR-103), Keuangan dan SDM Hukdis tidak
  memakai kelas ini.
- Garis navy pada kartu satker yang sedang dikunci fokusnya (`.ksk-kartu[data-aktif]`) tetap ada. Itu penanda fokus di rail,
  bukan kartu papan.
- Panduan tidak diubah oleh keputusan yang masih berlaku: ciut per satker tidak disebut di sana, sama seperti ciut panel
  rail (ADR-050).

## Uji

Tampilan diperiksa di peramban dengan data contoh lokal: ciut satu satker
(baris TMT hilang, satker lain tetap terbentang), pilihan bertahan sesudah muat ulang, Ciutkan semua dan Bentangkan semua,
dan kunci fokus dari kepala kartu tetap berfungsi.
