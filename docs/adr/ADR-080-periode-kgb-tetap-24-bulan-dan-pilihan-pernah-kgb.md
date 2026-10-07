# ADR-080: Periode KGB tetap 24 bulan, dan pilihan "pernah KGB" disimpan

Tanggal: 7 Oktober 2026
Status: berlaku

## Konteks

Pengguna menyampaikan skema KGB untuk memastikan logika sistem:

1. Hukdis: masa kerja golongan tetap terhitung walau KGB tertunda 12 bulan.
2. Sudah pernah KGB: dasar SK KGB terakhir, atau SK KP/PI/PMK terbaru sesudahnya, yang "hanya memengaruhi MKG dan
   bukan memperbarui periodenya".
3. Belum pernah KGB: dasar SK CPNS, untuk CPNS II/a, II/c, dan III/a.

Pemeriksaan terhadap sistem menemukan:

- Hukdis sudah sesuai: masa tunda dihitung penuh sebagai masa kerja, lalu KGB kembali ke siklusnya.
- Tanggal KGB berikutnya dihitung "sampai MKG mencapai langkah tabel gaji berikutnya". Akibatnya PMK yang menambah masa
  kerja bukan kelipatan 2 tahun menggeser periode (contoh III/a, KGB terakhir 1 Des 2024, PMK TMT 1 Apr 2026 menjadi 6 th
  10 bln: KGB berikutnya 1 Jun 2027, bukan 1 Des 2026).
- Potongan masa kerja pada PI II→III yang melebihi masa kerjanya menampilkan "0 tahun 10 bulan".
- "Sudah pernah KGB" ditebak dari MKG > 0. Keliru untuk CPNS II/c (tabel II/c dimulai MKG 3; MKG 0 tidak punya gaji
  sehingga formulir menolaknya), CPNS yang masa kerja sebelumnya diperhitungkan, dan pegawai yang MKG-nya terpotong habis
  oleh PI. Akibatnya berkas yang ditagih tertukar (SK CPNS atau SK KGB terakhir).

Pilihan pengguna: jarak antar-KGB tetap 24 bulan; SK PMK menambah MKG dan gaji sejak TMT-nya tanpa menggeser periode
sedikit pun (contoh nyata yang sudah benar: Choirul Hermawan, S.AP.); PI dengan MKG kurang dari 5 tahun mempertahankan
jadwal lama; CPNS II/c bermasa kerja 3 tahun dengan KGB pertama 2 tahun; status pernah KGB dari pilihan UPT dan riwayat.

## Keputusan

1. **Jarak KGB** (`bulanKeKgbBerikutnya`, `lib/tabelGaji.ts`): KGB pertama sejak SK CPNS, yaitu selama MKG masih di
   langkah awal tabel golongannya, mengikuti tabel (II/a 12 bulan; III/a dan II/c 24 bulan). Sesudahnya selalu 24 bulan
   (`JARAK_KGB_BULAN`), termasuk bila MKG berbulan karena PMK. Semua penghitung jadwal (Input KGB, data pegawai, impor,
   usulan UPT, koreksi dasar gaji, simulasi KP) memakai fungsi ini.
2. **KGB yang tertunda kembali ke siklusnya** (`kalkulasiKGB`): bila jarak dari KGB terakhir lebih dari 24 bulan, masa
   kerjanya dihitung penuh dan KGB berikutnya jatuh `24 − (tunda mod 24)` bulan kemudian. Tertunda 12 bulan: KGB berikutnya
   12 bulan kemudian, sama seperti sebelumnya.
3. **PMK tidak menggeser jadwal** (`hitungPmk`): MKG bertambah sebesar tambahan PMK dan gaji pokok mengikuti MKG menurut SK
   PMK sejak TMT PMK; TMT KGB berikutnya tetap jadwal sebelum PMK. Pada KGB berikutnya masa kerja tambahan ikut terbawa;
   bila langkah tabelnya sudah dicapai lewat PMK, KGB itu tidak menaikkan gaji, dan kenaikan berikutnya 24 bulan kemudian.
   Berlaku juga untuk pegawai baru yang melaporkan SK PMK.
4. **Potongan MKG** (`hitungMKGKenaikanPangkat`): dihitung dalam bulan; yang melebihi masa kerjanya menjadi 0 tahun 0
   bulan. Jadwal KGB tetap (keputusan 1).
5. **Pilihan "pernah KGB" disimpan** pada usulan (`usulan_pegawai.keadaan_kgb`, "pernah" atau "belum"; migrasi manual
   `supabase/migrations/20261008090000_usulan_keadaan_kgb.sql`). Formulir dan Usul KGB Kolektif mengirimnya;
   `pernahKgbUsulan` memakainya untuk berkas yang ditagih. Isian awalnya: pilihan tersimpan, lalu SK KGB yang tercatat
   sebagai dasar (riwayat), lalu tebakan dari MKG terhadap langkah awal tabel golongannya (`pernahKgb(…, golongan)`).
   Sebelum migrasi dijalankan, simpanan diulang tanpa kolom itu (`lib/acuanUsulanServer.ts`).
6. **CPNS II/c**: tombol "Belum pernah KGB" dan penggantian golongan selama belum pernah KGB mengisi MKG langkah awal tabel
   golongannya (`mkgAwalGolongan`; II/c 3 tahun).

## Akibat

- Pegawai dengan MKG berbulan (sesudah PMK, atau CPNS yang masa kerja sebelumnya diperhitungkan) kini mendapat KGB setiap
  24 bulan, bukan saat MKG mencapai langkah tabel berikutnya. Kenaikan gajinya bisa lebih lambat daripada hitungan
  tabel; ini pilihan pengguna.
- KGB pertama CPNS yang masa kerja awalnya bukan langkah tabel belum dibahas pengguna (skema poin 2 terpotong); untuk
  sementara jaraknya 24 bulan.
- Jadwal yang sudah tersimpan tidak dihitung ulang; aturan baru berlaku pada perhitungan berikutnya.
- Admin perlu menjalankan migrasi `20261008090000_usulan_keadaan_kgb.sql` di Supabase.
