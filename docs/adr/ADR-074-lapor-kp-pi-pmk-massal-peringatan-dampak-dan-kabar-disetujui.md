# ADR-074: Lapor KP/PI/PMK massal, peringatan dampak ke KGB, dan kabar saat disetujui

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Admin UPT dapat melaporkan SK kenaikan pangkat, penyesuaian ijazah (KP/PI), dan peninjauan masa kerja (PMK) lewat dua
kartu di menu tiga titik tiap baris pegawai (ADR-045). Itu cukup untuk satu pegawai, tetapi kenaikan pangkat biasanya
terbit untuk banyak pegawai pada periode yang sama, dan kartunya baru dapat dibuka dengan menemukan barisnya satu per
satu. Ada dua kekurangan lain:

- Admin UPT tidak pernah dikabari saat laporan SK-nya disetujui. Laporan SK berangkat tanpa surat (ADR-046), jadi tidak
  ada surat yang bisa ditunggu, dan satu-satunya cara tahu hanyalah membuka daftar usulan.
- Laporan SK mengubah golongan atau masa kerja, sehingga KGB pegawai yang sedang berjalan di Kanwil ikut terpengaruh
  (`lib/sesuaikanKgbUsulan.ts`), tetapi Admin UPT tidak diberi tahu sebelum mengirim.

Pengguna menanyakan fitur untuk meremajakan data setelah ada KP/PI/PMK, lalu memilih empat hal: tombol Lapor di Pegawai
Satker, lapor massal dalam satu tabel, kabar saat disetujui, dan peringatan dampak ke KGB berjalan. Pengingat periode
kenaikan pangkat sengaja tidak dipilih.

## Keputusan

1. **Tombol "Lapor KP/PI/PMK" di bilah atas Pegawai Satker**, di samping Usul KGB Kolektif, Unggah daftar, dan Tambah
   pegawai, menuju `/dashboard/upt/lapor-sk`. Menu tiga titik per baris tetap ada untuk satu pegawai.
2. **Halaman lapor massal** (`LaporSkMassal.tsx`): cari dan tambahkan pegawai, tiap pegawai satu kartu berisi jenis SK,
   golongan baru atau masa kerja menurut SK, nomor, tanggal, TMT, penetap, hasil hitungan, dan pindaian yang masih
   kurang. Satu pegawai hanyalah satu kartu. Dibuka dari tautan dengan `?pegawai=<id>&jenis=kp|pmk`, kartunya langsung ada.
   - **Isian bersama** (tanggal SK, TMT, penetap) hanya cadangan bagi kolom kartu yang kosong dan tidak pernah menimpa
     isian kartu. Kartu yang diisi berbeda tetap berbeda.
   - **Simpan semua sebagai draf** atau **Kirim ke Kanwil**. Kartu diproses satu per satu dan tiap kegagalan
     terisolasi: kartu lain tetap berjalan, dan kartu yang gagal atau belum lengkap tetap utuh beserta pindaiannya,
     dengan alasan yang ditulis di kartunya. Ringkasan di atas menyebut berapa yang terkirim, tersimpan, dilewati,
     dan gagal.
   - **Tidak membuat draf ganda.** Pegawai yang sudah punya draf atau usulan dikembalikan dilanjutkan dari drafnya
     (PATCH, seluruh nilai draf dikirim ulang apa adanya). Draf yang baru terbentuk dicatat di kartu, jadi percobaan
     ulang memperbaruinya. Pegawai dengan usulan yang sedang ditinjau Kanwil tidak dapat ditambahkan.
   - Menutup atau memuat ulang halaman dengan isian yang belum tersimpan ditanyakan dulu (`beforeunload`).
   - Berkas wajib yang belum ada di draf maupun usulan sebelumnya dimintakan; PDF saja, batas 500 KB per berkas
     (`BATAS_BERKAS_USULAN_BYTE`). Kartu yang berkasnya belum lengkap tidak dikirim, tetapi dapat disimpan sebagai draf.
3. **Logika bersama kartu tunggal dan halaman massal**, supaya hitungan dan pesannya persis sama:
   - `lib/laporSk.ts` (murni, diuji): pratinjau hitungan (`hitungKenaikanPangkat` dan `hitungPmk`, fungsi yang sama
     dengan yang dijalankan Kanwil saat menyetujui), daftar kekurangan, dan peringatan dampak.
   - `app/dashboard/components/upt/laporSkKirim.ts`: penyimpanan dan pengajuan lewat rute yang sudah ada (POST/PATCH
     `/api/upt/usulan`, lalu POST `/api/upt/usulan/ajukan`). Tidak ada rute, kolom, atau migrasi baru.
   - `ModalDasarBaru.tsx` direfaktor memakai keduanya. Perilakunya tetap, ditambah peringatan dampak.
