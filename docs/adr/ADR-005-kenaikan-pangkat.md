# ADR-005: Kenaikan pangkat dicatat di SIM-KGB karena mengubah dasar KGB

**Status:** Diterima
**Tanggal:** 23 September 2026
**Penentu:** Pemilik SIM-KGB (Tim SDM Kanwil Ditjenpas Kalimantan Selatan)
**Cakupan:** `lib/kenaikanPangkat.ts`, tabel `riwayat_pangkat`, API `/api/pegawai/[id]/pangkat`, tombol "Catat kenaikan pangkat" di Data Pegawai, dan tab Riwayat Pangkat

## Konteks

Pemilik membagikan **Buku Saku Digital Kenaikan Pangkat 2026** (Tim Pengendalian Kepangkatan, Biro SDMA ORTALA
Kementerian Imigrasi dan Pemasyarakatan). Kenaikan pangkat (KP) bukan urusan KGB, tetapi hasilnya mengubah
dasar perhitungan KGB: golongan, masa kerja golongan (MKG), dan gaji pokok.

Dua hal dari buku saku yang langsung menyentuh KGB:

1. **Potongan MKG saat pindah jenjang golongan.** KP I/d → II/a: MKG dikurangi 6 tahun. KP II/d → III/a: MKG
   dikurangi 5 tahun. Tanpa potongan ini, gaji pokok pada golongan baru salah baca dari tabel PP 5/2024.
   Aturan ini ternyata sudah ada di `lib/tabelGaji.ts` dan sudah dipakai formulir pegawai.
2. **Riwayat pangkat harus dapat ditelusuri.** Buku saku meminta pangkat pertama cocok dengan SK CPNS dan
   setiap perpindahan golongan sudah benar potongan MKG-nya. SIM-KGB hanya menyimpan golongan saat ini, jadi
   kesalahan tidak dapat ditelusuri.

Selain itu: periodisasi KP 12 periode setahun (usul tanggal 16 dua bulan sebelumnya sampai tanggal 1 bulan
sebelum TMT), syarat masa pangkat (reguler 4 tahun, fungsional 2 tahun, struktural 1 atau 4 tahun, KPPI 1
tahun), serta kewenangan SK (Kanwil III/d ke bawah, Biro SDMA IV/a–IV/b, BKN IV/c ke atas).

## Keputusan

1. **KP dicatat, bukan dipantau.** Tahap ini hanya mencatat SK KP yang sudah terbit beserta dampaknya pada
   data gaji. Pemantauan kelayakan KP (siapa sudah 4/2/1 tahun dalam pangkat, jendela usul per periode)
   sengaja belum dibuat; datanya sudah ada (`tmtGolongan`, `jenisJabatan`, `eselon`, `pendidikanTerakhir`)
   bila nanti diperlukan.

2. **Aturannya murni dan diuji** di `lib/kenaikanPangkat.ts`: jenis KP, urutan golongan, potongan MKG, gaji
   pokok baru, serta pembagian dampak pada KGB. Pratinjau di layar dan perhitungan di server memakai fungsi
   yang sama, sehingga yang dilihat Tim SDM sama dengan yang tersimpan.

3. **TMT KGB tidak diatur ulang oleh KP.** Siklus KGB tetap berjalan dari TMT KGB terakhir; yang berubah
   hanya dasar gajinya. Placeholder KGB "belum diproses" dihitung ulang dengan `rencanaSiklusBerikutnya`,
   memakai golongan dan MKG yang baru, tanpa menggeser tanggalnya.

4. **KGB yang sudah dikerjakan diperingatkan, bukan diubah diam-diam.** KGB berstatus "sedang diproses" atau
   "menunggu keuangan" dikembalikan sebagai daftar "perlu ditinjau": Tim SDM memilih membatalkan dan input
   ulang, atau melanjutkan SK yang telanjur ditandatangani. Keputusan ini diambil pemilik karena SK yang sudah
   diteken tidak boleh berubah sendiri.

5. **Letaknya di Data Pegawai**, sebagai tombol per baris, bukan modul tersendiri. Riwayatnya tampil sebagai
   tab "Riwayat Pangkat" pada halaman riwayat pegawai.

6. **Tabel `riwayat_pangkat`** menyalin nilai MKG dan gaji saat SK dicatat, sehingga perubahan tabel gaji
   berikutnya tidak mengubah riwayat. Migrasi: `supabase/migrations/20260923140000_riwayat_pangkat.sql`.

## Konsekuensi

- Data gaji pegawai setelah KP menjadi benar tanpa mengandalkan ingatan Tim SDM untuk memotong MKG sendiri.
- Audit log mencatat setiap KP beserta potongan MKG dan perubahan gajinya.
- Yang belum dikerjakan: pemantauan kelayakan dan periode usul KP, korelasi ijazah–pangkat sebagai peringatan
  batas pangkat tertinggi, serta pembacaan Kepmenimipas tentang pelimpahan kewenangan SDM (berkasnya hasil
  pindaian tanpa teks).
- Menambah tabel berarti tab baru pada backend Sheets dan basis data lokal perlu disiapkan lebih dulu
  (`scripts/setup-sheets.ts` atau `scripts/seed-lokal.ts`); di Supabase lewat migrasi.
