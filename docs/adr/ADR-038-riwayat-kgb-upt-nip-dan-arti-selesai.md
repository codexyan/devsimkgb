# ADR-038: Riwayat KGB untuk Admin UPT, NIP diperiksa susunannya, dan satu arti untuk "Selesai"

Tanggal: 30 September 2026
Status: berlaku

Tiga keputusan yang diambil bersama pemilik pada hari yang sama, dan saling berkaitan: dua di antaranya
memindahkan hal yang sama (jejak usulan yang sudah ditinjau) keluar dari tempat yang keliru.

## 1. Menu Riwayat Admin UPT berisi riwayat KGB

### Konteks

Menu **Riwayat** milik Admin UPT berisi "Riwayat usulan dan laporan": kiriman satker ke Kanwil beserta
hasil tinjauannya. Itu riwayat *aktivitas*, bukan riwayat KGB. Keuangan Kanwil sejak lama punya panel
**Riwayat KGB pegawai** (`app/dashboard/keuangan/riwayat/page.tsx`) yang menjawab pertanyaan yang jauh
lebih sering diajukan di UPT: gaji pegawai ini terakhir naik kapan, dari berapa ke berapa, dan sudah
berapa siklus. UPT tidak punya layar itu sama sekali.

Satu penghalang data ditemukan lebih dulu. Daftar `sk` pada `GET /api/upt` **bukan** riwayat: ia antrian
kerja, disaring `(status === "menunggu_keuangan" || status === "selesai") && !isArsip` lalu dipotong 60
baris. Riwayat yang dibangun dari sana akan kehilangan seluruh siklus **arsip**; SK lama yang direkam
Kanwil sebagai dasar KGB berikutnya, persis seperti kasus NOOR AZMI SYAHBUDIN yang baru dibereskan.

### Keputusan (pemilik, 30 September 2026)

1. Menu **Riwayat** membuka **Riwayat KGB pegawai**, sebangun dengan panel Keuangan Kanwil: satu baris
   per pegawai (KGB terakhir, golongan lama→baru, gaji pokok baru dan lama, status, jumlah siklus), dan
   baris yang dibuka menampilkan seluruh siklusnya.
2. Sumbernya **rute baru** `GET /api/upt/riwayat-kgb`, bukan pelebaran `GET /api/upt`. Dasbor dibuka jauh
   lebih sering daripada riwayat; menumpangkan seluruh siklus setiap pegawai di muatan dasbor hanya
   memperberat permintaan yang paling panas, dan itu bertentangan dengan arah ADR-037.
3. Riwayat memuat **seluruh** siklus, termasuk arsip dan yang dibatalkan. Arsip diberi label "Arsip SK
   lama", bukan "Selesai", sebab ia tidak pernah melewati proses SIM-KGB.
4. Riwayat usulan dan laporan **tetap ada**, pindah ke `/dashboard/upt/riwayat/aktivitas`, dijangkau
   lewat tombol di kanan atas. Menu sidebar tetap enam, sesuai penolakan pemilik atas usulan menambah
   menu ketujuh.

Butir 4 adalah pelengkap yang tidak diminta secara eksplisit namun diperlukan: bersama keputusan nomor 3
di bawah, hasil tinjauan usulan kehilangan tempat di dasbor *dan* di Riwayat sekaligus. Yang tersisa
hanyalah notifikasi, dan itu tidak cukup untuk usulan yang **ditolak**; UPT harus dapat membaca ulang
alasannya kapan saja.

### Akibat

- Jalur berkas SK tidak pernah dikirim ke peramban. Tombol SK hanya muncul bila `bolehUnduhSkUpt`
  mengizinkan, dan pengunduhannya tetap lewat `/api/upt/sk/[id]` yang memeriksa izinnya sendiri.
- Rute baru membaca tiga tabel penuh (`pegawai`, `riwayatKGB`, `suratKGB`) seperti rute UPT lain. Pada
  volume sekarang (72 pegawai, 81 riwayat) itu murah; bila kelak tidak, penyaringannya dipindah ke
  basis data.
- Tautan "Pantau hasilnya di Riwayat" pada Usulan kolektif diarahkan ke halaman aktivitas.

## 2. NIP diperiksa susunannya, bukan hanya panjangnya

### Konteks

Operator UPT melaporkan NIP berubah bentuk setelah berkas disunting di Excel. Tangkapan layarnya
menunjukkan sel menampilkan `1,97E+17` dan bilah rumus berisi `197112000000000000`.

Mekanismenya: Excel memperlakukan NIP sebagai angka. Saat berkas **disimpan sebagai CSV**, Excel
menuliskan angka yang *tampil*, sehingga `197112051998031004` tersimpan menjadi angka pembulatan.
Angka aslinya hilang dari berkas dan tidak dapat dikembalikan dengan melebarkan kolom.

