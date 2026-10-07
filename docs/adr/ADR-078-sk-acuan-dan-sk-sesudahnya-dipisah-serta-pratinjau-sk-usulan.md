# ADR-078: SK KGB terakhir dan SK sesudahnya dipisah di formulir UPT, serta pratinjau SK dari usulan

Tanggal: 7 Oktober 2026
Status: berlaku; keputusan 5 (bagian atas dikunci ke data tercatat) diganti ADR-079

## Konteks

Keluhan Admin UPT pada formulir usulan (termasuk usulan yang dikembalikan Kanwil):

1. **KGB berikutnya tampil 2025, seharusnya 2026.** Contoh: KGB terakhir 1 Desember 2024 di II/b dengan masa kerja 7 tahun,
   lalu penyesuaian ijazah ke III/a TMT 1 Februari 2026 (di SK tertulis 3 tahun 2 bulan). Pada pegawai yang sudah tercatat,
   golongan baru diisi di kolom golongan bagian atas, tetapi kotak *Dihitung sistem* menghitungnya dengan masa kerja lama
   (III/a, 7 tahun), sehingga KGB berikutnya tampil 1 Desember 2025. Persetujuan Kanwil sendiri benar: masa kerja dipotong 5
   tahun (II ke III) dan jadwal KGB tidak bergeser, jadi 1 Desember 2026. Pratinjau dan persetujuan memakai hitungan yang
   berbeda.
2. **Bagian SK sesudah SK KGB terakhir tidak punya pilihan golongan.** Golongan baru diketik di bagian atas, yang menurut
   label dan petunjuknya adalah data SK KGB terakhir. Masa kerja menurut SK kenaikan pangkat tidak ditanyakan sama sekali,
   dan pegawai baru diminta menyalin masa kerja dari SK kenaikan pangkat ke kolom yang sama dengan SK KGB terakhir.
3. **Beralih dari Tidak ada ke Ada menghapus isian SK.** `jawabSkBaru(…, false)` mengosongkan nomor, tanggal, TMT, dan
   penetap.
4. **Masa kerja tercatat "berubah"** (kasus Hendra Irawan, 5 tahun 8 bulan) **dan tiba-tiba ada tanda *Dari KP/PI*.**
   Setelah SK kenaikan pangkat tercatat, data pegawai menyimpan masa kerja pada TMT KGB terakhir yang sudah dipotong 5 tahun
   (II ke III), sedangkan SK kenaikan pangkat menulis masa kerja pada TMT pangkatnya. Golongan, pangkat, gaji pokok, dan TMT
   golongan ikut berubah, dan SK itu menjadi dasar KGB berikutnya sehingga bertanda *Dari KP/PI*. Datanya benar, tetapi
   tampilannya hanya menunjukkan satu angka.
5. Admin UPT ingin melihat SK sebelum mengajukan, tidak menunggu Kanwil membuat SK (ADR-077).

Pilihan yang diambil pengguna dari opsi yang diajukan: memisahkan bagian formulir sesuai skema SK, menampilkan kedua angka
masa kerja, pratinjau SK di formulir dengan review Kanwil (ADR-077) tetap berlaku, dan langsung deploy.

## Keputusan

1. **Dua keadaan, sesuai urutan SK-nya.** Bagian *Pangkat, gaji pokok, dan KGB* berisi keadaan pada SK KGB terakhir (atau
   SK CPNS): golongan, TMT golongan, masa kerja golongan, TMT, nomor, dan tanggalnya. Bagian *SK sesudah SK KGB terakhir*
   berisi golongan/ruang baru menurut SK (kenaikan pangkat), masa kerja golongan menurut SK (kenaikan pangkat dan PMK),
   nomor, tanggal, TMT, dan penetapnya.
2. **Satu hitungan untuk pratinjau, persetujuan, dan pratinjau SK** (`hitungSkDilaporkan`, `lib/dasarSkUsulan.ts`):
   kenaikan pangkat memotong masa kerja menurut lompatan golongan (I ke II 6 tahun, II ke III 5 tahun) dan tidak menggeser
   jadwal KGB; PMK menambah masa kerja dan menghitung KGB berikutnya dari TMT PMK. Kotak *Dihitung sistem sesudah SK ini*
   menampilkan pangkat, gaji pokok, dan KGB berikutnya hasilnya.
3. **Masa kerja menurut SK kenaikan pangkat dicocokkan, bukan dipakai menghitung.** Hitungan sistem: masa kerja pada TMT
   KGB terakhir ditambah selang sampai TMT pangkat, lalu dipotong (contoh: 7 tahun + 14 bulan − 5 tahun = 3 tahun 2 bulan).
   Bila berbeda, formulir memperingatkan, dan Kanwil melihat catatan yang sama di daftar usulan (`catatanSkDilaporkan`).
   Masa kerja menurut SK PMK tetap menjadi dasar hitungan PMK.
