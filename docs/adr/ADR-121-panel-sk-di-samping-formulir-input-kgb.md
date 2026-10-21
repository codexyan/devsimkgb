# ADR-121: Panel SK di samping formulir Input KGB

Tanggal: 21 Oktober 2026
Status: berlaku

## Konteks

Banyak UPT mengisi data SK dasar dengan keliru, sehingga Super Admin dan tim yang didelegasikan (bekerja lewat akun
Super Admin) membetulkannya satu per satu. Alurnya bolak-balik: Input KGB menampilkan isian Atas dasar, lalu untuk
memeriksa dokumen SK dan membetulkan data kenaikan pangkat atau PMK operator harus keluar ke Data Pegawai, tab Pangkat &
PMK, lalu kembali dan membuka Input KGB lagi. Linimasa SK yang ada (ADR-062) hanya dapat dibaca dan dibuka di jendela
terpisah.

## Keputusan

1. **Input KGB menjadi dua kolom di layar lebar (900 px ke atas):** formulir di kiri, **panel SK** di kanan. Panel
   terbuka sejak awal; di layar sempit dibuka dengan tombol **Periksa SK & dokumen** dan tampil di bawah formulir.
   Tombol itu menggantikan **Lihat linimasa**; jendela Linimasa SK tetap dipakai Buat SK dan Perbaiki SK.
2. **Isi panel:** seluruh SK penetap gaji pokok (SK KGB, kenaikan pangkat, PMK; terbaru di atas) dengan peran masing-masing.
   Memilih satu SK menampilkan **dokumennya langsung** di bawah daftar (pindaian, atau draf yang dicetak ulang dari data
   surat), dan tabel **perbandingan** nomor, tanggal, TMT, dan penetap SK itu dengan isian formulir (sama atau beda).
3. **Pakai data SK ini** mengisi formulir dari SK terpilih. **Betulkan data SK** (kenaikan pangkat dan PMK) membuka jendela
   Ubah data SK yang sama dengan tab Pangkat & PMK (ADR-068), dengan isian lanjutan untuk Super Admin (ADR-118). Sesudah
   disimpan, panel dan perhitungan KGB dimuat ulang, dan hasil pembetulan ditulis di atas panel.
4. Hak tidak berubah: Input KGB tetap Super Admin dan Tim SDM KGB; isian lanjutan Ubah data SK hanya untuk Super Admin dan
   diperiksa server. Tiap pembetulan tercatat di Log Aktivitas atas nama akun yang mengerjakannya.
5. Jendela Ubah data SK dirender sebagai **saudara** modal Input KGB, bukan anaknya. Formulirnya sendiri akan mengirim
   submit yang menjalar lewat pohon React ke formulir Input KGB, sehingga Input KGB ikut tersimpan tanpa disengaja.

## Yang belum tercakup

- SK dasar pada Data Pegawai (acuan jadwal) belum dapat dibetulkan dari panel; barisnya hanya dibaca. Pembetulannya
  tetap lewat Ubah SK dasar di Data Pegawai.
- Buat SK dan Perbaiki SK belum memakai panel ini.
