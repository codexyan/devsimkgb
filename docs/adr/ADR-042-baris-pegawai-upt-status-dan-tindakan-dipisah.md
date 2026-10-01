# ADR-042: Baris pegawai Admin UPT; status dan tindakan dipisah

Tanggal: 30 September 2026
Status: berlaku

## Konteks

Pemilik meminta baris pada Data Pegawai Admin UPT dirapikan, dari label BKO sampai tombol tindakannya.

Kolom terakhir berjudul **"Status di Kanwil"**, tetapi memuat empat hal sekaligus: lencana status,
penanda "KGB ditunda", keterangan konfirmasi atau usulan berjalan, lalu **tiga kendali bertumpuk**,
`.upt-aksi { display: block }` membuat masing-masing turun ke barisnya sendiri.

Yang terukur sebelum perubahan, pada 1440 × 1000 dengan tujuh pegawai:

| | Sebelum |
|---|---|
| Tinggi rata-rata satu baris | ± 130 px |
| Pegawai yang muat satu layar | 5 dari 7 |
| Kendali per baris | 3, semuanya `data-jenis="garis"` |

Empat cacat yang menyertainya:

1. **Kolom status merangkap kolom tindakan.** Judulnya "Status", isinya tombol.
2. **Tidak ada tindakan utama.** Ketiganya bergaya sama, jadi tidak ada yang tampak lebih penting.
3. **Label BKO memakan tiga baris.** Kalimat 90+ karakter di sel selebar 240 px.
4. **Prioritasnya terbalik.** Jabatan dipotong menjadi "Pengelola …", sementara catatan penugasan tampil
   utuh tiga baris. Keterangan tambahan mengalahkan identitas pegawainya sendiri.

Cacat nomor 2 dan 3 baru saja diperparah ADR-041, yang menambahkan tautan ketiga dan satu kalimat panjang.

## Keputusan (pemilik, 30 September 2026)

1. **Kolom Tindakan tersendiri**, berisi satu tombol utama dan satu menu titik tiga. Kolom Status kembali
   berisi status saja.
2. **Gaji pokok menyatu dengan KGB berikutnya.** Keduanya menjawab pertanyaan yang sama, dan kolom
   tersendiri untuknya hanya menambah lebar.
3. **BKO menjadi lencana.** `<span class="dsb-tag" data-nada="kuning">BKO</span>` diikuti nama satkernya;
   kalimat "KGB tetap diusulkan dan direkam satker ini" pindah ke `title` dan ke panduan.

Tambahan yang diputuskan saat mengerjakan, di luar pertanyaan:

4. **Tombol utama hanya pekat bila ada yang menunggu dikerjakan**; draf yang belum diajukan atau usulan
   yang dikembalikan Kanwil. Tujuh tombol pekat berjajar ke bawah berarti tidak ada yang menonjol, dan
   kolomnya berubah menjadi dinding tinta. Baris yang tidak menuntut apa pun memakai tombol bergaris.

### Nama satker tetap resmi lengkap

Pilihan yang diambil pemilik berbunyi "nama satker singkat". Itu **tidak** dijalankan apa adanya, sebab
bertentangan dengan aturan tetap: nama Lapas, Rutan, dan Bapas selalu ditulis resmi lengkap di seluruh
tampilan. Yang dilakukan: nama lengkapnya tetap dicetak, dipotong oleh CSS dengan elipsis bila sel terlalu
sempit, dan nama utuhnya ada di `title`. Pemotongan oleh lebar kolom bukan penyingkatan, yang terbaca
tidak pernah berupa nama yang salah.

## Akibat

Terukur sesudahnya, pada layar dan data yang sama:

| | Sebelum | Sesudah |
|---|---|---|
| Tinggi rata-rata baris | ± 130 px | **78 px** |
| Pegawai yang muat satu layar | 5 | **7 (seluruhnya)** |
| Kendali per baris | 3 | **2** |
| Lebar tabel vs pembungkus | menggulir mendatar | 1174 = 1174, **tanpa gulir** |

- Komponen baru `app/dashboard/components/MenuTindakan.tsx`. Panelnya dirender lewat **portal** dengan
  `position: fixed`, bukan `absolute` di dalam sel: pembungkus tabel memakai `overflow: auto`, sehingga
  panel yang diposisikan di dalamnya akan terpotong. Panel ditutup saat menggulir, bukan diikutkan
  bergulir, sebab panel yang mengambang jauh dari tombolnya lebih membingungkan daripada panel tertutup.
- Panel disembunyikan dengan `opacity`, bukan `visibility: hidden`, selama posisinya diukur. Versi
  pertamanya memakai `visibility`, dan elemen yang tersembunyi **mengabaikan `.focus()` tanpa memberi
  tanda apa pun**, sehingga fokus papan ketik hilang diam-diam setiap kali menu dibuka. Diuji: membuka
  menu memindahkan fokus ke butir pertama, Escape menutupnya dan mengembalikan fokus ke tombol titik
  tiga, dan klik di luar menutup tanpa merebut fokus.
- Menu tidak dirender sama sekali bila tidak ada tindakan yang tersedia, misalnya ketika pegawai itu
  sudah punya laporan mutasi yang sedang berjalan.
- Pada layar sempit tabelnya sudah berubah menjadi kartu; panel menu tetap di dalam layar dan membalik ke
  atas bila ruang di bawahnya kurang.
