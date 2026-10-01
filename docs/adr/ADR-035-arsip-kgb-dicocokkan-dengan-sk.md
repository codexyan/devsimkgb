# ADR-035: Arsip KGB dicocokkan dengan angka yang tertulis pada SK

Tanggal: 30 September 2026
Status: berlaku

## Konteks

Sebuah SK KGB yang terlambat beberapa tahun (WP.19-SA.04.04-172 atas nama NOOR AZMI SYAHBUDIN, S.H.,
TMT 1 Maret 2026) diarsipkan berulang kali pada 29–30 September 2026 dan tiap kali menghasilkan angka yang
berbeda; 19 tahun, lalu 15 tahun 5 bulan, lalu 13 tahun 5 bulan; tidak satu pun cocok dengan SK yang
menyebut 14 tahun 0 bulan. Sisanya empat baris riwayat KGB yang saling bertentangan, dua di antaranya arsip
ganda atas SK yang sama.

Dugaan pertama adalah rumusnya tidak sanggup menangani KGB terlambat, dan jalan keluarnya membiarkan
operator memakai angka SK apa adanya. **Dugaan itu salah.** `kalkulasiKGB` sudah menanganinya:

```ts
let tambah = bulanKeKgbBerikutnya(golongan, mkgTahun, mkgBulan);
if (tmtTerakhir) tambah = Math.max(tambah, selisihBulan(tmtTerakhir, tmtKgbBaru));
```

Masa kerja ditambah sebesar **yang lebih besar** antara siklus normal dan jarak nyata dari TMT terakhir.
Diuji dengan data SK itu: dari dasar 1 Oktober 2022 masa kerja 10 tahun 7 bulan, sistem menghasilkan
**14 tahun 0 bulan, Rp3.607.500, KGB berikutnya 1 Maret 2028**, sama persis dengan SK, ketiga-tiganya.

Yang keliru hanya **satu isian**: masa kerja golongan pegawai tercatat 10 tahun 0 bulan, meleset tujuh
bulan dari SK dasarnya. Dari situ sistem menghasilkan 13 tahun 5 bulan; persis angka pada salah satu baris
riwayat yang janggal itu.

Jadi kegagalannya bukan pada rumus, melainkan pada **tidak adanya pencocokan**: sistem tidak pernah
membandingkan hasil hitungannya dengan SK yang sedang dipegang operator, sehingga arsip yang angkanya
meleset tersimpan diam-diam lalu mengunci angka keliru itu menjadi dasar KGB berikutnya.

## Keputusan (pemilik, 30 September 2026)

1. **Jendela Arsip KGB meminta masa kerja golongan dan gaji pokok yang tertulis pada SK.** Keduanya wajib.
2. **Keduanya tidak disimpan.** Yang tersimpan tetap hasil hitungan dari tabel PP 5/2024; asas "gaji pokok
   tidak pernah diketik operator" tidak dilonggarkan. Isian ini semata pembanding.
3. **Selama angkanya berbeda, pengarsipan ditahan**; tombol Simpan Arsip tidak aktif, dan server menolak
   dengan 409 bila tetap dikirim. Aturannya di `lib/cocokArsipSk.ts`, dipakai peramban sebagai penuntun dan
   rute sebagai penentu, supaya keduanya tidak berbeda pendapat.
4. **Pesannya menunjuk sebab yang sebenarnya**, yaitu data dasar pegawai yang belum sesuai SK dasarnya,
   bukan menyalahkan SK. SK sudah ditandatangani; data dasarlah yang dapat dan perlu diperbaiki.
5. **Tidak ada jalan pintas untuk memaksakan angka SK.** Sempat dipertimbangkan, lalu ditolak setelah
   diketahui rumusnya sudah benar: jalan pintas itu hanya akan menutup alarm yang justru perlu berbunyi.

## Akibat

- Mengarsipkan SK kini menuntut operator benar-benar membaca dokumennya, bukan menekan Simpan.
- Arsip atas pegawai yang data dasarnya keliru tertahan sampai datanya diperbaiki. Itu memang tujuannya,
  dan berarti sebagian pekerjaan arsip akan berhenti sampai Data Pegawai dibereskan lebih dulu.
- KGB yang terlambat bertahun-tahun tidak perlu perlakuan khusus apa pun.
- Tidak ada perubahan skema. `lib/cocokArsipSk.test.ts` memuat kasus SK di atas sebagai penjaga regresi,
  termasuk bahwa masa kerja dasar yang meleset tujuh bulan memang tertahan.
- Perbaikan data pegawai yang terlanjur kacau disiapkan terpisah di
  `scripts/perbaikan-azmi-2026-09-30.sql`, untuk dibaca dan dijalankan pemilik.
