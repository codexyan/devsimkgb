# ADR-060: Pegawai baru di Usulan kolektif dapat dicari dan dipilih; pencarian di Perlu dikerjakan

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Sesudah Lapas Banjarmasin mengunggah daftar pegawainya, halaman **Usulan kolektif** menampilkan 159 draf pegawai baru
sebagai satu kalimat: "159 pegawai baru dari Unggah daftar ikut otomatis: AKHMAD …, BAGUS …, …". Akibatnya:

- seluruh namanya menjadi dinding teks;
- kotak cari tidak menjangkau mereka (mencari "faridah" tetap menjawab "Tidak ada pegawai dengan KGB TMT Des 2026");
- semuanya **dipaksa** ikut, sehingga tidak dapat diajukan bertahap;
- saringan bawaan "Jatuh tempo" kosong, karena satker itu baru punya satu pegawai yang tercatat.

Kolom **Perlu dikerjakan** di dasbor juga berisi ratusan kartu tanpa cara mencarinya.

## Keputusan

1. **Saringan baru "Pegawai baru"** di Usulan kolektif. Draf pegawai baru tampil sebagai kartu yang sama dengan pegawai
   tercatat:
   - centang, nama, NIP, golongan;
   - status *siap* / *kurang n* (rinciannya di tooltip) / *dikembalikan*;
   - "Pilih semua / Batalkan semua" berlaku untuk yang sedang tampil.
2. **Draf pegawai baru tetap ikut secara bawaan**, tetapi kini dapat dikeluarkan satu per satu (`baruDikeluarkan`).
   Draf yang baru dimuat ulang tetap ikut. "Kosongkan" mengosongkan keduanya.
3. **Halaman dibuka pada saringan Pegawai baru** bila tidak ada pegawai jatuh tempo dan ada draf pegawai baru (lazimnya
   sesudah Unggah daftar), kecuali dibuka dari tautan pengingat. Pada saringan lain, pegawai baru diringkas satu baris:
   "n dari m pegawai baru ikut dipilih. Lihat pegawai baru".
4. **Kotak cari di langkah Lengkapi** bila barisnya lebih dari delapan.
5. **Kotak cari di kolom Perlu dikerjakan** (nama atau angka NIP), menempel di atas saat digulir, bila kartunya lebih dari
   empat. Bersamanya ada **"Centang n yang siap"**: mencentang seluruh draf lengkap yang sedang tampil. Pencarian ikut
   menyaring kelompok terkunci (ADR-059) dan membukanya.
6. Memo manual `kelompokPilih` dilepas: React Compiler tidak dapat mempertahankannya, dan daftarnya cukup kecil untuk
   dihitung ulang tiap render.

## Akibat

- Uji lokal Admin UPT dengan 12 draf pegawai baru dan 3 draf perbaikan siap:
  - halaman terbuka pada "Pegawai baru 12";
  - mencari "faridah" menyisakan satu kartu, dan mengeluarkannya membuat pilihan menjadi 11;
  - langkah Lengkapi menampilkan kotak cari;
  - di dasbor, "Centang 4 yang siap" mengisi tombol menjadi "Ajukan 4 ke Kanwil", dan mencari "putri" menyisakan satu
    kartu.
