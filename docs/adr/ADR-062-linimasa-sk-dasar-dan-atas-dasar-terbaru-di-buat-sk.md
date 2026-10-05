# ADR-062: Linimasa SK dasar, dan Atas dasar terbaru di Buat SK dan Perbaiki SK

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Pemilik menegaskan aturan ADR-020 dengan contoh: KGB terakhir 1 Desember 2024, lalu kenaikan pangkat 1 Januari 2026.
Dasar KGB 1 Desember 2026 adalah SK kenaikan pangkat itu. Bila sesudahnya tidak ada kenaikan pangkat lagi, dasar KGB
1 Desember 2028 adalah SK KGB 1 Desember 2026. PMK atau penyesuaian ijazah sebelum TMT KGB menggantikannya. Buat SK
dan Perbaiki SK, baik oleh Super Admin maupun Tim SDM, harus mengambil "Atas dasar" yang paling baru.

Pemeriksaan seluruh jalur menemukan:

| Jalur | Keadaan |
|---|---|
| Input KGB | Sudah sesuai: riwayat KGB, lalu Data Pegawai, lalu usulan, lalu SK kenaikan pangkat/PMK di antara TMT KGB terakhir dan TMT KGB yang diinput (ADR-020, ADR-056). |
| Buat SK dan Perbaiki SK | Hanya memakai salinan SK dasar yang tersimpan saat Input KGB. SK kenaikan pangkat, PMK, atau SK dasar Data Pegawai yang tercatat sesudahnya tidak terlihat. |
| Saran "Pakai isian Data Pegawai" di Buat SK (ADR-058) | Memakai TMT KGB terakhir pegawai sebagai TMT SK dasar. Selama KGB diproses, TMT itu sudah TMT KGB yang sedang dibuat, karena Input KGB memajukannya. |
| Kolom Dasar KGB berikutnya di dasbor UPT | Tanpa batas atas: SK kenaikan pangkat yang dicatat lebih awal, dengan TMT sesudah KGB berikutnya, ikut terpilih. |
| Catat kenaikan pangkat atau PMK selagi KGB diproses | Data pegawai berubah, tetapi KGB yang berjalan hanya ditandai "perlu ditinjau" (ADR-005, ADR-021). Golongan, masa kerja, dan gaji pokok lamanya tetap. Mengganti baris Atas dasarnya saja akan mencetak SK yang bertentangan dengan dasarnya sendiri. |

## Keputusan

1. **Satu aturan, satu modul.** `lib/linimasaDasarSk.ts` (`susunLinimasaDasar`) menyusun seluruh SK penetap gaji
   pokok pegawai menjadi linimasa: SK KGB selesai (termasuk arsip), kenaikan pangkat (termasuk penyesuaian ijazah), PMK,
   dan SK dasar Data Pegawai. Tiap SK diberi peran terhadap KGB yang dibuat: dasar, tergantikan, atau sesudah.
   - Pemilihannya sama dengan ADR-057.
   - Tambahannya **batas atas**: SK yang berlaku sesudah TMT KGB yang dibuat tidak dihitung.
   - `dasarKgbBerikutnya` (dasbor UPT) kini meringkas modul ini dan menerima TMT KGB berikutnya sebagai batas atas.
   - SK dasar Data Pegawai yang sama dengan salah satu SK riwayat dipadukan ke sana: nomor, tanggal, dan penetapnya
     diambil dari Data Pegawai (ADR-056).
   - Penetap SK KGB terbitan SIM-KGB dibaca dari KGB yang memakainya sebagai dasar, atau dari jadwal Belum Diproses
     sesudahnya.
2. **Batas bawah di Buat SK adalah TMT sebelum KGB yang diproses** (`tmtTerakhirSebelumInput`), bukan TMT KGB terakhir
   pegawai yang sudah dimajukan Input KGB. Ini juga membetulkan TMT pada saran Data Pegawai.
