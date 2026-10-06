# ADR-071: Dokumen SK otomatis di tiap tab, dan draf perbaikan SK

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Pengguna menyampaikan dua hal.

1. **Pindaian yang sudah diunggah tidak tampil di tab lain.** Pindaian SK sudah diunggah dari kartu Dasar KGB (Ubah SK
   dasar, Catat kenaikan pangkat, Catat PMK), tetapi tab Riwayat KGB, Pangkat & PMK, dan Riwayat Hukdis belum
   menampilkannya. Penyebabnya:
   - Pencocokan dokumen (ADR-066) menuntut jenis dokumen dan nomor SK sama persis. Ubah SK dasar hanya menawarkan jenis
     SK KGB atau SK CPNS. Akibatnya SK kenaikan pangkat yang dipakai sebagai SK dasar tersimpan sebagai "SK KGB", dan
     tidak pernah tampil di riwayat kenaikan pangkat.
   - Pindaian yang diunggah lewat tab Dokumen tanpa nomor tidak pernah tercocokkan.
   - Tab Riwayat Hukdis belum menautkan pindaian apa pun. Pindaian SK hukdis tersimpan pada laporan UPT, yang ditautkan
     ke riwayatnya lewat `riwayatId`.
2. **Perbaiki SK tidak punya tombol simpan draf.** Tombol itu disembunyikan begitu SK pernah dibuat, sehingga perbaikan
   yang belum selesai hilang bila jendela ditutup.

## Keputusan

1. **Pencocokan dokumen dilonggarkan, dengan urutan yang jelas** (`cariDokumenMenurutSk`, dipakai linimasa, Pangkat &
   PMK, Riwayat KGB, dan kartu Dasar KGB):
   1. nomor SK sama dan jenis sama;
   2. nomor SK sama dengan jenis lain, sebab nomor SK sudah cukup menunjuk satu SK. Sumbernya diberi keterangan
      "diunggah sebagai …";
   3. jenis sama, tanpa nomor, dan tanggal SK sama.

   Di antara yang setara, urutannya SK bertanda tangan, arsip Kanwil, lalu berkas usulan UPT yang disetujui.
2. **Tab Riwayat Hukdis** (Super Admin dan Tim SDM Hukdis) menampilkan **Lihat SK**:
   - dari laporan UPT yang menerbitkan hukdis itu (`riwayatId`);
   - bila tidak ada, dari laporan diterima yang bernomor sama.

   `GET /api/hukdis/laporan` menerima `?pegawaiId=` dan menyertakan `riwayatId`. Keputusan lama tetap berlaku: pindaian
   SK hukdis tidak masuk arsip dokumen pegawai dan tidak dibuka Tim SDM KGB. Hukdis yang dicatat langsung, bukan dari
   laporan, belum menyimpan pindaian, dan barisnya menyebutkan hal itu.
3. **Perbaiki SK punya tombol "Simpan draf perbaikan".**
   - Data SK terakhir disimpan seperti biasa.
   - Nomor dan tanggal SK baru yang berbeda dari SK yang tercatat disimpan sebagai draf di KGB-nya. SK yang tercatat
     tetap berlaku sampai Buat dan Unduh SK.
   - Saat dibuka lagi, draf perbaikan termuat dengan catatannya.
   - Draf yang sama dengan SK tercatat dihapus.
   - Draf dibersihkan sendiri saat SK dicatat ulang, karena aturan ini sudah ada sejak ADR-011.

## Akibat

- Pindaian yang diunggah sekali, dari tempat mana pun dan dengan nomor SK yang sama, tampil di semua tab yang memuat SK
  itu.
- Pindaian yang keliru jenisnya tetap terpakai, dan keterangannya membuat kekeliruan itu terlihat. Jenisnya dapat
  dibetulkan dengan mengunggah ulang di tab Dokumen.
