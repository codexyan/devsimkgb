# ADR-113: Pegawai baru terdata begitu data utamanya terisi, tanpa menunggu berkas

Tanggal: 13 Oktober 2026
Status: berlaku. Menggantikan butir 1 ADR-112 ("terdata begitu draf lengkap"); butir lain ADR-112 tetap.

## Konteks

Admin UPT tidak dapat melaporkan hukuman disiplin pegawai yang drafnya belum diajukan: formulir Lapor Hukdis hanya
menampilkan pegawai yang sudah terdata. Dengan ADR-112 draf yang lengkap sudah terdata, tetapi "lengkap" memakai ukuran yang
sama dengan saat mengajukan, termasuk semua berkas wajib dan pejabat penetap SK. Pegawai yang berkas pindaiannya belum ada
tetap tidak muncul, padahal hukdis, jadwal KGB, dan proyeksinya tidak bergantung pada berkas itu.

Pemilik meminta draf pegawai yang belum diajukan tetap dapat dikerjakan sisi hukdisnya sehingga jadwalnya dapat diproyeksikan.
Dari tiga jalan yang ditawarkan (laporan hukdis berstatus draf, isian hukdis ringan di formulir, pegawai terdata lebih awal),
pemilik memilih yang ketiga: tidak ada status atau kolom baru, dan hukdis dicatat Kanwil lewat jalur biasa.

## Keputusan (pemilik, 13 Oktober 2026)

1. **Syarat terdata diperlonggar menjadi data utama** (`kekuranganPendataanBaru`, `lib/usulanPegawai.ts`): nama, NIP 18 digit,
   jabatan, golongan, TMT KGB terakhir, masa kerja golongan yang cocok dengan tabel gaji PP 5/2024, dan, bila UPT melaporkan SK
   kenaikan pangkat atau PMK sesudah SK KGB terakhir, SK itu harus dapat dihitung. Hanya itu yang dibutuhkan untuk membentuk
   baris pegawai yang benar (gaji pokok dan jadwal KGB).
2. **Yang tidak lagi menunda terdata:** berkas wajib (SK CPNS, SK KGB terakhir, dan lainnya), pejabat penetap SK, dan jawaban
   atas SK sesudah SK KGB terakhir. Semuanya tetap ditagih saat usulan **diajukan** (`kekuranganUsulan`, yang kini memakai
   `kekuranganDataUsulan` yang sama sebagai bagian awalnya, sehingga dua ukuran itu tidak bisa berbeda arah).
3. **Draf tetap draf.** Pegawainya terdata dan tertaut ke drafnya (ADR-112), usulannya tidak berubah, dan Input KGB tetap
   tertahan sampai usulan pertamanya disetujui. Kanwil melihat label "Data belum ditinjau" seperti sebelumnya.
4. **Unggah daftar ikut.** Baris pegawai baru yang data utamanya terisi langsung terdata sekaligus (satu penulisan massal,
   bukan satu per satu), dan drafnya ditautkan. Bila penulisan pegawai gagal, drafnya tetap tersimpan tanpa tautan dan terdata
   saat disimpan atau diajukan. Hasil unggahan melaporkan berapa pegawai yang langsung terdata.
5. **Hukdis dicatat Kanwil seperti biasa.** Pegawai yang terdata dari draf muncul di formulir Lapor Hukdis, dan SDM Hukdis Kanwil
   mencatat hukumannya lewat jalur yang sama (`catatHukdis`). Penundaan KGB menggeser TMT KGB pegawai itu, dan UPT melihat
   bulan TMT dan penanda "KGB ditunda" yang sudah bergeser (bulan TMT draf di dasbor mengikuti data pegawai bila pegawainya sudah
   ada, dan isian draf hanya dipakai selama pegawainya belum ada).
6. **Jadwal yang sudah digeser hukdis tidak ditimpa.** Saat draf disimpan ulang dan saat Kanwil menyetujui usulan, TMT KGB
   terakhir, TMT KGB berikutnya, dan konfirmasi TMT pegawai tidak ditulis ulang dari hitungan isian draf bila pegawai itu punya
   hukdis yang menunda KGB (`jadwalDigeserHukdis`, `isiPembaruanPegawaiBaru` dengan `jagaJadwal`). Kolom lain tetap
   diperbarui. Tanpa penjagaan ini, simpan ulang draf mengembalikan jadwal ke hitungan semula dan membuang penundaan yang
   sudah dicatat Kanwil.

## Akibat dan batasan yang disengaja

- Lebih banyak pegawai tampil sebagai pegawai biasa (dengan label di Kanwil) sebelum berkasnya ada. Itu sengaja: yang menahan
  proses KGB adalah usulan yang belum disetujui, bukan kelengkapan berkas di draf.
- Pegawai yang terdata dengan berkas belum lengkap tidak dapat diajukan: kartunya di dasbor UPT tetap "Belum lengkap" beserta
  daftar yang kurang, dan server menolak pengajuan sampai lengkap.
- Hukdis yang dicatat pada pegawai yang datanya belum ditinjau tidak mengubah apa pun pada aturan penahanan Input KGB; ia
  hanya menggeser jadwal.
- Bila UPT membetulkan TMT KGB terakhir pada draf **sesudah** hukdis penundaan dicatat, jadwal tidak dihitung ulang otomatis
  (ditahan oleh butir 6). Kanwil membetulkannya lewat Data Pegawai, seperti perubahan jadwal lain pada pegawai yang punya hukdis.
- Tidak ada migrasi basis data dan tidak ada kolom baru.

## Uji

`lib/terdatakanPegawaiBaru.test.ts`: data utama cukup tanpa berkas (dan masing-masing syarat data utama tetap menolak bila
kosong); penundaan hukdis yang dicatat sesudah pegawai terdata tidak ditimpa simpan ulang maupun persetujuan (diuji juga
bahwa pengujinya gagal bila penjagaan dimatikan). Alur nyata, termasuk Unggah daftar dan formulir hukdis, diperiksa di aplikasi
lokal sebagai Admin UPT.
