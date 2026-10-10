# ADR-095: Cetak SK mengunduh versi TTE sebagai tombol utama; tanda tangan basah di menu; unduhan massal ZIP

Tanggal: 10 Oktober 2026
Status: berlaku. Mengubah perilaku Cetak SK ADR-077 dan ADR-089.

## Konteks

Cetak SK di kartu Sedang diproses, di detail Proses KGB, dan di jendela Buat SK selalu mengunduh **dua** PDF:
- **SK biasa**: ruang tanda tangan kosong, untuk tanda tangan basah;
- **versi Srikandi**: berisi `${ttd_pengirim}` dan label Srikandi, untuk TTE.

Satu SK hanya ditandatangani dengan satu cara, jadi separuh unduhan selalu tidak terpakai. Dengan 57 SK siap cetak dari
Lapas Perempuan Martapura, itu berarti 114 berkas yang harus dipilah. Tombol unggahnya bernama "Unggah TTE", padahal ia
juga menerima pindaian SK bertanda tangan basah.

## Keputusan

Pilihan pengguna:
- tombol utama untuk TTE, dengan tanda tangan basah di menu;
- unduhan massal sebagai satu ZIP.

1. **Tombol berbelah** (`TombolCetakSk`):
   - Klik utama **Unduh untuk TTE** mengunduh versi Srikandi saja.
   - Panah ▾ di sebelahnya berisi **Cetak untuk tanda tangan basah**, yang mengunduh SK biasa.
   - Menunya memakai `MenuTindakan` (portal), jadi tidak terpotong kolom papan yang bergulir.
   - Dipakai di kartu dasbor dan di detail Proses KGB.
2. **`cetakSk(kgbId, pegawai, versi)`** mengunduh satu berkas. Jendela Buat SK untuk pegawai Kanwil juga hanya mengunduh
   versi Srikandi. SK biasa tetap dibuat lewat permintaan yang mencatat surat, tetapi tidak diunduh.
3. **Unduhan massal**: tombol **Unduh N SK siap cetak (ZIP)** di bawah kepala kolom Sedang diproses, tampil bila ada dua
   atau lebih SK siap cetak menurut saringan yang berlaku.
   - Satu ZIP berisi versi Srikandi, disusun satu per satu di peramban dengan kemajuan "Menyiapkan n dari N".
   - Nama berkas di dalamnya: `001 - Nama Pegawai - Nomor SK.pdf`.
   - SK yang belum boleh dicetak dilewati dan disebut namanya.
   - ZIP memakai `fflate` tanpa kompresi ulang, karena PDF sudah terkompresi.
4. **"Unggah TTE" / "Unggah SK TTE" menjadi "Unggah SK bertanda tangan"** di kartu, detail Proses KGB, riwayat pegawai,
   log aktivitas, notifikasi, dan Panduan. Jendela unggah menyebut kedua bentuk berkas yang diterima: hasil TTE, atau
   pindaian tanda tangan basah. Label sisi UPT "menunggu ttd dan TTE" menjadi "menunggu tanda tangan".

## Akibat

- Satu klik mengunduh satu berkas. Untuk banyak SK, satu ZIP menggantikan puluhan klik.
- Tidak ada perubahan data, rute API, atau migrasi. Isi PDF kedua versi tidak berubah.
