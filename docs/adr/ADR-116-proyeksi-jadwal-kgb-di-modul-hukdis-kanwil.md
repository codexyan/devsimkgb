# ADR-116: Proyeksi jadwal KGB juga tampil di modul Hukdis Kanwil

Tanggal: 14 Oktober 2026
Status: berlaku. Melengkapi ADR-114 (proyeksi untuk UPT) dengan sisi peninjau: SDM Hukdis dan Super Admin.

## Konteks

ADR-114 memberi UPT perkiraan pergeseran TMT KGB selama laporan hukdisnya menunggu Kanwil. Sisi peninjau belum punya
padanannya. Pada modul Hukuman Disiplin:

- Panel **Laporan dari UPT** hanya menampilkan data laporan (pegawai, jenis, SK, masa berlaku). Peninjau tidak melihat
  dampak jadwalnya sebelum membuka formulir.
- Formulir **Catat laporan hukdis UPT** hanya berkata "TMT KGB berikutnya akan digeser +N bulan", tanpa tanggal dan tanpa
  memeriksa jadwal pegawai yang sebenarnya. Penolakan baru diketahui sesudah menekan simpan: hukuman yang mulai sesudah TMT
  KGB yang belum diinput, atau pada KGB yang sedang diproses atau menunggu keuangan.
- Dasbor SDM Hukdis hanya menyebut jumlah laporan.

Pemilik meminta modul Hukdis Super Admin dan SDM Hukdis menampilkan proyeksi untuk laporan UPT yang masuk.

## Keputusan (pemilik, 14 Oktober 2026)

1. **Daftar laporan menunggu membawa proyeksi** (`GET /api/hukdis/laporan`, `proyeksi` per laporan, lintas seluruh UPT).
   Hitungannya dari perencana pencatatan yang sama (`rencanaPenundaanHukdis`) dan bawaan katalog jenisnya
   (`lib/proyeksiHukdisServer.ts`). Panel menampilkan salah satu dari: pergeseran TMT KGB (dari, ke, bulan), pergeseran
   siklus sesudah KGB yang sedang berjalan (bila ada), "tidak menunda KGB", atau "belum dapat dicatat" dengan alasan
   penolakan perencana. Berbeda dengan UPT yang hanya melihat kalimat pertama alasan, Kanwil melihat alasan utuh (pada
   atribut judul baris dan di formulir) sebab Kanwil yang harus bertindak.
2. **Formulir Catat memberi perkiraan hidup** dari isian yang sedang diketik (`GET /api/hukdis/proyeksi`): jenis, TMT mulai,
   dampak KGB, dan lama penundaan. Ia dihitung di server terhadap jadwal pegawai dan KGB berjalannya, jadi sama dengan
   hasil saat disimpan, termasuk penolakannya. Perkiraan tampil di blok "Berdampak pada KGB?" saat dampak menyala, dan berlaku
   juga untuk input hukdis langsung tanpa laporan. Tombol simpan tidak dikunci oleh perkiraan "belum dapat dicatat": peninjau
   tetap dapat mematikan dampak KGB, atau menunggu KGB pegawainya selesai.
3. **Linimasa visual perhitungan di formulir Catat.** Pemilik meminta tampilan yang lebih visual dan mencolok untuk memverifikasi
   sebelum mencatat, bukan hanya baris teks. Bila hukumannya menggeser jadwal, formulir menampilkan dua jalur KGB di atas satu
   sumbu waktu berskala (`app/dashboard/hukdis/LinimasaHukdis.tsx`): **Semula** (tanpa hukuman) dan **Sesudah dicatat**. Pita
   kuning di tengah adalah masa hukuman, batang kuning pada jalur bawah adalah penundaannya (+N bulan), dan tiap titik KGB memuat
   bulan TMT, masa kerja golongan (MKG), dan gaji pokok hasil `kalkulasiKGB`, rumus yang sama dengan Input KGB. Titik KGB berikutnya
   dan titik semulanya diberi warna hijau bila jatuh pada TMT dan MKG yang sama (jadwal kembali ke jalur semula, tidak mundur dua
   tahun dari TMT yang baru; ADR-080 dan ADR-115), kuning bila tidak sama. Tiga baris ringkasan di bawahnya memuat angka yang sama
   dalam teks. Pada layar ponsel baris gaji di sumbu disembunyikan agar label tidak bertabrakan; gajinya tetap ada pada ringkasan.
   Perhitungannya di `lib/linimasaHukdis.ts` (murni): dasar hitungnya KGB yang sedang berjalan bila ada, selain itu pegawai dengan
   TMT KGB terakhir yang akan tersimpan. Bila hitungannya tidak mungkin (golongan tidak dikenal, tanggal tidak valid), linimasa
   tidak tampil dan perkiraan teksnya tetap ada.
