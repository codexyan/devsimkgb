# ADR-108: Kartu papan Kanwil tanpa garis warna di sisi kiri, dan kartu satker dapat diciutkan satu per satu

Tanggal: 12 Oktober 2026
Status: berlaku. Memperluas ADR-103 poin 4 (kartu papan tanpa garis samping) ke papan Kanwil, dan menambah ADR-050
(panel rail dapat diciutkan) dengan kartu satker yang dapat diciutkan.

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

1. **Kartu papan Kanwil tanpa garis warna di sisi kiri.** Aturan garis merah, hijau, kuning, dan ungu pada
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
- Tabel Proses KGB masih memakai garis warna di sisi baris (`.dsb-tabel tbody tr[data-nada]`). Itu bukan papan dan tidak
  disentuh; bila tidak disukai juga, perubahannya terpisah.
- Garis navy pada kartu satker yang sedang dikunci fokusnya (`.ksk-kartu[data-aktif]`) tetap ada. Itu penanda fokus di rail,
  bukan kartu papan.
- Panduan diperbarui: kolom Sedang diproses tidak lagi disebut "garis merah" dan "garis hijau", melainkan label merah
  Perbaiki SK dan label hijau Siap cetak.

## Uji

Tampilan diperiksa di peramban dengan data contoh lokal: kartu papan ber-`data-nada` tanpa `box-shadow`, ciut satu satker
(baris TMT hilang, satker lain tetap terbentang), pilihan bertahan sesudah muat ulang, Ciutkan semua dan Bentangkan semua,
dan kunci fokus dari kepala kartu tetap berfungsi.
