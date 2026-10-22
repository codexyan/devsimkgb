# ADR-123: Masa kerja menurut SK di Data Kepegawaian Input KGB

Tanggal: 22 Oktober 2026
Status: berlaku

## Konteks

Data Pegawai menyimpan masa kerja golongan **pada TMT KGB terakhir**, dasar hitungan KGB (ADR-078). Bila sesudah KGB terakhir
terbit SK kenaikan pangkat atau PMK, SK itu menulis masa kerja **pada TMT-nya sendiri**. Pada Erwin Tri Hatmaja, tersimpan
7 thn 0 bln (pada 1 Des 2024), sedangkan SK kenaikan pangkat TMT 1 Apr 2026 menulis 8 thn 4 bln: 7/0 + 16 bulan. Kartu "Data
Kepegawaian Saat Ini" di Input KGB hanya menampilkan 7/0, sehingga tampak tidak cocok dengan SK yang sedang diperiksa operator.
Data Pegawai dan kartu KGB di papan sudah menampilkan angka menurut SK (ADR-078, ADR-119).

## Keputusan

1. **Input KGB, Data Kepegawaian Saat Ini:** bila dasar KGB adalah SK kenaikan pangkat atau PMK yang TMT-nya sesudah TMT KGB
   terakhir, masa kerja golongan tampil menurut SK (8 thn 4 bln), dengan keterangan "menurut SK kenaikan pangkat (atau PMK),
   pada TMT ..." dan "tersimpan 7 thn 0 bln pada TMT KGB terakhir (dasar hitungan)". Tanpa SK seperti itu tampilannya tidak
   berubah.
2. **Segar:** dasarnya diambil dari linimasa panel SK (ADR-122), sehingga angka ikut berubah begitu SK dicatat atau dibetulkan
   dari panel; selama panel belum dimuat dipakai pencarian dasar awal.
3. **Buat SK dan Perbaiki SK:** "Data yang Tercetak di SK" menambah baris "Masa kerja pada SK dasar" (angka yang tercetak pada
   baris SK dasar di SK), hanya bila berbeda dari masa kerja pada TMT KGB terakhir.
4. **Kartu KGB di papan:** baris "Masa kerja pada SK dasar" disamakan istilahnya menjadi "Masa kerja menurut SK dasar".
5. **Hanya tampilan.** Hitungan KGB, gaji pokok, dan data tersimpan tidak berubah: 7/0 + 24 bulan dan 8/4 + 8 bulan sama-sama
   9/0 pada Des 2026. Rute dasbor hanya menambah dua kolom keluaran (masa kerja lama).
