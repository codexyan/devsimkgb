# ADR-098: Modul inventarisasi dihapus; berkas kiriman disalin ke arsip pegawai dulu, data R2 disimpan

Tanggal: 10 Oktober 2026
Status: tahap 1 (salin semua) berlaku; tahap 2 (hapus modul) menyusul. Menjalankan rencana ADR-027.

## Konteks

Pengguna menyatakan modul inventarisasi sudah tidak dibutuhkan dan meminta modul itu dihapus dengan sangat hati-hati.
Data modul tidak ada di basis data, hanya di R2 dengan awalan `inventaris/`. Isinya di produksi per 10 Oktober 2026:

- **127 objek (22,5 MB)**: kiriman **42 pegawai** dari kegiatan "kanwil", berisi **84 berkas** SK.
- **44 berkas** sudah disalin ke arsip dokumen **22 pegawai** (awalan `dokumen/`). Salinan itu milik modul pegawai dan
  tetap ada setelah modul dihapus.
- **40 berkas** milik **20 pegawai** belum pernah disalin: SK CPNS 11, SK PNS 11, SK KGB terakhir 9, SK KP terakhir 9.

## Keputusan

Pilihan pengguna: salin semua ke arsip dulu, dan biarkan data R2 untuk dihapus nanti.

1. **Tahap 1: salin semua.**
   - Tombol **Salin semua ke arsip pegawai** di halaman Inventarisasi, khusus Super Admin
     (`POST /api/inventarisasi/arsip { semua: true }`).
   - Memakai `salinBerkasKeArsip` yang sama dengan tombol per berkas. Berkas yang sudah tersalin dilewati, jadi menjalankan
     ulang aman.
   - Kiriman dari NIP yang belum terdaftar di Data Pegawai dilaporkan namanya.
   - Hasilnya tercatat di Log Aktivitas.
2. **Tahap 2: hapus modul**, setelah penyalinan diperiksa. Yang dihapus mengikuti daftar ADR-027:
   - semua titik `JEJAK-INVENTARISASI`;
   - halaman, rute, dan pustaka modul beserta ujinya;
   - skrip Google Form dan `docs/inventarisasi-kgb/`.
3. **Data R2 `inventaris/` tidak disentuh.** Data itu tidak lagi terlihat di aplikasi, dapat dipulihkan bila perlu, dan
   dapat dihapus belakangan atas keputusan pengguna. ADR ini dan ADR terdahulu tetap disimpan sebagai riwayat keputusan.

## Akibat

- Setelah tahap 1, semua berkas kiriman dari pegawai yang terdaftar ada di tab Dokumen pegawainya, dengan keterangan
  "Dari kiriman …".
- Setelah tahap 2, formulir publik `/inventarisasi-kgb` dan menu Inventarisasi KGB tidak ada lagi. Data Pegawai, Usulan
  UPT, dan cek KGB tidak terpengaruh.
