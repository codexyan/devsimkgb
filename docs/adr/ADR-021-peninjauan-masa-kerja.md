# ADR-021: Peninjauan masa kerja (PMK) dicatat di Data Pegawai dan dapat menggeser jadwal KGB

Tanggal: 28 September 2026
Status: berlaku; tahap 2 dari ADR-020. Dapat juga dicatat dari usulan UPT sejak ADR-030

## Konteks

SK peninjauan masa kerja (PMK) menambah masa kerja golongan (MKG) pegawai, misalnya dengan memperhitungkan masa
kerja sebelum CPNS, dan menetapkan gaji pokok baru. Data pegawai menyimpan MKG pada TMT KGB terakhir, dan KGB
berikutnya jatuh saat MKG mencapai langkah berikutnya di tabel gaji PP 5/2024. Berbeda dengan kenaikan pangkat,
PMK dapat membuat langkah itu tercapai lebih cepat, sehingga jadwal KGB bergeser.

## Keputusan

1. **Pencatatan.** Tabel baru `riwayat_pmk`. Tim SDM mencatat PMK dari Data Pegawai (tombol "Catat peninjauan
   masa kerja") dengan nomor, tanggal, dan TMT SK, pejabat penetap, serta **MKG pada TMT PMK menurut SK**.
2. **Hitungan** (`lib/pmk.ts`, murni dan teruji):
   - MKG sebelum PMK pada TMT PMK = MKG pada data pegawai ditambah jarak dari TMT KGB terakhir ke TMT PMK.
   - Tambahan PMK = MKG menurut SK dikurangi MKG sebelum PMK; harus lebih dari nol.
   - MKG pada data pegawai bertambah sebesar tambahan itu. Gaji pokok dibaca dari tabel PP 5/2024 dengan MKG
     menurut SK.
   - Usulan TMT KGB berikutnya = TMT PMK ditambah jarak ke langkah tabel berikutnya dari MKG menurut SK. Tim SDM
     dapat mengoreksinya sesuai SK PMK; tanggal itu harus sesudah TMT PMK.
   - PMK yang TMT-nya sebelum TMT KGB terakhir ditolak: KGB itu sudah dihitung tanpa PMK dan harus dikoreksi
     lebih dulu.
3. **Akibat pada KGB**, sama dengan kenaikan pangkat (ADR-005): jadwal "belum diproses" disusun ulang pada TMT
   yang baru; KGB yang sedang diproses atau menunggu keuangan dikembalikan sebagai daftar "perlu ditinjau".
4. **Atas dasar** (ADR-020): Input KGB membandingkan SK KGB terakhir, SK kenaikan pangkat, dan SK PMK; yang
   TMT-nya paling baru menjadi Atas dasar. Baris "Masa kerja golongan pada tanggal tersebut" di SK KGB kini
   mencetak MKG pada TMT SK dasar (`mkgPadaSkDasar`), bukan MKG pada TMT KGB terakhir, bila SK dasarnya jatuh
   di tengah siklus. SK KGB yang berdasar SK KGB terakhir tidak berubah.

## Akibat

- Migrasi `20260928110000_riwayat_pmk.sql` wajib dijalankan di Supabase **sebelum** kodenya di-deploy.
- Riwayat PMK ikut cadangan data bulanan untuk Super Admin dan Tim SDM KGB.
- Riwayat pegawai menampilkan PMK pada tab "Pangkat & PMK".
- PMK yang tercatat di formulir inventarisasi KGB tidak otomatis masuk riwayat ini; Tim SDM mencatatnya dari Data
  Pegawai setelah memeriksa SK-nya.
