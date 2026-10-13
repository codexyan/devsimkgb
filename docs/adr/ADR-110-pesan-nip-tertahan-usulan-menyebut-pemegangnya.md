# ADR-110: Pesan penolakan NIP yang tertahan usulan menyebut siapa yang memegang usulannya

Tanggal: 13 Oktober 2026
Status: berlaku. Melengkapi ADR-026 (NIP yang sedang diusulkan tidak dicatat ganda).

## Konteks

Super Admin menambah pegawai Ahmad Rijani lewat Data Pegawai dan ditolak. Penyebab pertama: NIP yang diketik milik orang lain
(tertolak "NIP sudah terdaftar"). Setelah NIP dibetulkan, penghalang berikutnya adalah draf pegawai baru yang sudah dibuat
Admin UPT Lapas Kotabaru untuk NIP yang sama.

Pemeriksaan kodenya:

- `POST /api/pegawai` menolak NIP yang punya usulan `draf`, `menunggu`, atau `revisi` (`BELUM_SELESAI`), supaya orang yang sama
  tidak masuk dua kali dan papan UPT tidak menampilkan dua kartu (ADR-026). Aturan ini tidak berubah.
- Pesannya selalu "NIP … sedang diusulkan <kode satker> atas nama …. Tinjau usulannya di Usulan UPT; menyetujuinya akan
  menambahkan pegawai ini." Itu benar hanya untuk usulan yang **menunggu**. Draf dan usulan yang dikembalikan hanya ada di
  tangan UPT dan tidak pernah tampil di Usulan UPT, jadi petunjuknya membuntukan Super Admin: tidak ada yang dapat ditinjau.
- Pesannya juga menyebut kode satker (`lapas-kotabaru`), bukan namanya.
- Impor daftar pegawai (`/api/pegawai/import`) punya kalimat serupa dengan kekurangan yang sama.

## Keputusan (pemilik, 13 Oktober 2026)

1. **Pesan menyesuaikan status usulan** (`pesanNipSedangDiusulkan`, `lib/usulanPegawai.ts`, diuji):
   - `menunggu`: tidak berubah, selain memakai nama satker. Kanwil meninjaunya di Usulan UPT.
   - `draf`: NIP sedang disiapkan Admin UPT sebagai draf pegawai baru dan belum diajukan, jadi belum ada di Usulan UPT. Bila
     Kanwil yang akan mencatat pegawai ini, minta Admin UPT menghapus drafnya (tombol Hapus pada baris pegawai di Pegawai
     Satker), atau UPT mengajukannya lewat Usul KGB Kolektif.
   - `revisi`: usulan dikembalikan ke UPT untuk diperbaiki; tunggu UPT mengajukannya lagi, atau minta UPT menghapusnya.
2. **Bila ada beberapa usulan** untuk NIP yang sama, yang menunggu didahulukan, sebab hanya itu yang dapat ditindaklanjuti
   Kanwil sendiri.
3. **Impor daftar** memakai petunjuk yang sama per baris, dengan nama satker.

## Akibat

- Hanya teks galat. Aturan penolakan, data, rute, dan skema tidak berubah; Super Admin tidak bisa menghapus draf UPT, dan itu
  tetap sengaja (draf hanya di tangan UPT).
- Super Admin langsung tahu siapa yang harus bertindak dan apa yang diminta, tanpa menebak.

## Uji

`lib/usulanPegawai.test.ts`: pesan menunggu menyebut Usulan UPT; pesan draf tidak menyuruh meninjau dan menyebut tombol Hapus
serta Usul KGB Kolektif; pesan revisi menyebut dikembalikan ke UPT; nama kosong tidak merusak kalimat; setiap status
`BELUM_SELESAI` mendapat pesan yang memuat NIP-nya. Pengiriman nyata diperiksa di peramban dengan draf UPT fiktif.
