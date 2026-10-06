# ADR-073: Pengumuman perubahan untuk Admin UPT

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

ADR-072 mengganti nama dua menu Admin UPT (Data Pegawai menjadi Pegawai Satker, Usulan kolektif menjadi Usul KGB Kolektif)
dan menampilkan pegawai baru sebagai baris bertanda di tabel Pegawai Satker. Admin UPT yang sudah terbiasa dengan nama lama
perlu diberi tahu, dan pemberitahuan itu tidak boleh menjadi sebab data yang sudah mereka input hilang.

Pengguna meminta pop-up pengumuman bergerak yang menarik, dengan syarat tidak ada data yang hilang bila UPT sudah mengisi.

## Keputusan

1. **Pop-up tiga adegan bergerak** (`app/dashboard/components/upt/PengumumanUpt.tsx`), berganti sendiri tiap 7 detik:
   - **Nama menu berganti.** Label lama memudar, label baru muncul, disertai sapuan cahaya dan lencana "baru".
   - **Pegawai baru masuk ke tabel.** Berkas XLSX turun, lalu baris bertanda jatuh satu per satu ke tabel dengan
     status masing-masing, dan saringan "Belum tercatat" muncul.
   - **Data tetap aman.** Perisai bercentang dikelilingi lencana Draf, Usulan, dan Berkas yang mengorbit.

   Gerak seluruhnya CSS (`dasbor.css`, awalan `pmn-`), tanpa pustaka tambahan. Kontrolnya:
   - segmen kemajuan yang dapat diklik;
   - tombol jeda dan tutup;
   - Kembali dan Lanjut;
   - Escape dan jebakan fokus lewat `useDialogModal`.
2. **Gerak dikurangi tetap utuh.** Keadaan dasar tiap elemen adalah keadaan akhir animasinya. Pilihan Kurangi animasi
   (`html[data-gerak]`) atau pengaturan perangkat hanya mematikan animasinya, dan ketiga adegan tampil lengkap tanpa
   gerak. Auto-lanjut ikut berhenti, sebab digerakkan oleh akhir animasi segmen; pengguna berpindah dengan tombol.
3. **Aman terhadap isian** (`lib/pengumumanUpt.ts`, diuji):
   - Hanya untuk peran `admin_upt`.
   - Hanya di halaman tanpa isian: Dashboard, Pegawai Satker, dan Riwayat. Usul KGB Kolektif, Unggah daftar, Lapor
     Hukdis, dan Profil Saya tidak termasuk.
   - Tidak tampil di atas dialog lain, dan tidak selagi ada kolom yang sedang diketik. Pemeriksaannya diulang beberapa
     kali dalam sekitar 13 detik; bila tetap tidak memungkinkan, pengumuman ditunda ke kunjungan berikutnya.
   - Tidak menulis atau menghapus data apa pun. Satu-satunya yang dicatat adalah penanda "sudah dilihat" per pengguna
     dan per pengumuman di peramban. Bila penyimpanan peramban ditolak, penandanya berlaku selama sesi.
   - Tidak ada perubahan pada API, penyimpanan, rute, maupun templat Excel dalam rangkaian perubahan ini, jadi draf,
     usulan, berkas, dan templat yang sudah diunduh tetap berlaku.
4. **Dibuka lagi dengan tombol "Apa yang baru?"** di header halaman Pegawai Satker. Permintaan pengguna sendiri tidak
   melewati pemeriksaan di atas. Pengumuman baru dibuat dengan menaikkan `ID_PENGUMUMAN_UPT`, sehingga tampil lagi satu
   kali per pengguna.

## Akibat

- Admin UPT yang membuka Dashboard sesudah pembaruan melihat pengumuman satu kali. Menutupnya dengan cara apa pun
  menandainya sudah dilihat; tombol "Apa yang baru?" tetap tersedia.
- Pengumuman dicatat per peramban, bukan per akun di server. Admin UPT yang berganti komputer melihatnya sekali lagi.
  Penyimpanan di server akan menuntut kolom basis data baru dan migrasi manual, dan itu tidak sebanding dengan
  pengumuman satu kali.
