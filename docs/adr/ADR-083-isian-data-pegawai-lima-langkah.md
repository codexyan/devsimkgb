# ADR-083: Isian data pegawai lima langkah

Tanggal: 7 Oktober 2026
Status: berlaku

## Konteks

Formulir Tambah pegawai dan Perbarui data adalah satu jendela panjang berisi lima bagian sekaligus (Identitas, Jabatan,
Pangkat dan KGB, SK sesudah SK KGB terakhir, Berkas). Admin UPT tidak tahu harus mulai dari mana dan apa yang masih
kurang sampai menekan Simpan. Panel pegawai di Usul KGB Kolektif memuat isian yang sama dengan susunan lain, tanpa
Identitas dan Jabatan.

Pilihan pengguna: langkah demi langkah, dan Kolektif disamakan.

## Keputusan

1. **Lima langkah** sesuai skema Admin UPT (`app/dashboard/components/upt/langkahIsian.ts`): 1 Identitas, 2 Jabatan,
   3 Jenis KGB (keadaan, golongan, masa kerja, TMT, nomor dan tanggal SK acuan, beserta pindaian SK KGB terakhir atau
   SK CPNS), 4 SK sesudahnya (jawaban Ada/Tidak ada, isian SK, beserta pindaian SK kenaikan pangkat atau PMK), 5 Periksa
   & simpan (ringkasan per langkah, catatan untuk Kanwil, Pratinjau SK KGB).
2. **Satu aturan kelengkapan** (`cekIsianPegawai`), dipakai formulir dan Kolektif, menandai tiap syarat dengan
   langkahnya. Garis langkah (`GarisLangkah`) menampilkan ✓ untuk langkah lengkap, ! untuk yang kurang, dan nomor untuk
   langkah formulir baru yang belum dibuka; setiap langkah dapat diklik.
3. **Formulir**: tombol bawah Kembali / Simpan draf / Lanjut; Enter berpindah ke langkah berikutnya, dan di langkah 5
   menyimpan. Draf dan perbaikan data dibuka di langkah pertama yang masih kurang; pegawai baru mulai dari langkah 1.
   Draf tetap boleh disimpan dari langkah mana pun.
4. **Kolektif**: panel pegawai memakai langkah dan aturan yang sama, kini dengan isian Identitas dan Jabatan yang dapat
   disunting; dibuka di langkah pertama yang masih kurang, dengan tombol langkah sebelumnya/berikutnya dan pegawai
   berikutnya di langkah 5.

## Akibat

- Lingkaran kelengkapan di daftar Kolektif kini juga menghitung nama, NIP, dan jabatan pegawai baru, sama dengan yang
  ditagih server saat diajukan.
- Isian dan penyimpanan tidak berubah; yang berubah hanya susunan tampilannya.
