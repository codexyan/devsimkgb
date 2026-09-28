# Formulir inventarisasi data KGB pegawai Kanwil

Formulir publik di `https://kgb.paskalsel.online/inventarisasi-kgb`. Pegawai Kanwil mengisi data KGB dan
mengunggah SK-nya. Semuanya tersimpan di SIM-KGB tanpa pengaturan Google apa pun, dan Tim SDM mengunduhnya
sebagai ZIP yang foldernya siap diseret ke Google Drive.

## Alur

1. **Super Admin** membuka *Data → Inventarisasi KGB* di dashboard, mencentang **Formulir dibuka**, lalu mengisi
   **Kode akses** (mis. `KANWIL2026`) dan **Batas pengisian**, dan menekan Simpan.
2. Pengumuman di grup WA memuat tautan `kgb.paskalsel.online/inventarisasi-kgb` dan kode aksesnya.
3. Pegawai memilih keadaan KGB-nya:
   - **Sudah pernah KGB:** mengisi data dan SK KGB terakhir, lalu mengunggah SK KGB terakhir dan SK kenaikan
     pangkat terakhir.
   - **Belum pernah KGB:** mengisi data dan SK CPNS, lalu mengunggah SK CPNS, dan SK PNS bila sudah terbit.
4. **Tim SDM KGB atau Super Admin** membuka *Inventarisasi KGB*, meninjau daftar kiriman (berkasnya bisa
   dipratinjau), lalu menekan **Unduh semua (ZIP)**.
5. Ekstrak ZIP, lalu seret isinya ke folder Drive
   `https://drive.google.com/drive/folders/149ZW_VaniapL9EpvV9pWjpVo8fQmfxnz`. Bisa juga di-upload folder lewat
   drive.google.com: *New → Folder upload*.

## Isi ZIP

```
Inventarisasi KGB Kanwil 2026-10-10.zip
├─ Rekap Inventarisasi KGB Kanwil.csv       dibuka dengan Excel atau Google Sheets, satu baris per pegawai
├─ 01 Pernah KGB
│   └─ 199001012015031001 - Nama Pegawai
│        ├─ 199001012015031001_SK-KGB-Terakhir_2024-09-20.pdf
│        └─ 199001012015031001_SK-KP-Terakhir_2023-03-15.pdf
└─ 02 Belum Pernah KGB
    └─ 200101012025061001 - Nama Pegawai
         ├─ 200101012025061001_SK-CPNS_2025-02-10.pdf
         └─ 200101012025061001_SK-PNS_2026-05-04.pdf
```

- **Nama berkas** berformat `NIP_JenisSK_TanggalSK.pdf`, sehingga tetap dikenali walau dipindah dari foldernya.
- **Rekap** memuat semua isian dan menulis NIP sebagai teks, sehingga 18 angkanya utuh di Excel.
- **Saring daftar** (pernah atau belum pernah KGB, atau hasil pencarian) sebelum mengunduh bila hanya
  sebagian yang ingin diunduh.

## Aturan

- **Kiriman ulang** dari NIP yang sama menggantikan kiriman sebelumnya: berkas lama dihapus, dan daftar
  menandainya "ke-2", "ke-3", dan seterusnya.
- **Pembatasan:** tanpa kode akses yang benar, kiriman ditolak. Kode salah dihitung sebagai percobaan gagal,
  dan alamat yang terlalu sering salah ditahan sementara.
- **Berkas:** harus PDF, paling besar 1 MB per berkas.
- **Penyimpanan:** kiriman berada di penyimpanan berkas SIM-KGB (R2, awalan `inventaris/`), dan hanya dapat
  dibuka Super Admin dan Tim SDM KGB. Super Admin dapat menghapus kiriman yang keliru atau kiriman uji.
- **Menutup formulir:** hapus centang *Formulir dibuka*. Halaman publik lalu menampilkan "Formulir belum dibuka".
