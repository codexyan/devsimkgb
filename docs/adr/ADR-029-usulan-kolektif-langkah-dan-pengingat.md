# ADR-029: Usulan kolektif tiga langkah dan pengingat masa kirim usulan untuk Admin UPT

Tanggal: 28 September 2026
Status: berlaku; mengubah tampilan ADR-015

## Konteks

- **Usulan kolektif (ADR-015) sulit dipakai.** Isinya satu tabel lebar (±1.330 px) yang harus digulir mendatar,
  dengan sekitar sepuluh isian per baris dan kolom gaji pokok terpotong. Pilihan pegawainya berupa kisi centang
  tanpa pengelompokan, dan ketiga langkahnya bertumpuk di satu halaman panjang. Di ponsel hampir tidak dapat
  dipakai.
- **Tidak ada pengingat aktif.** Admin UPT tidak diingatkan saat masa kirim surat usulan (tanggal 1 sampai 10
  bulan kedua sebelum TMT) dibuka. Pita jadwal di dashboard hanya teks pasif.

## Keputusan (pemilik, 28 September 2026)

1. **Tiga langkah dengan penanda langkah** di atas halaman, masing-masing dengan ringkasannya: jumlah dipilih,
   jumlah lengkap, dan jumlah siap diajukan.
   1. **Pilih pegawai:**
      - pegawai dikelompokkan per bulan TMT, dengan saringan *Jatuh tempo TMT (bulan usulan)*, *Ada draf*, dan
        *Semua*;
      - kartu dapat dipilih, dengan tanda *ada draf*, *dikembalikan*, atau *ditinjau Kanwil*;
      - tombol *Pilih semua* tersedia per bulan.
   2. **Lengkapi:**
      - daftar pegawai terpilih di kiri, dengan lingkar kelengkapan (isian dasar gaji dan berkas wajib);
      - detail satu pegawai di kanan: keadaan KGB, isian dasar gaji yang ditandai bila berubah, gaji pokok dan KGB
        berikutnya hasil hitungan, kotak berkas tarik-lepas, dan catatan untuk Kanwil;
      - tanpa gulir mendatar; di ponsel daftar menjadi baris geser di atas detail.
   3. **Ajukan:** pilih draf yang siap, lalu isi nomor, tanggal, dan berkas surat, dengan ringkasan pengajuan.

   Bilah aksi (Simpan draf, Lanjut) menempel di bawah panel. Penyimpanan dan pengajuan tetap lewat rute yang sama
   (`/api/upt/usulan`, `/api/upt/usulan/ajukan`), jadi aturan kelengkapan tidak berubah.
2. **Pengingat masa kirim** berupa jendela pop-up di dashboard Admin UPT (`PengingatUsulan`):
   - **Kapan tampil:** sejak masa kirim dibuka (tanggal 1) sampai tanggal 10, selama masih ada pegawai KGB TMT
     bulan usulan yang belum diajukan.
   - **Siapa yang terhitung belum diajukan:** tidak ada usulan yang ditinjau Kanwil atau diajukan sejak awal
     bulan, dan Kanwil belum memproses KGB-nya.
   - **Isinya:** batas tanggal dan sisa hari, jumlah pegawai jatuh tempo dan yang belum diajukan, daftar
     namanya, serta tombol *Siapkan usulan kolektif*. Tombol itu membuka `/dashboard/upt/kolektif?bulan=yyyy-mm`
     dengan pegawai tersebut sudah tercentang.
   - **Frekuensi:** tampil sekali per periode per perangkat, lalu tidak tampil lagi setelah ditutup atau diikuti.
     Tanda ini disimpan di `localStorage` sebagai kunci per satker dan bulan TMT.

## Akibat

- Tidak ada rute, skema, atau cron baru.
- Karena tanda ditutupnya disimpan di peramban, pop-up dapat tampil sekali lagi di perangkat lain.
- Pengingat menjelang batas dan tanda terlambat belum dibuat. Pemilik hanya memilih pengingat saat masa kirim
  dibuka.
