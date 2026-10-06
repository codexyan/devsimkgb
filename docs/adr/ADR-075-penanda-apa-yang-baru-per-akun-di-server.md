# ADR-075: Penanda "Apa yang baru" per akun di server

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

ADR-073 mencatat penanda "sudah dilihat" pengumuman Apa yang baru hanya di peramban, dan menyebut akibatnya: Admin UPT yang
berganti komputer melihat pengumuman yang sama sekali lagi. ADR-074 menambah pengumuman kedua dan penandanya tetap di
peramban. Pengguna menyatakan bahwa pengumuman harus muncul ketika Admin UPT login pertama kali, lalu memilih penandanya
dipindah ke server: sekali per akun, di perangkat mana pun.

Uji login sungguhan lewat formulir sebelum perubahan ini: pop-up muncul sekitar 1,5 detik setelah login pertama, tidak
muncul lagi sesudah ditutup, tetapi muncul lagi di login berikutnya bila belum ditutup (penanda baru dicatat saat
ditutup), dan muncul lagi di peramban lain.

## Keputusan

1. **Tabel baru `pengumuman_dilihat`** (`user_id`, `pengumuman_id`, `dilihat_at`), satu baris per akun per pengumuman, kunci
   barisnya `userId:pengumumanId` dan ditambah indeks unik. Hanya tabel baru, tanpa mengubah tabel lama, sehingga tidak
   ada kueri lama yang dapat gagal karena migrasi. Tanpa foreign key: penanda hanya catatan tampilan dan tidak boleh
   menghalangi penghapusan akun.
2. **Rute `GET` dan `POST /api/upt/pengumuman`**, hanya untuk Admin UPT dan hanya untuk akunnya sendiri.
   - `GET` mengembalikan pengumuman yang sudah dilihat akun itu.
   - `POST` mencatat id yang dikirim. Id yang tidak dikenal diabaikan, mencatat dua kali tidak menggandakan, dan jawabannya
     dibaca ulang dari tabel sehingga galat tulis tidak pernah dilaporkan sebagai sudah tercatat.
   - Tim SDM, keuangan, dan Super Admin ditolak 403; tanpa sesi 401.
3. **Aman terpasang lebih dulu daripada tabelnya.** Bila tabel belum dibuat (migrasi dijalankan manual di SQL Editor),
   kedua rute menjawab `server: false` dan peramban memakai penanda lokalnya seperti sebelumnya (`tabelBelumAda`, pola
   yang sama dengan laporan hukdis dan mutasi). Tidak ada galat 500 sebelum migrasi dijalankan.
4. **Dicatat begitu tampil, bukan saat ditutup.** Pengumuman muncul di login pertama saja dan tidak berulang bila halaman
   dimuat ulang sebelum ditutup. Tombol "Apa yang baru?" tetap dapat memutarnya kapan saja.
5. **Server hanya ditanya bila perlu.** Peramban yang sudah pernah melihat semua pengumuman tidak memanggil server sama
   sekali, jadi halaman dashboard sehari-hari tidak membayar satu permintaan pun (batas CPU Worker).
   - Yang sudah dilihat di server disalin ke peramban, sehingga permintaan berikutnya tidak perlu ke server.
   - Yang sudah dilihat di peramban tetapi belum tercatat di server (pengguna yang melihatnya sebelum penanda server ada)
     disusulkan ke server dan tidak ditampilkan lagi.
6. Aturan keamanan isian ADR-073 tidak berubah: hanya di Dashboard, Pegawai Satker, dan Riwayat, tidak di atas dialog, dan
   tidak selagi ada kolom yang diketik. Yang dicatat tetap hanya penanda "sudah dilihat".

## Akibat

- Pengumuman tampil sekali per akun, di login pertama akun itu, di komputer mana pun. Akun baru yang dibuat kemudian
  melihat semua pengumuman yang berlaku sekali.
- **Migrasi manual:** `supabase/migrations/20261006120000_pengumuman_dilihat.sql` dijalankan di SQL Editor Supabase. Sampai
  dijalankan, perilakunya sama dengan sebelumnya (penanda peramban), tanpa galat.
- Pengumuman berikutnya tetap ditambahkan di akhir `PENGUMUMAN_UPT`; id-nya otomatis dikenali rute server.
- Penanda tidak dihapus bila Super Admin menghapus akun; barisnya yatim dan tidak berefek.
