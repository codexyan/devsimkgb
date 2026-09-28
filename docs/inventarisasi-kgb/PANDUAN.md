# Formulir inventarisasi data KGB pegawai Kanwil

Formulir publik di `https://kgb.paskalsel.online/inventarisasi-kgb`. Pegawai Kanwil mengisi data KGB dan
mengunggah SK-nya, lalu semuanya tersimpan di Google Drive Tim SDM:

```
[Folder Drive]
├─ Rekap Inventarisasi KGB Kanwil        Google Sheet, satu baris per pegawai + tautan folder dan berkas
├─ 01 Pernah KGB
│   └─ 199001012015031001 - Nama Pegawai
│        ├─ 199001012015031001_SK-KGB-Terakhir_2024-09-20.pdf
│        └─ 199001012015031001_SK-KP-Terakhir_2023-03-15.pdf
└─ 02 Belum Pernah KGB
    └─ 200101012025061001 - Nama Pegawai
         ├─ 200101012025061001_SK-CPNS_2025-02-10.pdf
         └─ 200101012025061001_SK-PNS_2026-05-04.pdf
```

- Nama berkas: `NIP_JenisSK_TanggalSK.pdf`, jadi tetap dikenali walau dipindah dari foldernya.
- Kiriman ulang dari NIP yang sama menggantikan kiriman sebelumnya:
  - berkas lama dipindah ke Sampah Drive (dapat dipulihkan 30 hari);
  - folder ikut pindah bila keadaan KGB-nya berubah;
  - baris rekap diperbarui, dan kolom "Kiriman ke" naik.
- Hanya pengirim yang tahu kode akses (diumumkan di grup WA) yang dapat mengirim. Satu NIP paling banyak 5
  kiriman per jam.

Server SIM-KGB tidak menyimpan dan tidak memproses berkasnya. Formulir mengirim langsung ke Google Apps Script
milik akun Google Anda, sehingga berkas memakai kuota Drive akun itu.

## Pemasangan (sekali, sekitar 5 menit)

Gunakan akun Google pemilik folder
`https://drive.google.com/drive/folders/149ZW_VaniapL9EpvV9pWjpVo8fQmfxnz`.

1. Buka `https://script.google.com`, pilih **New project**, lalu beri nama mis. *Inventarisasi KGB Kanwil*.
2. Hapus isi `Code.gs`, lalu tempelkan seluruh isi berkas `docs/inventarisasi-kgb/Code.gs`. Simpan.
3. Buka **Project Settings** (ikon roda gigi), lalu bagian **Script properties** → **Add script property**:
   - `FOLDER_ID` = `149ZW_VaniapL9EpvV9pWjpVo8fQmfxnz`
   - `KODE_AKSES` = kode pilihan Anda, mis. `KANWIL2026` (huruf besar-kecil tidak berpengaruh)
4. Pilih **Deploy** → **New deployment**, lalu ikon roda gigi → **Web app**:
   - *Execute as*: **Me** (akun Anda)
   - *Who has access*: **Anyone**
5. Pilih **Deploy**, lalu **Authorize access**, pilih akun Anda. Bila muncul peringatan "Google hasn't verified
   this app", pilih **Advanced** → **Go to … (unsafe)**. Ini wajar untuk skrip buatan sendiri.
6. Salin **Web app URL** (berakhiran `/exec`) dan kirimkan ke pengelola SIM-KGB. Alamat itu dipasang di
   `wrangler.jsonc` (`INVENTARIS_KGB_URL`), dan formulir terbuka setelah deploy berikutnya.

Periksa: membuka Web app URL di peramban harus menampilkan `{"ok":true,"layanan":"inventarisasi-kgb"}`.

## Mengubah kode akses atau menutup formulir

- **Ganti kode akses:** ubah `KODE_AKSES` di Script properties. Langsung berlaku, tanpa deploy ulang.
- **Tutup formulir:**
  - Cara cepat: hapus `KODE_AKSES`, sehingga kiriman dijawab "Formulir belum disiapkan".
  - Cara permanen: kosongkan `INVENTARIS_KGB_URL` di `wrangler.jsonc`, lalu deploy ulang.
- **Batas waktu** yang tampil di halaman diatur di `INVENTARIS_KGB_BATAS` di `wrangler.jsonc`, mis.
  `"Jumat, 10 Oktober 2026"`.
- **Bila `Code.gs` diperbarui:** pilih **Deploy** → **Manage deployments** → ikon pensil → *Version*: **New version**
  → **Deploy**. Cara ini membuat URL tetap sama; *New deployment* akan membuat URL baru.

## Uji di komputer sendiri

Tiruan web app yang menjalankan `Code.gs` apa adanya di Node dengan Drive dan Sheet tiruan dipakai saat
pengembangan: jalankan tiruan di port 3222, lalu `INVENTARIS_KGB_URL=http://127.0.0.1:3222/exec` untuk
`next dev`. Mode pengembangan menerima alamat `http://127.0.0.1`; produksi hanya menerima
`https://script.google.com/macros/s/.../exec`.
