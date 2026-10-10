# ADR-097: ZIP SK dapat dipilih TTE atau TTD; nama berkas SK diawali nomor urut surat

Tanggal: 10 Oktober 2026
Status: berlaku. Melengkapi ADR-095.

## Konteks

Unduhan massal ADR-095 selalu berisi versi Srikandi untuk TTE, padahal SK yang ditandatangani basah juga perlu dicetak
sekaligus. Nama berkas di dalam ZIP diawali nomor urut unduhan (`001 - Nama - Nomor SK.pdf`), dan unduhan satuan memakai
nama lain lagi (`KGB Nama.pdf`, `KGB Kanwil Nama 2026.pdf`). Nomor surat SK di produksi berbentuk
`WP.19-SA.04.04-1758`: kode klasifikasi yang sama, diakhiri nomor urut.

## Keputusan

Pilihan pengguna: tombol belah seperti di kartu, dan nama "nomor urut + TTD/TTE + KGB + nama".

1. **Tombol ZIP berbelah** di bawah kepala kolom Sedang diproses, memakai `TombolCetakSk` yang sama dengan kartu:
   - klik utama **ZIP N SK untuk TTE** berisi versi Srikandi;
   - panah ▾ berisi **ZIP untuk tanda tangan basah**, yaitu SK biasa.
2. **Nama berkas SK** (`namaBerkasSk`):
   - format: nomor urut di ujung nomor surat, `TTE` atau `TTD`, `KGB`, lalu nama pegawai, mis.
     `1758 TTE KGB Abdul Hayat.pdf` dan `1758 TTD KGB Abdul Hayat.pdf`;
   - nomor tanpa angka di ujung dipakai utuh, dengan karakter terlarang diganti;
   - SK tanpa nomor tetap bernama `TTE KGB Nama.pdf`;
   - nama kembar di dalam ZIP diberi akhiran ` (2)`.

   Nama yang sama dipakai unduhan satuan (kartu, detail Proses KGB, Buat SK, riwayat pegawai) maupun ZIP.
3. **Nama ZIP** menyebut versinya: `SK KGB TTE 2026-10-10.zip` atau `SK KGB TTD 2026-10-10.zip`.

## Akibat

- Berkas terurut menurut nomor agenda dan langsung terbaca untuk TTE atau tanda tangan basah.
- Tidak ada perubahan data atau migrasi.
