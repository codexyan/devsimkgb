# ADR-103: Pita Dasbor Admin UPT ringkas dalam tiga zona, kalender per bulan TMT, dan kartu papan tanpa garis samping

Tanggal: 11 Oktober 2026
Status: berlaku. Mengganti tata letak empat kartu pita jadwal dari ADR-101. Tahap, warna, hitung mundur, dan jendela
periode dari ADR-101 tetap dipakai.

## Konteks

Pengguna meninjau beberapa usulan mockup untuk kepala Dasbor Admin UPT, lalu memilih yang paling dekat dengan tampilan
produksi supaya pengguna UPT tidak kaget. Dari tinjauan itu ada empat permintaan:

1. **Kalender lebih informatif.** Harus memuat bulan lengkap Januari sampai Desember menurut bulan TMT, dengan jumlah
   yang perlu diajukan, sedang diproses, dan selesai.
2. **Satu tempat yang menjelaskan apa yang harus dikerjakan bulan ini dan untuk TMT kapan.**
3. **Pita yang minimalis tanpa ruang kosong**, dengan rincian lewat klik. Pada pita empat kartu, kartu bulan berjalan
   yang memanjang membuat kartu lain menyisakan ruang kosong.
4. **Kartu papan tanpa garis warna di sisi kiri.** Pengguna tidak menyukai pola itu.

## Keputusan

1. **Pita menjadi tiga zona sebaris** (`PitaJadwalUpt.tsx`):
   - **Jendela kirim bulan ini:**
     - cincin hitung mundur ke batas kirim surat, atau ke jendela berikutnya bila sudah ditutup;
     - "Kirim <bulan> untuk KGB TMT <bulan>", jumlah pegawai, dan batang tahap;
     - empat langkah: Surat, Ajukan, Kanwil, Rekon.
   - **KGB per bulan TMT:** dua belas batang bertumpuk Januari sampai Desember dengan warna tahap yang sama, dan pilihan
     tahun. Emas menandai jendela kirim, titik merah menandai yang terlambat, dan batang bergaris putus menandai yang
     jendelanya belum dibuka.
   - **KGB tahun ini:** cincin kemajuan seperti sebelumnya, ditambah tombol "N terlambat". Bila tidak ada yang terlambat,
     zona ini menampilkan tanda "Tidak ada yang terlambat".

   Bulan kirim berikutnya tidak lagi tampil sebagai kartu terpisah. Jumlahnya terbaca di batang kalender, dan hitung
   mundurnya muncul di cincin begitu jendela bulan ini ditutup.
2. **Rincian dibuka lewat jendela, bukan ditumpuk di pita:**
   - Batang bulan dan tombol terlambat membuka jendela periode yang sudah ada (ADR-101). Untuk satu bulan TMT, jendela
     itu kini menyebut jadwalnya: kirim surat, input SIM-KGB Kanwil, dan rekon Gaji Web.
   - Tombol **Rincian** membuka jendela baru "Bulan ini":
     - empat langkah lengkap beserta pelaku dan keadaannya;
     - "Juga bulan ini": rekon Gaji Web TMT bulan depan, yang suratnya dikirim bulan lalu;
     - tombol ke daftar pegawai dan ke Usul KGB Kolektif.
3. **Data kalender tanpa API baru** (`susunKalenderTmt`, `tahunKalenderTmt`, `rekonBulanIni`, `langkahJendela` di
   `lib/pitaJadwalUpt.ts`, diuji).
   - Sumbernya daftar pegawai dasbor yang sama dengan pita. Pegawai yang KGB-nya selesai tahun ini tetap tercatat di bulan
     TMT itu sampai masa usul siklus berikutnya dibuka (`pilihKgbSiklus`), jadi tahun berjalan dan tahun depan terbaca
     utuh.
   - Tahun lalu hanya ditawarkan bila masih ada pegawai yang tertinggal di tahun itu.
   - Langkah Surat dan Ajukan selesai bersamaan, sebab pengajuan selalu membawa nomor surat.
4. **Kartu papan UPT tanpa garis samping** (`KartuUpt`, kelas `upt-kartu`):
   - Keadaan menjadi pil berikon di kiri atas, sehingga tidak dibaca dari warna saja.
   - TMT dipindah dari baris keterangan ke kanan atas.
   - Kartu yang mendesak hanya diberi bingkai berwarna lembut, dan catatan masuk kotak tersendiri.
   - Kartu di dasbor peran lain tidak berubah.
5. **Subjudul di Perlu dikerjakan** (`kelompokKerja`, `susunKelompokKerja` di `lib/papanUpt.ts`, diuji):
   - Urutannya Terlambat, Dikembalikan Kanwil, Jendela TMT <bulan>, lalu Data pegawai lainnya (misalnya draf pegawai
     baru tanpa TMT).
   - Terlambat didahulukan karena selisihnya menjadi rapelan, dan yang dikembalikan menyusul karena Kanwil menunggu
     jawaban (ADR-090).
   - Isi kolom tidak berubah: draf yang masa usulnya belum dibuka tetap terlipat di "Terkunci sampai masa usul KGB"
     (ADR-059).

## Akibat

- Kepala dasbor lebih pendek dan padat. Ketiga zona sama tinggi, jadi tidak ada lagi kartu yang menyisakan ruang kosong.
- Jumlah "terlambat" memakai definisi yang sama dengan kartu Terlambat sebelumnya: TMT sudah lewat jendela kirim dan
  KGB-nya belum selesai, termasuk yang sudah di Kanwil. Keterangan di bawah angkanya menyebut berapa yang masih perlu
  diusulkan.
- Kalender hanya mencakup pegawai aktif di daftar dasbor. KGB tahun lalu yang sudah selesai tidak ditampilkan, karena
  daftar itu memuat siklus berjalan saja. Bila riwayat bertahun-tahun dibutuhkan, angkanya perlu dari rekap per bulan di
  server (`rekapPerBulanTmt`).
- Pada layar sedang, kalender turun ke baris kedua. Di ponsel ketiga zona bertumpuk dan batang tetap dua belas.
- Tidak ada perubahan skema, migrasi, maupun data.
