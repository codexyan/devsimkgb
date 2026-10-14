# ADR-114: Proyeksi sementara jadwal KGB dari laporan hukdis yang menunggu Kanwil

Tanggal: 13 Oktober 2026
Status: berlaku. Melengkapi ADR-016 (laporan hukdis UPT) dan ADR-113 (pegawai terdata lebih awal). Sisi peninjau Kanwil: ADR-116.

## Konteks

Pegawai yang masih jauh dari masa usul KGB (lebih dari dua bulan sebelum TMT) tetap dapat dilaporkan hukdisnya: Lapor Hukdis
menampilkan semua pegawai aktif satker, dan SDM Hukdis Kanwil mencatat hukumannya tanpa syarat masa itu (`rencanaPenundaanHukdis`
menggeser TMT dan membuat ulang jadwal Belum Diproses; satu-satunya penolakan khusus adalah hukdis yang mulai sesudah TMT KGB
yang belum diinput). Dengan ADR-113, draf pegawai baru yang data utamanya terisi sudah ikut terdata, sehingga ikut dapat dilaporkan.

Yang belum ada: selama laporan masih **menunggu** Kanwil, jadwal pegawai belum berubah, sehingga UPT tidak dapat memetakan kapan
KGB-nya jatuh tempo bila hukumannya menunda KGB. Pita dan kalender baru bergeser setelah dicatat.

## Keputusan (pemilik, 13 Oktober 2026)

1. **Proyeksi sementara, hanya tampilan.** Untuk tiap laporan hukdis UPT yang berstatus `menunggu`, server menghitung perkiraan
   jadwal dengan perencana yang sama dengan pencatatan (`proyeksiLaporanHukdis`, `lib/proyeksiHukdis.ts`). Tidak ada yang ditulis:
   data pegawai, jadwal, dan hitungan pita (jumlah per tahap, batang per bulan TMT) tidak berubah sebelum Kanwil mencatat.
2. **Satu aturan dampak jenis.** `dampakJenisHukdis` (menunda atau tidak, dan berapa bulan, dengan bawaan 12 bulan dan kode
   `penundaan_kgb` bila tanpa katalog) dipakai bersama pencatatan (`lib/catatHukdis.ts`) dan proyeksi, supaya perkiraan tidak
   berbeda dari hasil. Uji menjalankan pencatatan nyata dan membandingkan TMT-nya dengan perkiraan.
3. **Tiga hasil.** `geser` (TMT KGB berikutnya dari X ke Y, beserta bulan penundaan), `tidak_menunda` (jenisnya tidak menunda
   KGB), dan `tolak` (Kanwil belum dapat mencatatnya pada keadaan sekarang, mis. KGB yang jatuh tempo lebih dulu belum diinput;
   UPT hanya melihat kalimat pertama alasannya).
4. **Di mana tampil** (memakai gaya teks kecil yang sudah ada, tanpa komponen baru):
   - Pegawai Satker: baris kecil di bawah TMT KGB, "Laporan hukdis menunggu Kanwil: bila dicatat, KGB bergeser ke <bulan tahun>".
   - Daftar pegawai pada periode di pita (jendela yang dibuka dari batang bulan) dan kartu draf di Perlu dikerjakan: teks yang sama.
   - Daftar laporan di Lapor Hukdis: perkiraan lengkap (dari bulan X ke Y, berapa bulan), atau penjelasan bila tidak menunda atau
     belum dapat dicatat.
5. **Perkiraan, bukan keputusan.** Kanwil dapat mengubah jenis, masa penundaan, atau tanggal setelah mencocokkan dengan SK, dan
   yang berlaku adalah hasil pencatatan. Teks menyebutnya "bila dicatat", dan catatan di formulir laporan menjelaskan hal ini.
6. **Tidak menggeser jadwal dari laporan UPT.** Pembagian wewenang ADR-016 dan ADR-039 tetap: hanya SDM Hukdis yang mencatat dan
   menggeser jadwal.

## Akibat dan batasan

- Pita dan kalender tidak memindahkan pegawai ke bulan proyeksi; hanya daftar yang dibuka dari batang dan tabel yang menyebutnya.
  Memindahkannya akan mengubah hitungan "perlu diusulkan" yang menjadi dasar kerja operator, padahal keputusannya belum diambil Kanwil.
- Laporan berstatus `dikembalikan` tidak diproyeksikan (UPT sedang memperbaikinya), dan laporan yang sudah dicatat memakai jadwal
  pegawai yang sudah bergeser.
- Draf yang data utamanya belum terisi tidak punya baris pegawai (ADR-113), jadi belum dapat dilaporkan maupun diproyeksikan.
- Tidak ada migrasi dan tidak ada kolom baru.

## Uji

`lib/proyeksiHukdis.test.ts`: dampak jenis; pegawai yang jauh dari masa usul bergeser tanpa syarat masa 2 bulan; jenis yang tidak
menunda; hukdis yang mulai sesudah TMT ditolak; KGB yang sedang diproses; dan perkiraan dari laporan menunggu sama dengan hasil
`catatHukdis` (laporan yang sudah dicatat atau milik satker lain tidak ikut). Tampilan diperiksa di aplikasi lokal sebagai Admin UPT.
