# ADR-063: Usulan kolektif berfokus pada usul KGB; pegawai baru ikut bila dipilih

Tanggal: 5 Oktober 2026
Status: berlaku; menggantikan butir 2 dan 3 ADR-060

## Konteks

Pemilik menegaskan fungsi Usulan kolektif: usul KGB beberapa pegawai dalam satu surat Srikandi. Halaman itu sejak
ADR-015 juga menampung perbaikan data dan draf pegawai baru, dan ADR-060 membuatnya condong ke pendataan:

- draf pegawai baru hasil Unggah daftar **ikut tercentang** kecuali dikeluarkan satu per satu;
- bila tidak ada pegawai jatuh tempo, halaman **pindah sendiri** ke saringan Pegawai baru.

Akibatnya, sesudah Lapas Banjarmasin mengunggah 159 pegawai, setiap usul KGB periode berjalan membawa 159 nama itu ke
langkah Lengkapi. Pendataan bertahun-tahun (KGB mereka tersebar sampai 2028) tercampur dengan usul KGB bulan ini.

Pilihan yang ditimbang:
- fokus usul KGB, pegawai baru dipilih manual (dipilih);
- pendataan pegawai baru dipisah ke halaman tersendiri dengan suratnya sendiri (perubahan besar, belum perlu);
- tetap seperti sekarang.

## Keputusan

1. **Halaman dibuka pada saringan "Jatuh tempo TMT [bulan]"**, termasuk ketika belum ada pegawai jatuh tempo. Tautan
   pengingat (`?bulan=`) dan kartu Terlambat (`?terlambat=1`) tetap mencentang pegawai seperti sebelumnya.
2. **Draf pegawai baru tidak ikut kecuali dipilih** (`baruTerpilih`, bukan lagi `baruDikeluarkan`).
   - Kartu, Pilih semua, pencarian, dan status *siap / kurang n* pada saringan Pegawai baru tetap seperti ADR-060.
   - Di saringan lain satu baris ringkas memberi tahu: "n draf pegawai baru dari Unggah daftar tidak ikut surat ini
     kecuali dipilih", atau "n dari m pegawai baru ikut dipilih" bila sebagian dipilih.
   - *Kosongkan* mengosongkan keduanya.
3. **Unggah daftar menuju saringan Pegawai baru** (`/dashboard/upt/kolektif?saring=baru`), dan teksnya menyebut bahwa
   pegawai baru dipilih di sana dan boleh dikirim bertahap.
4. Kalimat pembuka halaman, komentar kepala berkas, dan Panduan menyebut fungsi utamanya: usul KGB dalam satu surat.

Perbaikan data tetap dapat dipilih lewat saringan *Ada draf* dan *Semua*. Pengajuan dari kolom Perlu dikerjakan di
dasbor (ADR-060 butir 5) tidak berubah.

## Akibat

- Usul KGB periode berjalan tidak lagi membawa pendataan pegawai baru tanpa diminta, dan langkah Lengkapi hanya berisi
  pegawai yang memang dipilih.
- Pendataan pegawai baru tetap lewat halaman yang sama dengan satu klik saringan, dan dapat dikirim bertahap.
