# ADR-054: Gaji pokok tercatat yang tidak sejalan dengan golongan dan masa kerja

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Tim SDM membuka Input Ulang KGB untuk seorang pegawai III/d dengan masa kerja golongan 14 tahun, dan
mendapati angkanya tidak cocok. Datanya:

| | Tercatat | Menurut tabel PP 5/2024 |
|---|---|---|
| Gaji pokok saat ini (III/d, 14 tahun) | Rp 4.186.200 | Rp 3.919.100 |
| Gaji pokok baru (III/d, 16 tahun) | | Rp 4.042.500 |

Rp 4.186.200 tidak ada di kolom III/d mana pun, bahkan tidak ada di tabel PP 5/2024 sama sekali. Golongan
dan masa kerjanya sejalan dengan NIP-nya (TMT CPNS Desember 2010, 14 tahun pada TMT KGB 1 Desember 2024).
Jadi yang keliru adalah kolom gaji pokoknya.

Penyebabnya ada tiga:

1. **Gaji pokok disimpan sebagai kolom tersendiri.** Impor Data Pegawai menerima kolom `gajiPokok` apa adanya
   (`bacaGajiPokok`): angka di berkas mengalahkan tabel. Hitungan KGB sendiri tidak memakai kolom itu; gaji
   barunya dihitung dari golongan dan masa kerja, sehingga gaji baru tampil lebih kecil dari gaji lama.
2. **Input KGB tidak memeriksa apa pun.** Gaji tercatat menjadi `gajiPokokLama` pada riwayat KGB dan tercetak
   sebagai *Gaji Pokok Lama* di SK. SK pegawai ini akan mencetak penurunan gaji Rp 4.186.200 menjadi
   Rp 4.042.500.
3. **Koreksi dasar gaji tidak dapat membetulkannya.** Layar koreksi memperlihatkan gaji "Menjadi
   Rp 3.919.100", tetapi tidak mengirim gaji pokok. Server hanya menghitung ulang gaji bila golongan atau masa
   kerja ikut berubah (`gabungIsianPegawai`). Karena keduanya sudah benar, gaji yang salah bertahan, padahal
   layar menjanjikan sebaliknya.

## Keputusan

1. **Koreksi dasar gaji selalu mengirim gaji pokok kosong**, sehingga gaji dibaca ulang dari tabel walau
   golongan dan masa kerjanya tidak berubah. Yang tersimpan sama dengan yang diperlihatkan layar.
2. **Input KGB menandai gaji tercatat yang tidak sesuai tabel** (`gajiTercatatMenyimpang`). Catatan amber
   menyebut angka tercatat, angka tabel, dan jalan membetulkannya.
3. **Input dan Arsip KGB yang menurunkan gaji ditahan**, di layar (tombol Simpan mati, catatan merah) dan di
   rute `POST /api/kgb` (`pesanGajiTurun`). KGB tidak pernah menurunkan gaji: di atas langkah terakhir tabel
   gajinya tetap. Jadi gaji baru yang lebih kecil selalu berarti gaji tercatatnya yang keliru.
4. Gaji yang tidak sesuai tabel tetapi lebih kecil dari gaji baru hanya ditandai, tidak ditahan. Contohnya
   data lama dari tabel PP 15/2019: hitungan KGB-nya tetap benar, dan operator dapat memutuskan sendiri.

## Akibat

- Pegawai seperti pada kasus ini harus dibetulkan dulu lewat Data Pegawai: *Ubah dasar KGB*, lalu *Koreksi
  data yang salah ketik*, dengan golongan dan masa kerja dibiarkan. Gaji menjadi Rp 3.919.100, lalu Input KGB
  menghasilkan Rp 3.919.100 menjadi Rp 4.042.500.
- Gaji tercatat yang menyimpang belum dicari menyeluruh. Pemeriksaan massal, misalnya di halaman pemeriksaan
  data, dapat ditambahkan kemudian dengan `gajiTercatatMenyimpang` yang sama.
- Impor Data Pegawai tetap menerima kolom `gajiPokok` apa adanya; yang menyimpang kini tertangkap saat Input
  KGB, bukan saat impor.
