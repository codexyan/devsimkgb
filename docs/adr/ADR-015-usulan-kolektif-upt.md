# ADR-015: Usulan kolektif UPT dalam satu tabel

Tanggal: 27 September 2026
Status: berlaku

## Konteks

Satu surat Srikandi dari UPT lazimnya memuat banyak pegawai sekaligus, dan isinya campuran: pegawai baru,
perbaikan data, dan kelengkapan berkas.

- Pegawai baru sudah dapat diunggah sekaligus (CSV), dan pengajuan dengan satu surat sudah kolektif.
- Perbaikan data pegawai yang sudah tercatat, dan terutama unggah berkas pendukung (yang sejak ADR-014 wajib
  saat diajukan), masih dikerjakan lewat formulir perorangan satu per satu.

## Keputusan

Halaman **Usulan kolektif** (`/dashboard/upt/kolektif`, komponen `UsulanKolektif`) untuk Admin UPT:

1. **Pilih pegawai** lewat centang, dengan pintasan untuk pegawai yang KGB-nya jatuh tempo di bulan usulan.
   - Pegawai yang usulannya sedang ditinjau Kanwil tidak dapat dipilih.
   - Draf pegawai baru hasil Unggah daftar ikut otomatis.
2. **Satu tabel.** Tiap baris berisi keadaan KGB, golongan, masa kerja, TMT KGB terakhir atau TMT CPNS, nomor
   dan tanggal SK dasar, kolom berkas menurut keadaan KGB (`berkasUntukKeadaan`), gaji pokok hasil hitungan,
   dan status.
   - Isian terisi dari data tercatat atau isi draf. Yang berubah ditandai.
   - Draf yang sudah ada dipakai, tidak dibuat ganda.
3. **Simpan semua.** Hanya baris yang berubah atau diberi berkas yang disimpan.
   - Penyimpanan berjalan berurutan lewat rute yang sama dengan formulir perorangan (POST/PATCH
     `/api/upt/usulan`), sehingga pemeriksaan dan aturan kelengkapannya tidak berbeda.
   - Laporan hukdis pada draf yang ada dipertahankan (sejak ADR-016 laporan baru lewat modul Hukuman Disiplin).
   - Galat ditampilkan per baris.
4. **Ajukan dengan satu surat** dari layar yang sama. Draf yang lengkap otomatis dicentang, dan yang kurang
   disebut kekurangannya.

Laporan hukuman disiplin kini lewat modul Hukuman Disiplin UPT (ADR-016).

## Akibat

- Tidak ada API atau skema baru.
- Tombol *Usulan kolektif* ada di Data Pegawai dan menu UPT.
