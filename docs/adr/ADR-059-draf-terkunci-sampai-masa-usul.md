# ADR-059: Draf usulan data terkunci di dasbor sampai masa usul KGB-nya

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

ADR-057 menjelaskan bahwa kartu draf di kolom **Perlu dikerjakan** adalah usulan data, bukan usulan KGB. Kartu
itu kini menyebut kapan KGB pegawainya diusulkan. Meski begitu, draf untuk KGB yang masih jauh (contoh nyata: TMT
Januari 2028, dilihat Oktober 2026) tetap berdiri sejajar dengan pekerjaan yang benar-benar jatuh tempo, dan tetap
dapat dicentang untuk diajukan dengan surat Srikandi bulan ini.

Pemilik produk memutuskan draf seperti itu **dikunci di dasbor saja**. Draf dibuka ketika KGB-nya masuk masa usul,
yaitu bulan kirim surat usulan: 2 bulan sebelum TMT.

## Keputusan

1. **Draf perbaikan data dikunci** bila masa usul KGB pegawainya belum dibuka, yaitu bila bulan TMT KGB-nya lebih akhir
   daripada bulan usulan yang sedang berjalan (`drafTerkunci`, `lib/tugasUpt.ts`). Draf terbuka sendiri pada bulan
   kirimnya. Contoh: KGB Januari 2028 terbuka November 2027, dan yang sudah lewat tetap terbuka.
2. **Tidak pernah dikunci:**
   - **draf pegawai baru**, karena datanya belum ada di Kanwil sama sekali. Pendataan tidak boleh menunggu jadwal
     KGB, misalnya 160 pegawai Lapas Banjarmasin yang KGB-nya tersebar sampai 2028;
   - **usulan yang dikembalikan Kanwil**, karena sudah pernah dikirim dan perbaikannya sedang ditunggu;
   - **pegawai tanpa TMT KGB.**
3. **Kunci hanya berlaku di dasbor.**
   - Draf terkunci tampil terlipat di bawah Perlu dikerjakan ("Terkunci sampai masa usul KGB"), tanpa kotak
     centang, dengan keterangan kapan dibuka.
   - Hitungan kolom dan tombol Ajukan hanya memperhitungkan yang dapat dikerjakan sekarang.
   - Usulan kolektif dan Data Pegawai tetap dapat mengajukannya bila perbaikannya mendesak; server tidak menolak.
   - Draf yang terkunci tetap dapat diubah dan dihapus.
4. **Draf terkunci memakai kolom data sendiri (`kunci`) dengan prioritas paling rendah** dalam penggabungan kartu per
   pegawai (`lib/papanUpt.ts`). Pegawai yang sekaligus punya SK terbit yang harus direkam di Gaji Web tetap tampil di
   kolom SK terbit. Draf terkuncinya hanya disebut sebagai "Juga: draf data terkunci sampai …", bukan menyeret kartu
   SK-nya ikut terlipat.

## Akibat

- Perlu dikerjakan hanya berisi yang perlu dikerjakan bulan ini. Draf yang ditunda tidak hilang: saat bulan
  kirimnya tiba, draf itu naik ke daftar biasa, dan Usulan kolektif mode periode memuatnya bersama pegawai yang jatuh
  tempo.
- Uji lokal Admin UPT:
  - draf untuk KGB Oktober 2026 (masa usul terbuka) tetap bercentang;
  - draf untuk KGB Januari 2028 terlipat dengan tanda "Terkunci sampai Nov 2027" tanpa centang;
  - hitungan kolom 1.
