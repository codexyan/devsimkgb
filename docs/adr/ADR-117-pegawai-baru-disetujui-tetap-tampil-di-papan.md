# ADR-117: Pegawai yang usulannya baru disetujui tetap tampil di kedua papan

Tanggal: 20 Oktober 2026
Status: berlaku. Melengkapi ADR-082 (kartu "Data disetujui" di papan UPT) dan ADR-112/113 (pegawai terdata saat data utama terisi).

## Konteks

Admin UPT Bapas Banjarmasin melaporkan: Kanwil baru menyetujui satu orang lagi, tetapi orang itu tidak tampak di kolom
**Sedang diproses** dasbor Super Admin maupun di kolom **Di Kanwil** papan UPT.

Persetujuan usulan (`setujuiUsulan`) hanya menulis data pegawai dan konfirmasi UPT untuk siklus berjalan; ia tidak membuat
KGB yang sedang diproses. Jadi "disetujui" memang bukan "sedang diproses": pegawai itu baru masuk Sedang diproses setelah
Tim SDM menginput KGB-nya. Yang tampak keliru adalah pegawai yang disetujui lalu hilang dari papan sama sekali. Ini
dibuktikan dengan data lokal (empat pegawai baru disetujui, TMT Okt, Des 2026, Jan, dan Mar 2027):

- TMT di dalam jendela (Okt, Des 2026): tampil di papan UPT (Di Kanwil, kartu "Data disetujui") dan di Kanwil (Perlu diinput).
- TMT di luar jendela (Jan, Mar 2027), yang berarti masa usul KGB-nya belum dibuka: **tidak tampil di kolom mana pun** di
  kedua papan. Papan UPT mensyaratkan `!terkunci` untuk kartu Di Kanwil, dan `/api/dashboard` hanya memuat TMT yang
  masuk pipeline (`batasPipeline`) atau yang sudah punya KGB aktif. Kasus ini sama saja dengan jadwal yang digeser hukuman
  disiplin, yang memajukan TMT KGB berikutnya ke tahun depan.

Pegawai yang jadwalnya belum dibuka memang tidak punya pekerjaan untuk siapa pun, tetapi yang baru menekan Setujui
membutuhkan tanda bahwa persetujuannya tercatat.

## Keputusan

1. **Aturan murni di `lib/baruDisetujui.ts`.** `barusajaDisetujui` menilai waktu persetujuan (`konfirmasiUptAt`, yang
   ditulis persetujuan usulan) dalam `HARI_BARU_DISETUJUI` = 14 hari terakhir. `kartuSetelahAcc` memutuskan kartu Di Kanwil di
   papan UPT: `siap` (jendela dibuka, konfirmasi berlaku: kartu lama, ADR-082), `baru` (baru disetujui tetapi jendela belum
   dibuka), atau tidak ada. KGB yang sudah berjalan dan usulan data yang masih berjalan tetap dipegang kartu lain.
2. **Papan UPT**: pegawai berstatus `baru` mendapat kartu di Di Kanwil berlabel *Data disetujui, KGB belum dibuka*, dengan
   catatan kapan masa usul KGB-nya dibuka. Kartu itu sementara; sesudah dua minggu pegawai menunggu di jadwal (kartu
   pita dan tabel Pegawai Satker tetap menampilkannya), supaya papan tidak penuh oleh pegawai yang jadwalnya masih jauh.
3. **Papan Kanwil**: `/api/dashboard` juga memuat pegawai yang baru disetujui walau TMT-nya belum masuk pipeline, kecuali yang
   usulan pegawai barunya belum ditinjau (ADR-112). Mereka tampil di kolom **Belum dibuka** (tab Semua) dan pada kartu
   Pekerjaan per satker ("TMT Jan 2027, 1 belum dibuka"). Tidak ada kolom, tombol, atau komponen baru.
4. **Panduan UPT** menjelaskan kartu itu dan menegaskan bahwa disetujui belum berarti Sedang diproses.

## Akibat dan batasan yang disengaja

- Hanya tampilan dan pemuatan daftar; tidak ada skema, migrasi, atau penulisan baru.
- Angka kartu satker di dasbor Kanwil bertambah selama dua minggu untuk bulan TMT pegawai itu, dan kembali sesudahnya sampai
  jendelanya dibuka. Kartu satker dan papan memakai daftar yang sama, jadi keduanya tetap cocok.
- Penentu "baru disetujui" adalah konfirmasi UPT, bukan riwayat usulan, karena itu yang dibaca kedua sisi tanpa kueri
  tambahan dan ditulis oleh setiap jalur persetujuan.
- Penyebab pasti laporan pengguna tidak dapat diperiksa dari sini (data produksi). Bila pegawainya ternyata berada di
  jendela input tetapi masih tidak tampak, datanya perlu diperiksa: statusnya `aktif`, TMT KGB berikutnya, dan usulan
  yang masih berjalan.

## Uji

`lib/baruDisetujui.test.ts`: batas hari (hari ini, kemarin, 14 hari, 15 hari, 60 hari), waktu kosong dan tidak valid,
kartu siap tanpa batas waktu, kartu baru untuk jadwal terkunci (termasuk konfirmasi yang tertinggal karena hukdis), hilangnya
kartu sesudah dua minggu, KGB dan usulan yang berjalan, dan penjaga sumber bahwa kedua papan memakai aturan yang sama.
Diperiksa di peramban dengan data lokal: keempat pegawai tampak di papan UPT; di Kanwil, yang TMT-nya Jan dan Mar 2027
terhitung di Belum dibuka dan di kartu Pekerjaan per satker.