3. **Buat SK dan Perbaiki SK mengambil SK terbaru saat dibuka** (`bandingkanDasarSk`):
   - **SK lain yang lebih baru**, atau isian kosong: isian langsung diganti, dengan catatan "Atas dasar diperbarui ke SK
     terbaru…" dan tombol *Kembalikan isian Input KGB*. Bila penetapnya belum tercatat, catatan meminta baris Oleh diisi.
   - **SK yang sama dengan isian berbeda**: ditawarkan, tidak ditimpa (*Pakai isian Data Pegawai* atau *Pakai isian
     riwayat*), sama dengan ADR-058.
   - **Isian menyebut SK yang sama barunya atau lebih baru** (mis. SK yang belum tercatat): dibiarkan.
   - **Isian sudah disunting di jendela itu**: tidak diganti lagi.
   - Isian yang diganti tersimpan saat pratinjau, Simpan draf, atau Buat SK, sama dengan suntingan biasa.
4. **KGB basi ditahan** (`pesanKgbBasi`, `lib/pemeriksaanUlangKgb.ts`). Bila golongan atau masa kerja golongan pegawai
   berbeda dengan data lama yang disalin KGB saat Input KGB, Buat SK menolaknya, termasuk pratinjau; unduh ulang SK yang
   sudah ada tetap boleh. Pesannya menyuruh membatalkan KGB lalu Input Ulang. Selama KGB berjalan ketiga data itu
   dikunci (ADR-056), jadi yang dapat mengubahnya hanya SK kenaikan pangkat atau PMK yang dicatat belakangan.
   Persetujuan usulan UPT sudah menghitung ulang KGB yang berjalan (ADR-011), sehingga tidak tertahan.
   - Server menolak dengan 409.
   - Jendela Buat SK menampilkan alasannya di atas dan menonaktifkan tombol Buat dan Unduh SK serta pratinjau.
5. **Jendela Linimasa SK penetap gaji pokok.** Tombol *Lihat linimasa* ada di kepala bagian Atas Dasar SK Terakhir pada
   Input KGB dan Buat SK, dan membuka jendela di atas modal itu. Isinya:
   - satu kalimat aturan;
   - SK menurut TMT, dengan SK dasar berbingkai navy, penanda "KGB yang sedang dibuat" pada TMT-nya, dan SK sesudahnya
     yang dipudarkan;
   - catatan bila KGB terakhir pegawai belum tercatat SK-nya;
   - perbandingan dengan isian formulir, beserta tombol *Pakai SK ini*.

   Di Input KGB jendela ini dimuat saat diminta, karena isiannya sudah dicari dengan aturan yang sama.

## Akibat

- 22 tes baru:
  - `lib/linimasaDasarSk.test.ts`: tiga contoh pemilik, batas atas, batas bawah Buat SK, perpaduan Data Pegawai, SK
    tanpa TMT, KGB tanpa SK, TMT sama;
  - `pesanKgbBasi`;
  - `bandingkanDasarSk`.

  Kesembilan tes `dasarKgbBerikutnya` lama tetap lolos tanpa diubah.
- Uji lokal (data seed fiktif, disiapkan lewat API aplikasi):
  - **Rizky Anggraini.** KGB Des 2024, kenaikan pangkat Jan 2026, lalu Input KGB Des 2026 dengan SK KGB 2024.
    - Buat SK langsung memakai SK kenaikan pangkat, dengan Oleh "Kepala Badan Kepegawaian Negara".
    - Pratinjau SK mencetak SK itu, dengan masa kerja golongan pada tanggal tersebut 15 tahun 1 bulan.
    - Isian yang tersimpan pada KGB ikut berganti.
  - **Indah Salim.** Input KGB lebih dulu, baru kenaikan pangkat dicatat. Buat SK menampilkan alasan merah, tombolnya
    nonaktif, dan pratinjau lewat API ditolak 409.
  - **Hendra Wijaya.** Setelah penyesuaian ijazah dicatat, Input KGB terisi SK itu, dan linimasa menyatakan isian sudah
    menyebut SK ini.
  - **Ponsel 390 px.** Dari halaman pegawai, jendela linimasa tampil utuh sebagai lembar bawah.
- **Masalah lama di luar keputusan ini.** Di halaman Proses KGB (`/dashboard/kgb`), tabel selebar ±1.030 px melebarkan
  viewport tata letak ponsel menjadi 768 px. Semua modal di halaman itu, termasuk Buat SK, karenanya tampil terpotong di
  ponsel.
