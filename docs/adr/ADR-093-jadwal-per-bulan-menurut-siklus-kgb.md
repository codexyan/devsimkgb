# ADR-093: Angka per bulan TMT dihitung menurut siklus KGB, bukan TMT KGB berikutnya di data pegawai

Tanggal: 8 Oktober 2026
Status: berlaku.

## Konteks

Pita jadwal di dasbor Admin UPT menunjukkan "TMT Des 2026 · 2 pegawai" berdampingan dengan "Selesai TMT 2026 · 0 / 57".
Satker itu hampir seluruh pegawainya ber-TMT Desember, jadi angka 2 jelas keliru.

Angka per bulan diambil dari `rekapPerSatker().mendatang`, yang menghitung pegawai menurut `tmtKgbBerikutnya` di data
pegawai. Input KGB langsung menggeser kolom itu ke siklus sesudahnya (`app/api/kgb/route.ts`), misalnya dari Des 2026 ke
Des 2028. Akibatnya angka bulan itu menyusut satu setiap kali Kanwil menginput KGB, padahal pegawainya masih jatuh tempo
bulan itu.

Tiga tempat lain tidak terdampak, sebab memakai TMT siklus KGB (`pilihKgbSiklus`, `satuPerSiklus`):
- papan dan daftar per bulan yang terbuka saat kartu ditekan;
- angka "Selesai TMT tahun ini";
- dasbor Kanwil.

Cadangan produksi pukul 10.47 WITA memperlihatkan selisih yang sama:

| Satker | Angka bulan lama | Papan |
| --- | --- | --- |
| Lapas Perempuan Martapura, Des 2026 | 13 | 14 |
| Kanwil, Des 2026, di halaman Satker & UPT | 5 | 29 |

## Keputusan

1. `rekapPerSatker().mendatang` menghitung **siklus KGB per bulan TMT**: record KGB ditambah jadwal Belum Diproses, satu
   per pegawai per TMT. Dasarnya sama dengan `tahunIni`. KGB yang sudah diinput, sudah selesai, atau dibatalkan dan belum
   diinput ulang tetap terhitung di bulan TMT-nya. Hitungan ini dipakai halaman Satker & UPT.
2. **Pita jadwal Admin UPT** menghitung dari daftar pegawai papan, yaitu daftar yang sama dengan jendela per bulan. Angka
   kartu dan isi jendelanya selalu sama. Kolom `mendatang` dilepas dari respons `/api/upt` karena tidak dipakai lagi.

## Akibat

- Angka bulan kini menyatakan berapa pegawai yang KGB-nya ber-TMT bulan itu, apa pun tahapnya. Angka itu tidak lagi
  menyusut selama Kanwil bekerja.
- "Selesai TMT 2026 · 0 / 57" memang benar: 57 KGB ber-TMT 2026, dan belum satu pun selesai (direkam di Gaji Web).
- Hanya hitungan tampilan. Tidak ada data yang diubah dan tidak ada migrasi.
