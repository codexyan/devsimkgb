# ADR-026: Papan UPT menampilkan satu kartu per pegawai

Tanggal: 28 September 2026
Status: berlaku

## Konteks

Papan alur KGB di dasbor Admin UPT berjudul "tiap pegawai berada di kolom tahapnya", tetapi kartunya disusun
per dokumen: satu kartu tiap usulan, tiap KGB yang sedang diproses, tiap SK, dan tiap laporan. Akibatnya satu
orang dapat muncul beberapa kali:

- **Kolom Selesai** memuat kartu SK *dan* kartu tiap usulan yang ditinjau dalam 60 hari terakhir. Pegawai yang
  usulan perbaikannya dikirim dua kali muncul dua kartu. Di produksi pada 28 September 2026 hal ini terjadi pada
  dua pegawai Rutan Rantau (tujuh baris usulan untuk lima pegawai).
- **Kolom Di Kanwil** memuat kartu usulan yang menunggu *dan* kartu KGB yang sedang diproses.
- **Usulan pegawai baru** tidak membawa `pegawaiId`, sehingga penyaringan yang ada (satu usulan berjalan per
  pegawai, dicocokkan lewat `pegawaiId`) tidak pernah menjangkaunya.

Data pegawainya sendiri tidak pernah kembar: persetujuan usulan perubahan menimpa baris pegawai yang ada, dan
usulan pegawai baru membuat satu baris lalu menautkannya. Yang berulang hanya tampilan papannya.

## Keputusan (pemilik, 28 September 2026)

1. **Satu kartu per pegawai.** `lib/papanUpt.ts` menggabungkan semua dokumen milik orang yang sama menjadi satu
   kartu; dokumen lainnya disebut sebagai baris "Juga: ..." di kartu itu, bukan menjadi kartu tersendiri.
2. **Identitas pegawai** diambil dari `pegawaiId` bila ada, selain itu dari NIP yang dinormalisasi (hanya angka).
   Dokumen yang membawa keduanya menyatukan NIP dengan pegawainya, sehingga usulan pegawai baru tergabung dengan
   pegawai yang NIP-nya sama.
3. **Kartu utama diambil dari kolom yang paling perlu dikerjakan UPT**: Perlu dikerjakan, lalu SK terbit (perlu
   direkam di Gaji Web), lalu Di Kanwil, lalu Selesai. Bila dua dokumen sekolom, yang terbaru menjadi kartu utama.
   Urutan kolom di layar tidak berubah.
4. **NIP yang sedang diusulkan tidak dapat ditambahkan Kanwil**, baik lewat Tambah Pegawai maupun Impor CSV;
   pesannya mengarahkan meninjau usulan UPT lebih dulu. Pemeriksaan sebaliknya (UPT mengusulkan NIP yang sudah
   tercatat) sudah ada sebelumnya.
5. **Riwayat usulan UPT tidak berubah**: satu baris per pengajuan, termasuk dua pengajuan untuk orang yang sama.
   Riwayat memang mencatat peristiwa, bukan keadaan.

## Akibat

- Tidak ada migrasi basis data, dan tidak ada data yang dihapus; usulan lama tetap tersimpan dan terlihat di
  Riwayat.
- Jumlah pada kepala kolom kini menghitung pegawai, bukan dokumen, sehingga dapat lebih kecil dari sebelumnya.
