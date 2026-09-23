# ADR-004: Peran Admin UPT, akun lihat saja yang dibatasi satkernya sendiri

**Status:** Diterima
**Tanggal:** 23 September 2026
**Penentu:** Pemilik SIM-KGB (Tim SDM Kanwil Ditjenpas Kalimantan Selatan)
**Cakupan:** peran `admin_upt`, dashboard `/dashboard` varian UPT, API `/api/upt`, dan kolom `satker` pada tabel pengguna

## Konteks

Sampai ADR-003, seluruh akun SIM-KGB adalah akun Kanwil: Super Admin, SDM KGB, SDM Hukdis, dan Keuangan.
UPT tidak punya akses, sehingga setiap pertanyaan "KGB pegawai saya sudah sampai mana" dijawab lewat telepon
atau WhatsApp ke Tim SDM Kanwil. Padahal UPT-lah yang mengirim surat usulan KGB, tiga bulan sebelum TMT.

Pemilik memilih memberi UPT akun **lihat saja** yang dibatasi satkernya sendiri (opsi B pada pembahasan
22 September 2026), bukan akun yang bisa mengubah data. Surat resmi tetap lewat Srikandi, dan Tim SDM Kanwil
tetap satu-satunya yang mengubah data KGB.

## Keputusan

1. **Peran kelima `admin_upt`.** Peran ini sengaja tidak masuk ke helper hak akses mana pun di
   `lib/auth/roles.ts` (`canProcessKGB`, `canViewKGB`, `canEditPegawai`, `canManageHukdis`, `canAccessKeuangan`,
   `canKonfirmasiKeuangan`, `isSuperAdmin`), sehingga seluruh modul Kanwil menolaknya tanpa perubahan lain.
   Halaman Kanwil mengarahkannya kembali ke `/dashboard`.

2. **Kolom `satker` pada tabel pengguna** berisi kode satker (`lib/satker.ts`). Wajib untuk `admin_upt` dan
   selalu kosong untuk peran Kanwil (`nilaiSatkerUntukPeran`). Migrasi: `supabase/migrations/20260923090000_users_satker.sql`.
   Satker dibaca dari baris pengguna di basis data pada setiap permintaan, bukan dari token, agar perubahan
   satker oleh Super Admin langsung berlaku tanpa menunggu pengguna masuk ulang.

3. **Satu halaman dashboard.** Tidak ada menu Pegawai atau Arsip SK tersendiri. Isinya:
   - strip angka: usulan yang harus dikirim bulan ini, KGB yang sedang diproses Kanwil, selesai tahun ini, dan KGB ditunda;
   - daftar pegawai satker dengan TMT KGB, gaji pokok, dan status di Kanwil, dengan saringan dan pencarian;
   - jadwal usulan enam bulan ke depan (surat dikirim bulan ketiga sebelum TMT, diterima Kanwil paling lambat awal bulan kedua);
   - daftar SK yang sudah terbit, dengan tautan unduh bila berkasnya sudah diunggah.

4. **Gaji pokok ditampilkan.** Angkanya memang tertulis pada SK yang diunduh UPT, jadi menyembunyikannya
   tidak menambah perlindungan apa pun.

5. **Hukuman disiplin hanya sebagai "KGB ditunda".** Jenis, nomor SK, dan keterangan hukdis tidak pernah
   dikirim ke UPT. Penandanya hanya muncul bila hukdis masih berlaku dan memang menunda KGB (`kgbDitunda`).

6. **Unduhan SK hanya sesudah dikonfirmasi keuangan** (status selesai), lewat `/api/upt/sk/[id]` yang
   memeriksa satker pegawai dan status KGB (`bolehUnduhSkUpt`). Rute umum `/api/blob/download` menerima key
   berkas apa pun, jadi kini dibatasi ke daftar peran Kanwil (`bolehUnduhBerkasSk`).

7. **Akun dibuat Super Admin di menu Pengguna**, dengan pilihan peran Admin UPT dan satkernya. Tidak ada
   skrip pembuatan massal. Satker akun dapat dipindahkan lewat PATCH `/api/users/[id]`.

## Konsekuensi

- Aturan aksesnya murni dan diuji di `lib/aksesUpt.ts` beserta `lib/aksesUpt.test.ts`; `lib/auth/roles.test.ts`
  menjaga agar peran ini tetap ditolak seluruh modul Kanwil dan agar rute UPT memeriksa satker.
- Pratinjau PDF SK (`/api/kgb/[id]/pdf?preview=true`) dulu hanya menolak SDM Hukdis; sekarang memakai daftar
  peran (`canViewKGB`), sehingga peran baru tidak otomatis bisa membukanya.
- Peran ini belum berguna sampai pegawai UPT diimpor ke produksi. Per 22 September 2026 produksi baru berisi
  75 pegawai Kanwil.
- UPT tidak menerima notifikasi apa pun; daftar notifikasi untuk peran ini kosong.
- Batas berikutnya yang belum dikerjakan: berapa lama SK lama tetap dapat diunduh UPT (sekarang 60 SK terakhir).
