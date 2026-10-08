# ADR-090: Kartu papan Alur KGB Admin UPT ditandai dan diurutkan menurut tindakan UPT

Tanggal: 8 Oktober 2026
Status: berlaku. Menerapkan rancangan ADR-089 (papan Kanwil) ke papan Admin UPT.

## Konteks

Papan Kanwil sudah menandai kartu menurut siapa yang harus bertindak (ADR-089). Pengguna meminta papan Admin UPT
dimodernkan dengan cara yang sama. Di papan UPT, keadaan kartu hanya terbaca dari penanda kecil. Kartu yang menunggu
Kanwil tampak setara dengan yang menunggu UPT. Draf yang sudah lengkap berada di bawah draf yang belum lengkap.

## Keputusan

1. **Label keadaan** di atas nama, **garis kiri**, dan **tombol utama** (`KartuUpt`):
   - **Merah:** *Dikembalikan* (usulan direvisi Kanwil) dan *Laporan dikembalikan*. Tombol utamanya Perbaiki.
   - **Hijau:**
     - *Siap diajukan*: centang lalu Ajukan.
     - *Siap direkam*: SK terbit yang berkasnya sudah ada. Tombol utamanya **Sudah direkam di Gaji Web**, hijau
       penuh, dan Unduh SK menjadi tombol kedua.
   - **Kuning:**
     - *Periksa SK*, atau *Periksa lagi* untuk SK yang sudah diperbaiki. Tombol utamanya Periksa SK.
     - *Belum lengkap* dan *Perlu diperiksa*, hanya sebagai label. Tombol utamanya Lengkapi atau Perbarui data.
   - **Redup** (bingkai putus-putus): kartu yang menunggu Kanwil. Termasuk di sini usulan yang ditinjau, data disetujui
     yang menunggu proses, laporan yang ditinjau, SK yang sedang dibuat atau dicetak Kanwil, dan SK terbit yang berkasnya
     belum diunggah Tim SDM.
2. **Urutan Perlu dikerjakan:**
   1. dikembalikan, termasuk laporan;
   2. siap diajukan;
   3. belum lengkap;
   4. perlu diperiksa.

   Urutan ini mengubah `URUTAN` di `lib/tugasUpt.ts`: siap diajukan kini mendahului belum lengkap, sebab paling cepat
   selesai. Dalam tiap kelompok, TMT terdekat tetap lebih dulu.
3. Penanda yang hanya mengulang label dihapus, misalnya "Review SK KGB" dan "Siap direkam di Gaji Web".

## Akibat

- Hanya tampilan dan urutan. Alur, aturan, dan data tidak berubah, dan tidak ada migrasi.