4. **Satu aturan dampak untuk pencatatan dan perkiraan.** `tentukanDampakIsian` (`lib/proyeksiHukdis.ts`) memutuskan dampak
   final dari isian (yang diketik menang, yang kosong mengikuti katalog, lama tunda 1 sampai 60 bulan). `catatHukdis` memakainya,
   sehingga perkiraan formulir dan hasil pencatatan tidak dapat berbeda. Uji membuktikannya: alasan penolakan perkiraan sama
   dengan galat pencatatan.
5. **Dasbor SDM Hukdis** menambahkan hitungan dari proyeksi pada kartu Perlu tindakan: berapa laporan yang akan menggeser
   jadwal KGB bila dicatat dan berapa yang belum dapat dicatat.
6. **Bentuk JSON proyeksi dipakai bersama** (`jsonProyeksiHukdis`): UPT dan Kanwil membaca bentuk yang sama; `geser`
   membawa `sesudahKgbBerjalan`.

## Akibat dan batasan yang disengaja

- Hanya tampilan: tidak ada penulisan, skema, atau migrasi baru. Data pegawai dan jadwal baru berubah saat Kanwil mencatat.
- Proyeksi daftar memakai bawaan katalog jenis laporan. Bila peninjau mengubah jenis, dampak, atau lama penundaan di formulir,
  yang berlaku adalah perkiraan formulir dan hasil pencatatan.
- Perkiraan dihitung terhadap keadaan sekarang. Bila KGB pegawai berubah sebelum laporan dicatat (diinput, dibatalkan), daftar
  menampilkan perkiraan baru pada muat ulang berikutnya, dan pencatatan tetap menjadi penentu.
- Satu komponen baru, linimasa, atas permintaan pemilik. Ia memakai token warna yang sudah ada (terang dan gelap) dan kelas
  `hkd-lm-*` di `dasbor.css`; panel daftar hanya mendapat baris teks.

## Uji

`lib/linimasaHukdis.test.ts`: skenario pemilik (jalur semula 2026 dan 2028, jalur sesudah dicatat 2027 dan 2028, MKG sejajar masa kerja
nyata), penundaan 6 bulan, CPNS II/a, dasar KGB berjalan, masukan tidak valid tanpa melempar, bentuk JSON.
`lib/proyeksiHukdis.test.ts`: aturan dampak isian (menimpa katalog, bawaan, batas 1 sampai 60 bulan, lama tunda diabaikan bila
tidak menunda); bentuk JSON (tanggal, penanda KGB berjalan, alasan utuh); sisi Kanwil dengan data lokal (laporan menunggu lintas
UPT diproyeksikan dan yang sudah dicatat tidak ikut, perkiraan formulir untuk bawaan, 6 bulan, dampak mati, lama tunda
tak valid, TMT mulai sesudah TMT KGB, tanggal kosong, pegawai tidak ada; hasil `catatHukdis` dengan isian yang sama sama dengan
perkiraan, dan penolakannya bersuara sama). Uji gagal bila lama tunda yang diketik diabaikan. Alur nyata diperiksa di peramban
sebagai SDM Hukdis dan Super Admin: panel (geser, tidak menunda, belum dapat dicatat, lintas UPT), perkiraan hidup di formulir,
dan hasil pencatatan sama dengan perkiraan. Linimasa diperiksa di peramban pada tema terang, tema gelap, dan lebar ponsel.