4. **Penyimpanan** (migrasi manual `supabase/migrations/20261007120000_usulan_sk_acuan.sql`): kolom utama golongan dan masa
   kerja usulan berisi yang tertulis pada SK yang dilaporkan, seperti sebelumnya. Keadaan pada SK KGB terakhir disimpan di
   kolom baru `golongan_acuan`, `mkg_tahun_acuan`, `mkg_bulan_acuan`, hanya bila SK sesudahnya dilaporkan.
   - Usulan tanpa acuan (usulan lama, Lapor KP/PI/PMK, unggahan Excel) tetap dihitung seperti sebelumnya: pegawai baru
     dihitung mundur dari masa kerja pada SK (ADR-065), pegawai tercatat dari data tercatat.
   - Pegawai baru ber-acuan dihitung seperti pegawai tercatat. Riwayat kenaikan pangkatnya kini memuat golongan, masa kerja,
     dan gaji pokok lama, dan TMT golongannya adalah TMT kenaikan pangkat.
   - Sebelum migrasi dijalankan, simpanan yang berisi acuan diulang tanpa acuan (`lib/acuanUsulanServer.ts`), sehingga
     tidak ada simpanan yang gagal; usulannya diperlakukan sebagai usulan lama.
5. **Pegawai yang sudah tercatat:** selama SK dilaporkan, golongan, TMT golongan, dan masa kerja di bagian atas dikunci ke
   data tercatat, sebab itulah yang dipakai Kanwil. Golongan baru yang telanjur diketik di bagian atas (cara lama) dipindahkan
   ke bagian SK. Draf lama dipisahkan kembali saat dibuka (`pisahkanIsianSk`); pada pegawai baru, keadaan SK KGB terakhirnya
   tidak diketahui sehingga dikosongkan untuk diisi.
6. **Jawaban berganti tidak menghapus isian.** Isian SK tetap di formulir dan jenis SK terakhir dipulihkan saat menjawab
   *Ada* lagi. Server tidak menyimpan isian SK selama jawabannya *Tidak ada* (`bacaDasarBaru`, `bacaAcuan`).
7. **Dua angka masa kerja ditampilkan** di formulir usulan, Usul KGB Kolektif, dan Data Pegawai Kanwil, bila dasar KGB
   berikutnya adalah SK kenaikan pangkat atau PMK sesudah KGB terakhir (`mkgPadaSkTercatat`): masa kerja tercatat pada TMT
   KGB terakhir (dasar hitungan), dan masa kerja pada TMT SK itu sebagaimana tertulis di SK. Hitungan tidak berubah.
8. **Pratinjau SK KGB dari usulan** (`POST /api/upt/usulan/pratinjau-sk`, `lib/pratinjauSkUsulan.ts`): tombol di formulir
   usulan dan Usul KGB Kolektif. Keadaan sesudah usulan disetujui dihitung seperti persetujuan Kanwil, KGB berikutnya dengan
   rumus jadwal Input KGB, Atas dasar SK dari linimasa SK penetap gaji (ADR-062) dengan SK yang dilaporkan sebagai calon, dan
   isinya disusun `lib/dataSuratKgbServer.ts`, sama dengan Buat SK. PDF-nya disusun di peramban bertanda air
   *PRATINJAU USULAN · BELUM DIAJUKAN*. Tidak menulis apa pun. Nomor surat, tanggal, dan penandatangannya ditetapkan Kanwil;
   review SK oleh UPT sesudah Kanwil membuat SK (ADR-077) tetap berlaku sebagai pemeriksaan akhir.
9. **Apa yang baru** untuk Admin UPT: pengumuman `sk-usulan-2026-10` dengan dua adegan. Panduan diperbarui.
10. **Lapor KP/PI/PMK** (kartu *Laporkan* per pegawai dan halaman massal, `lib/laporSk.ts`, `laporSkKirim.ts`): kenaikan
    pangkat kini juga menagih masa kerja golongan menurut SK, dan kotak *Dihitung sistem* mencocokkannya dengan hitungan
    pada TMT pangkat (peringatan bila berbeda). Laporan menyimpan keadaan induk (data tercatat) sebagai acuan, sehingga
    Kanwil melihat catatan pencocokan yang sama. Draf laporan lama yang belum memuat masa kerja menurut SK dibuka dengan
    isian itu kosong.
11. **Unggah daftar (Excel)** (`lib/imporUsulanUpt.ts`, templat `.xlsx`): tiga kolom opsional `golonganAcuan`,
    `mkgTahunAcuan`, `mkgBulanAcuan` untuk pegawai baru yang melaporkan SK kp atau pmk. Bila diisi, hitungannya dari SK KGB
    terakhir dan masa kerja di SK dicocokkan; bila kosong, masa kerja pada SK dihitung mundur seperti ADR-065. Golongan acuan
    yang salah tulis menolak barisnya. Pada pegawai yang sudah tercatat ketiganya diabaikan, sebab data tercatatlah acuannya.

## Akibat

- Yang dilihat UPT sebelum mengajukan sama dengan yang diterapkan Kanwil; KGB berikutnya contoh di atas tampil 1 Desember
  2026.
- UPT menyalin dua angka masa kerja dari dua SK, sesuai dokumennya, dan salah salin terdeteksi sebelum diajukan.
- Usulan pegawai tercatat tidak dapat sekaligus mengoreksi golongan atau masa kerja tercatat dan melaporkan SK; koreksinya
  diajukan lebih dulu. Sebelumnya perubahan seperti itu diabaikan diam-diam saat disetujui.
- Lapor KP/PI/PMK kini menuntut satu isian lagi untuk kenaikan pangkat (masa kerja menurut SK). Unggahan Excel tetap dapat
  memakai cara lama tanpa kolom acuan.
- Kolom acuan berlaku setelah migrasi dijalankan.
