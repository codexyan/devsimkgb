# ADR-109: Lewati review UPT baru terbuka sesudah UPT menunggu 24 jam; tombol Buat SK pegawai UPT menyebut review

Tanggal: 12 Oktober 2026
Status: berlaku. Mengubah poin 5 ADR-077 dan baris "Lewati review tetap ada" di ADR-087; sisanya tetap.
Ditambah pada hari yang sama (keputusan 6): penantian 24 jam tidak melewati batas input Kanwil.

## Konteks

Pemilik melihat kolom Sedang diproses di dasbor Super Admin: kartu yang masih menunggu review UPT sudah membawa tombol
Lewati review, dan tombol Perbaiki SK hanya berbunyi "Perbaiki SK". Permintaannya dua:

1. Semua SK harus melalui review UPT lebih dulu. Lewati review baru boleh muncul sesudah batas 1 x 24 jam.
2. Buat SK / Perbaiki SK memakai tombol **Buat SK dan Minta Review UPT** dan tidak mengunduh apa pun, sebab SK itu
   direview UPT lebih dulu.

Pemeriksaan kodenya:

- Tombol Lewati review muncul seketika bagi Super Admin pada setiap kartu yang belum boleh dicetak (`!skBolehDicetak`),
  di dua tempat: papan Dashboard dan modal Detail KGB di halaman Proses KGB. Tidak ada syarat waktu, baik di tombol
  maupun di server (`aksi: "lewati"` hanya memeriksa peran, alasan, dan status). Akibatnya review UPT dapat dilangkahi
  beberapa menit sesudah diminta, dan tombolnya juga muncul untuk SK lama yang belum pernah dimintakan review, yang
  ditolak server.
- Untuk pegawai UPT, modal Buat SK sudah berbunyi "Buat SK dan minta review UPT" dan tidak mengunduh: SK dicatat, review
  diminta, dan unduhan baru tersedia sesudah UPT menyetujui (ADR-077). Yang masih berbunyi "Buat SK" / "Perbaiki SK"
  adalah tombol di kartu, sebelum modalnya dibuka. Pegawai Kanwil tidak punya review UPT, jadi Buat dan Unduh SK tetap
  mengunduh versi Srikandi seperti sebelumnya.
- `dimintaAt` di baris review sudah ada dan diisi ulang tiap review diminta (Buat SK, Perbaiki SK, Minta review UPT),
  jadi acuan jamnya tersedia tanpa kolom baru.

## Keputusan (pemilik, 12 Oktober 2026)

1. **Lewati review terbuka bila UPT sudah menunggu lebih dari 24 jam.** Syaratnya: status *Menunggu review UPT* dan
   `dimintaAt` sedikitnya 24 jam yang lalu. Jam dihitung dari permintaan terakhir, jadi Perbaiki SK memulainya lagi.
   Jam kalender biasa; hari kerja dan libur tidak dihitung.
2. **Saat UPT meminta perbaikan tidak ada Lewati review.** Bolanya di Kanwil; jalurnya Perbaiki SK. SK lama yang belum
   pernah dimintakan review juga tidak dapat dilewati: jalurnya Minta review UPT, lalu menunggu 24 jam.
3. **Server menjaga aturan yang sama.** `lewatiReviewSk` menolak dengan 409 sebelum 24 jam, memuat sisa waktunya, dan
   tidak mengubah apa pun (UPT tetap ditagih). Aturannya satu fungsi murni, `kesempatanLewatiReview`
   (`lib/reviewSkUpt.ts`), dipakai server, papan Dashboard, dan Detail KGB. Alasan wajib, hanya Super Admin, dan catatan
   di Log Aktivitas tidak berubah.
4. **Kartu memberi tahu kapan tombolnya terbuka.** Bagi Super Admin, kartu yang menunggu menambah penanda "Lewati review
   terbuka N jam M menit lagi"; Detail KGB menyebutnya di catatan. Bagi peran lain tidak ada penanda tambahan karena
   mereka memang tidak dapat melewati.
