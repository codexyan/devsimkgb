# ADR-086: Pejabat penetap SK KGB terakhir (atau SK CPNS) pada isian UPT

Tanggal: 8 Oktober 2026
Status: berlaku

## Konteks

Langkah 3 isian data pegawai (ADR-083) menanyakan nomor dan tanggal SK KGB terakhir, atau SK CPNS bagi yang belum pernah
KGB, tetapi tidak menanyakan **siapa penetapnya**. Saat usulan disetujui, penetap SK dasar pegawai dibiarkan kosong untuk
diisi Tim SDM saat Input KGB (ADR-056). Bila kosong, pratinjau dan SK KGB mencetak baris "Oleh Pejabat" dengan isian
bawaan "Kepala Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan" (lib/dataSuratKgbServer.ts).

Isian bawaan itu keliru untuk SK yang terbit sebelum Kanwil Ditjenpas berdiri. Contohnya SK KGB 21 Oktober 2024 bernomor
W.19.PAS…: W.19 adalah kode Kanwil Kemenkumham Kalimantan Selatan. Bagi SK CPNS, penetapnya lazim Menteri. Tanpa isian
dari UPT, SK KGB berikutnya dapat terbit dengan "Oleh" yang salah bila Kanwil lupa membetulkannya.

Pilihan pengguna: isian wajib berupa daftar pilihan yang bisa diketik bebas, dengan saran otomatis dari awalan nomor SK.

## Keputusan

1. **Isian "Oleh (pejabat penetap SK KGB terakhir)"**, atau "… SK CPNS", ditempatkan di langkah 3 di bawah nomor dan
   tanggal SK, pada formulir Tambah pegawai / Perbarui data maupun Usul KGB Kolektif. Pilihannya diambil dari
   `SARAN_PENETAP_SK` dan boleh diketik bebas. Isian ini wajib dan dicek di langkah 3 (`cekIsianPegawai`).
2. **Saran dari awalan nomor** (`saranPenetapDariNomor`, lib/penetapSk.ts):
   - WP.19 → Kepala Kanwil Ditjenpas Kalimantan Selatan.
   - W.19 → Kepala Kanwil Kemenkumham Kalimantan Selatan.
   - Nomor lain tidak diberi saran.

   Saran mengisi isian yang kosong, atau yang masih berupa saran dari nomor sebelumnya. Pejabat yang dipilih atau
   diketik sendiri tidak ditimpa. Keterangan di bawah isian menyebut bila isinya saran, supaya UPT mencocokkannya
   dengan SK.
3. **Disimpan di usulan** sebagai kolom `penetap_sk_terakhir` (migrasi `20261008150000_usulan_penetap_sk_terakhir.sql`).
   - Ikut sebagai bawaan pada usulan perbaikan berikutnya, bersama nomor dan tanggal SK dasar.
   - Ikut pula saat usulan yang sudah disetujui dikembalikan ke UPT.
4. **Saat disetujui** (`penetapSesudahUsulan`):
   - Isian UPT menjadi `penetapSkDasar` pegawai, yaitu baris "Oleh" SK KGB berikutnya.
   - Usulan lama tanpa isian itu, bila nomor SK-nya baru, memakai saran dari nomornya. Tanpa saran, isiannya dikosongkan
     dan diisi Kanwil saat Input KGB.
   - Bila nomornya sama dengan yang tercatat, penetap tercatat dibiarkan.
   - Pratinjau SK usulan memakai aturan yang sama.
5. **Server ikut menagih** (`kekuranganUsulan`). Bila nomor SK acuan terisi, penetapnya harus ada:
   - dari isian UPT;
   - dari saran nomornya;
   - atau dari yang sudah tercatat untuk nomor yang sama.

   Draf lama bernomor W.19/WP.19 tidak perlu diketik ulang.
6. Kanwil melihat penetapnya di rincian usulan: "SK dasar dari UPT: nomor, tanggal, oleh …".

## Akibat

- **Migrasi `20261008150000_usulan_penetap_sk_terakhir.sql` harus dijalankan manual.** Sebelum itu, simpanan usulan
  diulang tanpa kolom ini (lib/acuanUsulanServer.ts). Persetujuan lalu memakai saran dari awalan nomor.
- Draf lama yang nomor SK-nya tanpa saran (bukan W.19/WP.19) kini ditagih isian "Oleh" sebelum diajukan.
- Saran dari awalan nomor tidak selalu tepat. SK bernomor W.19 tertentu ditetapkan pejabat lain, misalnya kepala UPT.
  Karena itu saran hanya mengisi lebih dulu, dan keterangannya meminta UPT mencocokkan dengan SK.
- Cloudflare D1 (ADR-085, sedang disiapkan) wajib memuat kolom yang sama. lib/db/d1/skema.test.ts menagihnya.
