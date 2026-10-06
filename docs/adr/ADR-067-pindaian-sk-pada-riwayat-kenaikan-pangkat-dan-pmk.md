# ADR-067: Pindaian SK pada riwayat kenaikan pangkat dan PMK

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Kenaikan pangkat dan PMK dicatat lewat Catat KP/PMK atau lewat persetujuan usulan UPT. Pindaian SK-nya boleh dilampirkan
saat mencatat. Bila terlupa, satu-satunya jalan adalah tab Dokumen. Di sana jenis, nomor, dan tanggal SK harus diketik
ulang persis seperti di riwayat, sebab linimasa SK penetap gaji pokok mencocokkan pindaian lewat jenis dan nomor SK
(ADR-066). Salah ketik satu titik membuat pindaian itu tidak pernah tercocokkan.

Selain itu, baris riwayat di tab Pangkat & PMK tidak memberi tahu apakah pindaian SK-nya sudah ada.

## Keputusan

1. **Tiap baris riwayat kenaikan pangkat dan PMK diberi kaki pindaian SK.** Kaki ini hanya tampil untuk Super Admin
   dan Tim SDM KGB, peran yang memegang arsip dokumen.
   - Pindaiannya dicari dengan `cariDokumenSk` (`lib/dokumenLinimasa.ts`), fungsi yang juga dipakai linimasa, sehingga
     baris riwayat dan linimasa selalu menunjuk berkas yang sama.
   - Bila sudah ada, tampil tombol **Lihat SK** beserta sumbernya, yang membuka jendela pratinjau.
   - Bila belum ada, tampil "Belum ada pindaian SK ini" dan tombol **Unggah SK**.
   - Bila nomor SK riwayat kosong, baris meminta nomornya dilengkapi dulu, karena pindaian tanpa nomor tidak dapat
     dicocokkan.
2. **Unggah SK memakai jenis, nomor, dan tanggal dari riwayatnya.** Ketiganya ditampilkan tetapi tidak dapat diubah.
   Berkas masuk ke arsip dokumen pegawai lewat rute yang sama dengan tab Dokumen (`POST /api/pegawai/[id]/dokumen`).
   Sesudah unggah, daftar dokumen dimuat ulang dan baris berganti menjadi Lihat SK.

## Akibat

- Pindaian yang terlupa cukup dilengkapi dari baris riwayatnya, tanpa mengetik ulang nomor SK.
- Daftar dokumen pegawai dimuat saat tab Pangkat & PMK dibuka. Bila gagal dimuat, baris menyebutkannya dan riwayatnya
  tetap tampil.
- Bila nomor di riwayat salah ketik, riwayatnya dibetulkan lebih dulu. Unggahan dari baris tidak dapat memakai nomor
  lain.