4. **Peringatan dampak ke KGB berjalan** (`peringatanDampakKgb`), sebagai peringatan dan bukan blokir:
   - KGB `sedang_diproses` (kuning): hitungannya diperbarui saat laporan disetujui, dan SK yang sudah dibuat perlu
     dibuat ulang oleh Tim SDM.
   - KGB `menunggu_keuangan` (merah): SK sudah ditandatangani dan diunggah, sehingga golongan dan masa kerja tidak
     dapat diubah. Laporan baru dapat diterapkan setelah Tim SDM membatalkan KGB itu; Admin UPT diminta menghubungi
     mereka lebih dulu.
   - Status lain: tanpa peringatan. UPT tetap boleh menyimpan dan mengirim, sebab laporannya sendiri sah.
5. **Kabar saat disetujui** (`TIPE_NOTIFIKASI.USULAN_DISETUJUI`, `notifikasiUsulanDisetujui`):
   - Dibuat di `setujuiUsulan` hanya untuk usulan perubahan yang benar-benar mencatat riwayat KP atau PMK. Perbaikan
     data biasa dan pegawai baru tidak memicunya.
   - Pesannya memuat ringkasan SK yang dicatat dan, bila ada, penyesuaian KGB yang terjadi. Tautannya ke Pegawai Satker.
   - Dibuat dalam `try/catch`: usulan sudah disetujui, dan gagalnya lonceng tidak boleh membatalkannya. Satu usulan
     paling banyak punya satu kabar (yang lama dihapus sebelum yang baru dibuat).
   - Hanya Admin UPT (dan Super Admin) yang melihatnya. `GET /api/notifikasi` menyaringnya per satker lewat id usulan,
     sama dengan usulan dikembalikan, sehingga satker lain tidak melihatnya. Admin UPT tetap tidak dapat menandai dibaca.
   - Halaman Notifikasi mengelompokkannya di saringan baru "Hasil usulan" bersama usulan dikembalikan, dengan ikon
     centang hijau.
6. **Pengumuman "Apa yang baru" bertingkat** (lanjutan ADR-073): `PENGUMUMAN_UPT` menggantikan `ID_PENGUMUMAN_UPT` dan
   memuat `nama-menu-2026-10` serta `lapor-sk-2026-10`. Dua adegan baru (tombol Lapor KP/PI/PMK ditekan lalu baris
   terisi dan terkirim; peringatan kuning lalu lonceng notifikasi disetujui).
   - Yang tampil otomatis hanya adegan dari pengumuman yang belum dilihat pengguna itu. Kunci pengumuman pertama tidak
     berubah, jadi yang sudah melihatnya hanya mendapat dua adegan baru; yang belum pernah melihat apa pun mendapat
     kelimanya berurutan.
   - Menutup hanya menandai pengumuman yang adegannya diputar. Tombol "Apa yang baru?" memutar kelimanya.
   - Aturan keamanan isian ADR-073 tetap: hanya di Dashboard, Pegawai Satker, dan Riwayat. Halaman Lapor KP/PI/PMK sengaja
     tidak termasuk, karena memuat isian yang belum disimpan.
7. **Panduan UPT** diperbarui: tombol baru, lapor massal, peringatan dampak, dan notifikasi disetujui.

## Akibat

- Meremajakan data sesudah SK terbit untuk banyak pegawai kini satu halaman, bukan membuka kartu satu per satu.
- Admin UPT tahu laporannya sudah diterapkan dari lonceng Notifikasi dan tidak perlu membuka daftar usulan.
- Tidak ada perubahan skema, API, atau aturan persetujuan di Kanwil. Hitungan, pemotongan masa kerja (II ke III), dan
  penolakan persetujuan atas KGB yang SK-nya sudah ditandatangani tetap di tempatnya; yang baru hanyalah memberi tahu
  UPT lebih awal.
- Kabar disetujui bertambah satu baris notifikasi per laporan SK yang disetujui. Jumlahnya kecil (hanya KP/PI/PMK), dan
  daftar notifikasi sudah dibatasi 50 teratas.
- Admin UPT tidak dapat menandai notifikasi dibaca, dan hanya Super Admin yang dapat menghapusnya. Kabar disetujui
  karena itu tetap tampil di daftar Admin UPT; daftarnya diurutkan terbaru lebih dulu dan dibatasi 50 teratas.
- Pengingat periode kenaikan pangkat tidak dibuat. Bila dibutuhkan, itu keputusan terpisah.