5. **Tombol pegawai UPT menyebut review.** Kartu: **Buat SK dan Minta Review UPT** dan **Perbaiki SK dan Minta Review
   UPT**; tombol kirim di modal: **Buat SK dan Minta Review UPT**. Pesan di modal mengikuti labelnya. Tidak ada unduhan
   otomatis, seperti sebelumnya. Kartu pegawai Kanwil tetap "Buat SK" / "Perbaiki SK" dan modalnya tetap Buat dan Unduh
   SK, sebab tidak ada UPT yang mereview.

6. **Penantian 24 jam hanya sampai batas input Kanwil.** Pemilik menunjuk bahwa menunggu 24 jam bisa menghabiskan masa
   input Kanwil, yaitu akhir bulan, dua bulan sebelum TMT (`deadlineSDM`, mengikuti Pengaturan; di produksi 31). Jadi
   Lewati review terbuka pada `min(diminta + 24 jam, akhir hari batas input)` menurut WITA: selama batas input belum
   lewat, 24 jam berlaku penuh; begitu hari batas itu berakhir, Lewati review langsung terbuka tanpa menunggu sisa
   jamnya. Contoh TMT Desember (batas 31 Oktober): review diminta 31 Oktober pagi terbuka 1 November 00.00 WITA, bukan
   1 November pagi; review yang diminta 30 Oktober pagi terbuka 31 Oktober pagi seperti biasa. Aturan ini hanya
   mengubah **kapan**; yang bukan *Menunggu* (UPT sudah meminta perbaikan, sudah menyetujui, sudah dilewati, atau SK
   lama yang belum diminta review) tetap tidak dapat dilewati, dan syarat Super Admin, alasan wajib, serta catatan Log
   Aktivitas tidak berubah. Sisa waktu di kartu, pesan server, dan modal mengikuti aturan yang sama.

## Akibat

- Tidak ada skema, kolom, atau rute baru. Perubahan hanya aturan murni, satu penjagaan di `lewatiReviewSk`, dan teks.
- KGB yang batas inputnya sudah lewat (kartu bertanda "lewat batas", berpotensi rapelan) dan review-nya masih menunggu
  UPT dapat langsung dilewati Super Admin, berapa pun lama menunggunya, asal sudah diminta. UPT tetap mendapat permintaan
  review sejak Buat SK; yang hilang hanyalah jeda 24 jam, karena masa input Kanwil sudah habis dan menunggu lagi hanya
  menambah rapelan.
- Super Admin yang butuh melewati review di bawah 24 jam, selagi batas input belum lewat, tidak lagi bisa. Keadaan mendesak yang sungguh tidak dapat
  menunggu harus menghubungi Admin UPT; pemilik dapat menurunkan `BATAS_LEWATI_REVIEW_JAM` bila 24 jam terasa terlalu
  lama.
- Tombol yang tersembunyi tidak diperbarui otomatis saat jam ke-24 lewat; muncul pada muat ulang atau penyegaran dasbor
  berikutnya. Server memakai jam sendiri, jadi tab lama yang masih menampilkan tombolnya tetap ditolak bila belum 24 jam.
- Video seri tutorial yang memperlihatkan Lewati review (bila ada) perlu diperiksa ulang; belum diubah di sini.

## Uji

`lib/reviewSkUpt.test.ts`: pemotongan oleh batas input (batas hari ini: sisa 12 jam, bukan 24; sesudahnya langsung terbuka;
batas jauh: 24 jam penuh; yang bukan menunggu tetap tertutup; batas tidak sah diabaikan), penolakan dan penerimaan di server
dengan `batasInput`, ditambah batas 24 jam tepat (23 jam 59 menit ditolak dengan sisa 1 menit, 24 jam diterima), status
bukan menunggu (perbaikan, disetujui, dilewati, belum diminta), `sesuai` dibaca sebagai menunggu, waktu permintaan hilang,
pembulatan sisa waktu, penolakan server tanpa mengubah baris dan lonceng UPT, serta jam 24 yang mulai lagi sesudah
Perbaiki SK. Tampilan diperiksa di peramban dengan data contoh lokal.
