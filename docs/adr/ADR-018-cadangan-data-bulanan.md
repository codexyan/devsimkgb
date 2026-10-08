# ADR-018: Cadangan data bulanan wajib untuk semua peran

Tanggal: 27 September 2026
Status: berlaku

## Konteks

SIM-KGB masih disempurnakan, dan beberapa perubahan besar (usulan UPT, keuangan per satker, modul hukdis UPT)
masuk dalam hitungan minggu. Bila terjadi kekeliruan data atau gangguan layanan, satker dan Kanwil perlu
memegang salinan data mereka sendiri. Sebelumnya hanya ada ekspor CSV data pegawai untuk Tim SDM.

## Keputusan

1. **Wajib paling tidak sebulan sekali, untuk semua peran.** `lib/cadangan.ts` menghitung keadaan tiap akun:
   - *aman*: kurang dari 25 hari sejak cadangan terakhir.
   - *ingat*: hari ke-25 sampai ke-29. Spanduk pengingat tampil di setiap halaman dashboard.
   - *wajib*: hari ke-30 dan seterusnya. Jendela `PengingatCadangan` menahan dashboard sampai cadangan
     diunduh. Penundaan 24 jam boleh dipakai sekali untuk tiap jatuh tempo. Halaman *Cadangkan data* sendiri
     tidak pernah ditahan.
   - Akun yang belum pernah mencadangkan dihitung sejak fitur ini berlaku (27 September 2026), atau sejak
     akunnya dibuat bila lebih baru, sehingga peluncuran tidak langsung menahan semua akun.
2. **Isi mengikuti hak akses** (`CAKUPAN_PERAN`, disaring server di `lib/cadanganServer.ts`):

   | Peran | Isi cadangan |
   |---|---|
   | Super Admin | Semua data, termasuk akun pengguna tanpa sandi |
   | SDM KGB | Pegawai, riwayat KGB dan SK, kenaikan pangkat, mutasi, usulan dan laporan mutasi UPT |
   | SDM Hukdis | Pegawai, hukdis, dan laporan hukdis UPT |
   | Keuangan | Pegawai Kanwil beserta KGB dan SK-nya (ADR-009) |
   | Admin UPT | Pegawai satkernya beserta KGB, SK, usulan, dan laporan. Hukdis hanya sebatas status dan dampaknya (ADR-016) |

3. **Bentuk:** satu ZIP berisi CSV per jenis data (BOM UTF-8, NIP sebagai teks Excel), folder `sk/` berisi
   PDF SK KGB yang sudah terbit (boleh dilepas), dan `BACA-SAYA.txt`. Berkas usulan dan pindaian SK hukdis
   tidak ikut, agar ukurannya wajar bagi koneksi UPT.
4. **Disusun di peramban.** Setiap jenis data diminta lewat `GET /api/cadangan/[jenis]`, dan PDF lewat rute
   unduh SK yang sudah ada. ZIP disusun dengan `fflate` di peramban, karena Worker Cloudflare punya batas CPU
   per permintaan.
5. **Pencatatan:** `POST /api/cadangan` mengisi `users.cadangan_terakhir_at` dan mencatat log aktivitas.
   - Peramban juga mencatatnya di `localStorage`. Bila kolom belum dimigrasikan, pengingat di perangkat itu
     tetap mengenali cadangannya.
   - Menu Pengguna (Super Admin) menampilkan cadangan terakhir tiap akun dan menandai yang lewat batas.

## Akibat

- Migrasi `20260927200000_cadangan_pengguna.sql` (satu kolom) harus dijalankan agar kepatuhan tercatat di server.
- Berkas cadangan memuat data pribadi pegawai. Halaman cadangan dan `BACA-SAYA.txt` meminta pengguna
  menyimpannya di tempat aman dan tidak membagikannya.
- Kewajiban ini ditinjau ulang setelah SIM-KGB dinyatakan stabil.
- Sejak ADR-084 server juga mencadangkan seluruh basis data dua kali sehari ke R2. Cadangan bulanan per akun tetap
  berlaku sebagai salinan di luar akun Cloudflare dan Supabase.
