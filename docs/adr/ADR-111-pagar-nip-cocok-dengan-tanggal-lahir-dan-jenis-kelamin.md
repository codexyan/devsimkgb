# ADR-111: NIP pegawai baru harus cocok dengan tanggal lahir dan jenis kelamin yang diisi

Tanggal: 13 Oktober 2026
Status: berlaku. Melengkapi lib/nipPns.ts (pemeriksaan susunan NIP, 30 September 2026).

## Konteks

Super Admin menambah pegawai Ahmad Rijani (lahir 28 November 1989) dengan NIP `199304072017121006` dan ditolak "NIP sudah
terdaftar". NIP itu milik pegawai lain (lahir 7 April 1993); NIP yang benar adalah `198911282017121003`. Salah ketik seperti ini
hanya ketahuan karena kebetulan bentrok dengan pegawai yang sudah tercatat. NIP orang lain yang belum tercatat, atau NIP
yang salah satu angkanya keliru, lolos sebagai pegawai baru dan menjadi data induk yang salah.

NIP PNS punya susunan baku: delapan angka pertama tanggal lahir (yyyymmdd), enam angka TMT CPNS (yyyymm), satu angka jenis
kelamin (1 laki-laki, 2 perempuan), tiga angka urut. `lib/nipPns.ts` sudah memeriksa susunan itu, tetapi hanya pada Unggah
daftar UPT, dan hanya bentuknya (tanggal yang mungkin ada, bukan apakah cocok dengan orangnya). Formulir tambah pegawai
Kanwil dan formulir usulan pegawai baru UPT hanya memeriksa "18 digit angka".

## Keputusan (pemilik, 13 Oktober 2026)

1. **NIP pegawai baru dicocokkan dengan isian tanggal lahir dan jenis kelamin** (`nipTidakCocokDenganIsian`,
   `lib/nipPns.ts`, diuji). Tidak cocok berarti **ditolak**, dengan kalimat yang menyebut bagian mana yang berbeda, misalnya
   "delapan angka pertama NIP (19930407) menunjukkan lahir 7 April 1993, tetapi tanggal lahir yang diisi 28 November 1989".
   Pesan menutup dengan petunjuk mencocokkan dengan SK, sebab yang keliru bisa NIP-nya, bisa juga isiannya.
2. **Hanya untuk pegawai baru**, di semua jalur pembuatannya:
   - Tambah pegawai Kanwil dan impor daftar Kanwil (`bacaIsianPegawai` dengan NIP).
   - Usulan pegawai baru UPT: draf baru, ubah draf, dan Unggah daftar UPT (baris yang bukan pegawai tercatat).
3. **Tidak berlaku** pada perbaikan data pegawai yang sudah tercatat (Perbarui data, usulan perbaikan, baris Unggah daftar
   yang NIP-nya sudah tercatat). Data lama yang polanya tidak baku harus tetap dapat dibetulkan, dan jalur perbaikan itulah
   yang dipakai untuk membetulkan isian yang keliru.
4. **Isian kosong tidak diperiksa.** Tanggal lahir tidak wajib, dan jenis kelamin diperiksa hanya bila dipilih. NIP yang
   angka jenis kelaminnya bukan 1 atau 2 tidak ditebak di sini; susunan itu urusan `periksaNip`.

## Akibat

- Tidak ada skema, kolom, atau rute baru, dan tampilan formulir tidak berubah: pesan muncul di tempat galat yang sudah ada.
- Pegawai baru dengan NIP yang tidak sesuai tanggal lahir atau jenis kelaminnya tidak lagi bisa masuk, baik lewat Kanwil
  maupun lewat UPT. Operator diminta mencocokkan dengan SK, bukan menebak.
- NIP asli yang kebetulan menyimpang dari pola (misalnya data lama yang salah tercatat di SK) harus dibetulkan dulu di sumbernya
  atau dimasukkan lewat jalur perbaikan setelah tercatat; ini sengaja, karena penolakan lebih murah daripada data induk salah.

## Uji

`lib/nipPns.test.ts` (kasus nyata, tanggal lahir saja, jenis kelamin saja, keduanya, isian kosong, singkatan jenis kelamin, bukan
18 digit, delapan angka yang bukan tanggal, angka jenis kelamin mustahil), `lib/dataPegawai.test.ts` (Kanwil menolak dan
menerima, perbaikan tanpa NIP tidak diperiksa), `lib/imporUsulanUpt.test.ts` (baris baru ditolak, pegawai tercatat tidak
diperiksa). Pengiriman nyata diperiksa di peramban sebagai Super Admin dan Admin UPT.