Yang membuatnya berbahaya: NIP rusak itu **tetap 18 digit**, sehingga pemeriksaan `/^\d{18}$/` di
`lib/imporUsulanUpt.ts` meloloskannya, dan barisnya tersimpan sebagai **pegawai baru ber-NIP palsu**.
Kesalahan itu tidak menimbulkan pesan apa pun; baru ketahuan jauh belakangan.

### Keputusan (pemilik, 30 September 2026)

Baris dengan NIP rusak **ditolak, dengan pesan yang menerangkan sebabnya**, bukan sekadar "NIP harus 18
digit". `lib/nipPns.ts` memeriksa susunan baku NIP PNS:

```
1971 12 05   1998 03   1   004
└─ lahir ─┘  └ TMT ┘  kel  urut
 yyyymmdd     yyyymm   1/2  001-999
```

Pada NIP yang rusak, tanggal lahirnya `00`, bulan dan tahun TMT-nya `000000`, dan angka jenis kelaminnya
`0`, tiga hal yang tidak mungkin ada. Pemeriksaannya karena itu **membuktikan** kerusakan, tidak menebak.

Dua penanda tambahan dibedakan agar pesannya tepat:

- **`notasiIlmiah`**; isinya masih `1,97E+17`; berarti Excel menuliskannya apa adanya.
- **`presisiHilang`**; 18 digit, susunannya mustahil, *dan* berakhir tiga nol atau lebih. NIP yang sah
  paling banyak berakhir dua nol (nomor urut 100–900; angka jenis kelamin di depannya selalu 1 atau 2,
  dan nomor urut tidak pernah 000), sehingga tiga nol beruntun di ujung pasti sisa pembulatan.

Setiap pesan tolak memuat jalan keluarnya: buka lewat **Data → From Text/CSV** dengan kolom `nip` disetel
**Text**, atau ketik dengan awalan tanda petik satu. Petunjuk yang sama ditampilkan di layar Unggah
daftar **sebelum** berkas dipilih, dan diuraikan di Panduan Admin UPT, termasuk satu hal yang menentukan:
selama berkasnya **belum disimpan**, NIP aslinya masih utuh, jadi tutup tanpa menyimpan.

### Akibat

- Berlaku pada unggahan kolektif UPT (`lib/imporUsulanUpt.ts`). Jalur lain yang masih memakai
  `/^\d{18}$/`; impor Kanwil (`lib/dataPegawai.ts`), formulir usulan, pembuatan akun; sengaja belum
  disentuh agar perubahannya dapat dinilai lebih dulu di jalur yang memang bermasalah.
- Pemeriksaan ini menolak NIP yang *mustahil*, bukan NIP yang *salah orang*. NIP yang tertukar antar
  pegawai tetap lolos, dan itu memang bukan yang dapat dibuktikan dari angkanya saja.
- Batas kewajaran (tahun lahir, tahun TMT, umur minimal saat diangkat) dapat menolak data arsip yang
  sangat lama. Nilainya terkumpul sebagai tetapan bernama di satu berkas agar mudah dilonggarkan.

## 3. "Selesai" pada papan UPT hanya berarti sudah direkam di Gaji Web

### Konteks

Kolom **Selesai** pada papan Alur KGB menerima kartu dari dua sumber: SK yang sudah direkam di Gaji Web
(`skSelesai.filter((sk) => sk.gajiWebAt)`), dan usulan perubahan data yang baru ditinjau Kanwil
(`terkirim.filter((u) => u.status === "disetujui" || u.status === "ditolak")`).

Sumber kedua keliru. Usulan yang disetujui hanya mengubah data pegawai; gajinya belum tentu bergerak.
Dan usulan yang **ditolak** justru belum selesai sama sekali, sehingga kartu merah "ditolak" mendarat di
kolom hijau "Selesai".

### Keputusan (pemilik, 30 September 2026)

"Selesai" berarti satu hal: **KGB-nya sudah direkam di Gaji Web satker oleh Admin UPT**; langkah
terakhir yang memang dipegang UPT. Kartu usulan yang sudah ditinjau dikeluarkan dari papan; tempatnya
notifikasi dan Riwayat usulan dan laporan.

Keterangan kolomnya ikut diluruskan, dari "60 hari terakhir" menjadi "Sudah direkam di Gaji Web", sebab
angka pada kolom itu kini dapat dibaca apa adanya.

### Akibat

- Jumlah pada kolom Selesai turun di satker yang belakangan banyak mengirim usulan perbaikan. Itu
  memang yang dikehendaki: angkanya sekarang menjawab satu pertanyaan, bukan dua.
- Dijaga uji yang membaca sumber `DashboardUpt.tsx` (`lib/papanUpt.test.ts`), sebab aturan semacam ini
  mudah kembali tanpa disadari saat kolom papan ditambah.
