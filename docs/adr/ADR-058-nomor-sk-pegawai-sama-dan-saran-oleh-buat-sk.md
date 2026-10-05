# ADR-058: Nomor SK yang dipesan KGB lain milik pegawai yang sama, dan saran isian Data Pegawai di Buat SK

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Tim SDM membuat SK untuk Input Ulang KGB seorang pegawai dengan nomor arsiparis WP.19-SA.04.04-1729. Simpan draf
dan pratinjau menolaknya: "Nomor SK WP.19-SA.04.04-1729 sudah disimpan sebagai draf SK KGB <pegawai yang sama>.
Minta nomor lain kepada arsiparis." Padahal nomor itu belum dipakai: SK-nya belum pernah diunggah bertanda tangan,
dan pemesannya KGB pegawai itu sendiri yang dibatalkan.

ADR-056 sudah melepaskan nomor milik KGB yang dibatalkan, tetapi baru terbit beberapa menit sesudah laporan ini.
Aturannya juga masih sempit: KGB lain milik pegawai yang sama, yang tidak berstatus dibatalkan, tetap memegang
nomornya. Contohnya draf yang tertinggal di jadwal.

Pada modal yang sama, baris Oleh masih "Kepala Kantor Wilayah Kementerian Hukum dan HAM Kalimantan Selatan".
KGB-nya diinput sebelum ADR-056, sehingga yang tersimpan adalah salinan lama. Data Pegawai sudah mencatat
penetap yang baru.

## Keputusan

1. **Nomor SK hanya dipegang SK lain yang berlaku** (`nomorSkBentrok`).
   - **SK yang sudah diunggah bertanda tangan selalu memegang nomornya, siapa pun pemiliknya,** sebab nomor itu
     sudah tercetak pada surat yang sah.
   - **Selama belum diunggah, dua keadaan tidak memegang nomor:**
     - KGB yang dibatalkan;
     - KGB lain milik pegawai yang sama. Itu SK yang sama yang dibuat ulang, dan satu pegawai tidak pernah punya
       dua KGB aktif sekaligus.
   - **Draf dan SK buatan pegawai lain yang masih berjalan tetap menolak,** sesuai aturan satu nomor untuk satu SK.
2. **Buat SK menawarkan isian Data Pegawai, tidak menimpanya.**
   - Bila SK dasar pada Data Pegawai adalah SK yang sama (atau lebih baru) dengan isian berbeda, modal menampilkan
     catatan berisi isian yang berbeda dan tombol **Pakai isian Data Pegawai** (`selaraskanDasarPegawai`, ADR-056).
   - Tidak ditimpa otomatis, sebab isian Buat SK bisa sengaja disunting Tim SDM. Menimpanya setiap modal dibuka
     berarti menghapus suntingan itu.
   - Isian yang dipakai tersimpan ke data KGB saat pratinjau atau Simpan draf, sama dengan suntingan biasa.

## Akibat

- Uji lokal dengan keadaan yang sama persis berjalan sebagai berikut:
  1. Nomor 1729 dipesan KGB batal milik pegawai yang sama, sedangkan KGB aktif masih menyimpan Oleh lama dan nomor
     SK dasar berspasi.
  2. Catatan muncul.
  3. Satu klik mengganti nomor dan Oleh dengan isian Data Pegawai.
  4. Simpan draf dengan nomor 1729 berhasil.
- Tes `lib/nomorSkBentrok.test.ts` mencakup kelima keadaan:
  - KGB batal;
  - KGB lain pegawai yang sama;
  - SK pegawai yang sama yang sudah diunggah;
  - draf pegawai lain;
  - SK pegawai lain yang sudah dibuat.
