# ADR-087: Setiap SK KGB pegawai UPT menunggu review UPT sebelum dicetak dan diunggah TTE

Tanggal: 8 Oktober 2026
Status: berlaku. Mengganti butir 2 ADR-082 ("review hanya bila berbeda dari usulan").

## Konteks

ADR-082 menandai SK yang sama persis dengan usulan UPT yang disetujui (golongan, masa kerja, gaji, TMT, nomor Atas dasar)
sebagai `sesuai`. SK berstatus itu langsung boleh dicetak dan diunggah TTE tanpa dilihat UPT. Akibatnya, sesudah Kanwil
menekan **Buat SK dan minta review UPT**, Super Admin bisa langsung melihat **Cetak SK** dan **Unggah TTE**. Label
tombolnya menjanjikan review, padahal review-nya dilewati.

Hal serupa berlaku untuk SK pegawai UPT yang dibuat sebelum review aktif (status kosong): Cetak dan Unggah TTE tersedia.
Tombol Minta review UPT di sampingnya tidak wajib dipakai.

Pilihan pengguna:
- Selalu tunggu UPT.
- Lewati review tetap ada untuk Super Admin, dengan alasan wajib.

## Keputusan

1. **Setiap SK pegawai UPT menunggu review UPT.** `mintaReviewSk` selalu mencatat `menunggu` dan mengirim lonceng ke
   Admin UPT. Status `sesuai` tidak dibuat lagi.
2. **SK boleh dicetak bersih dan diunggah TTE** (`skBolehDicetak`) hanya bila:
   - tidak wajib review (pegawai Kanwil, atau tabel review belum ada);
   - sudah **disetujui** UPT;
   - atau **dilewati** Super Admin dengan alasan.

   Selain itu tombol Cetak dan Unggah TTE tidak tampil, unduhan bertanda air DRAF, dan route upload-sk menolak.
3. **Review lama berstatus `sesuai`** dibaca sebagai `menunggu` saat dimuat (`normalReviewSk`, di `muatReviewSk` dan
   `muatSemuaReviewSk`), tanpa mengubah data. SK itu masuk kolom Periksa SK UPT dan dapat ditanggapi seperti biasa.
4. **SK lama tanpa permintaan review** (status kosong) ikut tertahan. Kanwil memilih **Minta review UPT**, atau Super Admin
   memilih **Lewati review**. Pesan tolak Unggah TTE menyebut langkah itu.
5. **Perbandingan dengan usulan tetap dipakai sebagai keterangan bagi UPT**: jendela Periksa SK menulis "sama dengan
   usulan Anda" bila semuanya cocok, atau daftar bedanya bila tidak.

## Akibat

- Bolak-balik bertambah satu langkah untuk SK yang sama dengan usulan. Gantinya, setiap SK pegawai UPT pernah dilihat
  UPT sebelum ditandatangani.
- SK yang saat ini sudah tercatat `sesuai` tetapi belum diunggah TTE berpindah ke Periksa SK UPT. Loncengnya tidak
  dikirim ulang, karena permintaan aslinya dibuat tanpa lonceng; kartunya tampil di kolom Periksa SK.
- Tidak ada migrasi.
