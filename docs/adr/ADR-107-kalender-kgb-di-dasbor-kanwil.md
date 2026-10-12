# ADR-107: Kalender KGB per bulan TMT kembali ke dasbor Super Admin dan SDM KGB

Tanggal: 12 Oktober 2026
Status: **dibatalkan pada hari yang sama.** Pemilik meminta desain dasbor sebelumnya dikembalikan sesudah kalender dirilis,
jadi panel Kalender KGB dihapus dan poin 4 ADR-036 (panel Jadwal input dilepas) berlaku kembali. Isi di bawah tetap
disimpan sebagai catatan keputusan dan alasannya; kodenya ada di PR #73 (commit 4ee87b3) bila kelak dibutuhkan lagi.

~~Menggantikan poin 4 ADR-036 (panel Jadwal input dilepas); sisanya ADR-036 tetap.~~

## Konteks

Pengguna meminta dasbor Super Admin memiliki visual kalender seperti yang sudah ada di dasbor Admin UPT: dua belas batang
per bulan TMT (ADR-101, ADR-103).

Pemeriksaan kodenya:

1. Dasbor Super Admin dan SDM KGB memakai satu komponen (`DashboardMain`): pita sapaan satu baris, papan Antrian kerja
   KGB, dan rail kanan berisi Usulan UPT menunggu, Perlu tindakan, Pekerjaan per satker, dan SK UPT belum direkam. Tidak
   ada kalender. Keuangan, SDM Hukdis, dan Admin UPT memakai dasbor sendiri.
2. Dasbor ini dulu punya kalender/lini masa per bulan TMT (ADR-003, ADR-012, ADR-013). ADR-036 (30 September 2026)
   melepas panel **Jadwal input** karena lini masa se-Kanwil dinilai mengulang baris bulan TMT yang melekat pada kartu
   satker. `LiniMasaKgb.tsx` ditinggalkan tanpa pemakai.
3. Yang masih hilang sesudah ADR-036: gambaran satu tahun se-Kanwil yang terbaca sekilas (bulan mana yang menumpuk atau
   lewat batas), sebab kartu satker hanya menyebut bulan yang punya pekerjaan, satker demi satker.
4. Datanya sudah ada. `pegawaiJatuhTempo` memuat TMT, status, lewat batas, dan satker; `posisiAntrian` menentukan kolom
   papan dan kartu satker. Cakupannya (`batasPipeline`, `app/api/dashboard/route.ts`): TMT sampai akhir tahun berjalan,
   minimal tiga bulan ke depan. Jadi Januari sampai Desember tahun berjalan selalu utuh; tahun depan hanya sebagian dan
   tahun lalu tidak dimuat.

## Keputusan (pemilik, 12 Oktober 2026)

1. **Bentuk: batang dua belas bulan TMT**, seperti di Admin UPT. Bukan kisi tanggal, karena semua TMT jatuh pada tanggal 1
   dan yang bermakna hanya tenggat; tenggat bulan berjalan tidak ditambahkan.
2. **Tempat: panel di rail kanan, dapat diciutkan** (`PanelKalenderKgb`, memakai `usePanelCiut` ADR-050), tepat di bawah
   Perlu tindakan. Bukan di atasnya: susunan layar sempit (`dasbor.css`) menaikkan panel pertama rail ke atas antrian dan
   memang diperuntukkan bagi Usulan UPT menunggu dan Perlu tindakan. Panel ini bawaannya ciut bila tinggi layar kurang
   dari 820 px, karena pada layar sependek itu rail tidak muat menampung semua panelnya; sekali dibuka pilihannya diingat.
3. **Cakupan: tahun berjalan saja**, tanpa panah tahun dan tanpa perubahan API. KGB yang TMT-nya di luar tahun ini (atau
   belum tercatat) disebut satu baris catatan, tidak dikarang bulannya, dan tetap tampil di papan.
4. **Peran: Super Admin dan SDM KGB**, karena komponennya sama. Tanpa penyekatan peran tambahan.
5. **Tahap memakai posisi papan Kanwil**, bukan tahap UPT: lewat batas, perlu input, diproses, keuangan (keuangan Kanwil dan
   rekam UPT, sama-sama ungu), belum dibuka, selesai. Aturannya murni di `lib/kalenderKanwil.ts` beserta ujinya; urutan
   mendesaknya sama dengan kartu satker (`lib/kartuSatkerDasbor.ts`).
6. **Angka mengikuti saringan satker dan fokus papan**, tetapi tidak saringan bulan dan pencarian. Jadi angka batang selalu
   sama dengan isi papan untuk bulan itu. Saat satker atau fokus disaring, kepala panel menyebutkannya.
7. **Menekan satu bulan menyaring papan ke TMT itu** (mekanisme `filterMonth` yang sudah ada, tahap diatur ke Semua),
   menekan lagi membukanya. Bulan kosong tidak dapat ditekan.
8. **Penanda**: bingkai emas untuk bulan yang jendela inputnya sedang berjalan (TMT dua bulan sesudah bulan berjalan,
   sama dengan jendela kirim di Admin UPT), titik merah untuk bulan yang punya KGB lewat batas input. Warna tidak berdiri
   sendiri: ada legenda, dan tiap batang punya label baca-layar berisi jumlah dan rinciannya.

## Akibat

- Tidak ada rute, skema, atau permintaan jaringan baru; kalender disusun di peramban dari data dasbor yang sudah dimuat.
- Tinggi rail bertambah sekitar 210 px bila panel dibuka. Pada layar sedang rail menggulir seperti biasa; pada layar pendek
  panelnya ciut bawaan, jadi susunan lama tidak berubah sampai pemakainya membukanya.
- Panel Jadwal input se-Kanwil tidak dihidupkan lagi; yang kembali hanya kalender setahun. Baris bulan per satker di kartu
  satker tetap ada dan tetap mengunci fokus papan.
- Dari Oktober sampai Desember, KGB bertmt Januari sampai Maret tahun depan sudah ada di papan tetapi belum di kalender
  (muncul sebagai catatan "KGB lain bertmt di luar tahun ini"). Memperlebar cakupan ke tahun depan menuntut API dashboard
  dilebarkan lebih dulu; itu belum dikerjakan.
- `LiniMasaKgb.tsx` tetap tidak dipakai. Menghapusnya terpisah dari perubahan ini.

## Uji

`lib/kalenderKanwil.test.ts`: dua belas bulan utuh, hitungan per bulan dan posisi, posisi wakil mengikuti urutan mendesak,
penanda terlambat, bulan jendela (termasuk pergantian tahun), serta TMT di luar tahun dan yang belum tercatat. Tampilan
diperiksa di peramban pada 1920 x 1080, 1366 x 768, dan 420 x 860, mode terang dan gelap, dengan data contoh lokal.
