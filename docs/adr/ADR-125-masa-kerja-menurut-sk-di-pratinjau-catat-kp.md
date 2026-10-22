# ADR-125: Masa kerja menurut SK di pratinjau Catat kenaikan pangkat

Tanggal: 22 Oktober 2026
Status: berlaku

## Konteks

Pratinjau "Setelah kenaikan pangkat" di Catat kenaikan pangkat menampilkan masa kerja tersimpan: 7 thn 0 bln → 7 thn 0 bln
(Fajar Trianto, II/b → II/c). Angka itu masa kerja **pada TMT KGB terakhir**, dasar hitungan KGB (ADR-078). SK kenaikan pangkat
menulis masa kerja **pada TMT-nya sendiri**: dengan KGB terakhir 1 Des 2024 dan TMT pangkat 1 Apr 2026 (16 bulan), SK menulis
8 thn 4 bln. Operator yang mencocokkan pratinjau dengan SK melihat dua angka yang tampak berbeda. Input KGB, Buat SK, dan kartu
KGB sudah menampilkan angka menurut SK (ADR-119, ADR-123).

## Keputusan

1. Pratinjau menampilkan masa kerja **menurut SK pada TMT pangkat** sebagai angka utama (8 thn 4 bln → 8 thn 4 bln), dengan
   keterangan "menurut SK, pada TMT pangkat ..." dan "tersimpan 7 thn 0 bln → 7 thn 0 bln pada TMT KGB terakhir (dasar
   hitungan)". Pada pindah jenjang golongan, angka sesudahnya sudah dipotong (mis. 8/4 → 3/4).
2. Berlaku saat TMT pangkat sudah diisi dan sesudah TMT KGB terakhir pegawai; selain itu tampilannya tetap angka tersimpan.
   Hitungannya `mkgMenurutSkPadaTmt` di `lib/kenaikanPangkat.ts`: angka tersimpan ditambah selang kedua TMT.
3. **Hanya tampilan.** Yang disimpan, gaji pokok, jadwal KGB, dan hitungan di server tidak berubah.
