# ADR-104: Draf pegawai baru ikut terkunci di dasbor sampai jendela kirim KGB-nya

Tanggal: 11 Oktober 2026
Status: berlaku. Mengubah pengecualian pegawai baru di ADR-059.

## Konteks

ADR-059 mengunci draf usulan data di Dasbor Admin UPT sampai masa usul KGB pegawainya dibuka, tetapi mengecualikan draf
pegawai baru. Alasannya, data pegawai baru belum ada di Kanwil sama sekali, jadi pendataannya tidak boleh menunggu jadwal
KGB.

Akibatnya, draf seperti "Anna, 199106072025062004, Pegawai baru" selalu tampil di kolom Perlu dikerjakan. Sejak ADR-103
kartunya berada di bawah subjudul "Data pegawai lainnya". Padahal pegawai itu diangkat CPNS Juni 2025, sehingga KGB
pertamanya baru sekitar 2027.

Pengguna menetapkan bahwa Perlu dikerjakan hanya memuat pegawai yang TMT KGB-nya masuk jendela kirim (dua bulan sebelum
TMT), ditambah yang terlambat dan yang dikembalikan Kanwil. Draf pegawai baru yang belum waktunya tidak semestinya ada di
sana.

## Keputusan

1. **Draf pegawai baru ikut dikunci menurut TMT KGB berikutnya dari isiannya sendiri** (`drafTerkunci`,
   `lib/tugasUpt.ts`, diuji).
   - `GET /api/upt/usulan` mengirim `bulanTmtKgb` untuk draf pegawai baru. Nilainya dihitung dengan cara yang sama seperti
     saat usulan disetujui (`usulanBaruMenurutSk`), jadi SK kenaikan pangkat atau PMK sesudah SK KGB terakhir ikut
     dihitung.
   - Bila jendela kirimnya belum dibuka, kartu terlipat di "Terkunci sampai masa usul KGB" seperti draf lain.
   - Bila sudah dibuka, kartu masuk subjudul Perlu dikerjakan menurut bulan TMT itu: "Jendela TMT <bulan>" atau
     "Terlambat". Contohnya golongan II/a dengan MKG 0, yang KGB pertamanya 12 bulan sesudah TMT CPNS. Label TMT di kanan
     atas kartu memakai bulan yang sama.
2. **Draf pegawai baru yang TMT KGB-nya belum dapat dihitung juga terlipat.** Misalnya TMT KGB terakhir atau
   golongannya belum diisi. Kartunya bertanda "TMT KGB belum terisi" dan menyarankan melengkapi drafnya.
3. **Kuncinya hanya di dasbor.** Pendataan pegawai baru tetap dapat disiapkan dan diajukan kapan saja lewat Pegawai
   Satker (saringan Belum tercatat) dan Usul KGB Kolektif (saringan Pegawai baru). Keduanya tidak memakai kunci ini.
4. **Tidak berubah:**
   - usulan yang dikembalikan Kanwil tetap tidak pernah dikunci;
   - draf perbaikan data pegawai yang TMT-nya tidak tercatat tetap tidak dikunci.

## Akibat

- Perlu dikerjakan hanya berisi pekerjaan jendela kirim berjalan, yang terlambat, dan yang dikembalikan.
- **Pendataan pegawai baru tidak lagi diingatkan di dasbor sebelum jendela KGB-nya.** Ia tetap terlihat di bagian Terkunci,
  di Pegawai Satker, dan di Usul KGB Kolektif. Bila Kanwil perlu menerima data pegawai baru lebih awal, UPT mengajukannya
  dari Usul KGB Kolektif.
- Panduan dan keterangan Unggah daftar diperbarui.
