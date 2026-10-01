# ADR-047: Keuangan menuntaskan antreannya di tempat, dan dapat mengembalikan SK ke Tim SDM

Tanggal: 1 Oktober 2026
Status: berlaku

## Konteks

Dua celah ditemukan saat pemilik menanyakan tombol konfirmasi di Keuangan Kanwil.

**Konfirmasinya ada, tetapi tidak di tempat orang berdiri.** Dasbor peran Keuangan hanya mendaftar antrean
"KGB menunggu konfirmasi" dengan tautan ke halaman Keuangan; tombol konfirmasinya hidup di halaman lain.
Barisnya hanya dapat dibaca, dan satu-satunya jalan menuntaskannya adalah pindah halaman. Di papan Tim SDM
pun kolom "Di keuangan" buntu: `aksiBarisTanpaUsulan()` mengembalikan `null` untuk posisi itu.

**Tidak ada jalan pulang sama sekali.** Ini yang lebih menentukan. `PATCH /api/kgb/[id]` hanya mengizinkan
pembatalan dari status `belum_diproses` atau `sedang_diproses`:

```
"Hanya KGB yang belum atau sedang diproses yang dapat dibatalkan"
```

Begitu SK diunggah dan statusnya `menunggu_keuangan`, Keuangan yang menemukan kekeliruan hanya punya dua
pilihan yang sama-sama buruk: mengkonfirmasi yang salah, atau mendiamkannya. Fitur *Follow up* yang sudah
ada bukan jalan pulang; ia menagih KGB yang **belum sampai** ke keuangan.

Yang sebenarnya sudah mungkin: **mengganti berkas SK**. `izinUnggahSk()` mengembalikan `{ ok: true, jenis:
"ganti" }` untuk status `menunggu_keuangan`, jadi Tim SDM dapat menukar pindaian yang keliru tanpa
perubahan status. Yang tidak ada adalah penyerahan kembali kepemilikannya, dan kemampuan membatalkan
prosesnya ketika yang keliru adalah angkanya, bukan berkasnya.

## Keputusan (pemilik, 1 Oktober 2026)

1. **Dikembalikan ke kolom Diproses**, bukan ke Perlu input dan bukan pula ditandai di tempat. Status
   kembali ke `sedang_diproses` beserta alasan dari Keuangan. Dari kolom itu, dua jalan yang sudah ada
   terbuka kembali: mengganti SK lewat Unggah SK TTE, atau menekan Batalkan proses bila angkanya yang
   keliru, yang memulangkannya lagi ke Perlu input. Satu perpindahan baru membuka keduanya.
2. **CTA di baris antrean dasbor Keuangan**: tiap baris mendapat tombol **Konfirmasi** dan **Kembalikan**,
   memakai jendela sendiri, tanpa pindah halaman. Tautan ke halaman Keuangan tetap ada untuk pekerjaan
   borongan seperti Konfirmasi cepat.

## Akibat

- **Tanpa migrasi basis data.** Baris KGB tidak punya kolom catatan, dan menambahkannya hanya untuk ini
  tidak sepadan; alasan pengembalian disimpan pada notifikasi untuk Tim SDM dan pada catatan audit
  (`aksi: "kembalikan_kgb_keuangan"`).
- Rute baru `POST /api/kgb/[id]/kembalikan`, dijaga `canKonfirmasiKeuangan` yang sama dengan konfirmasi,
  menolak status selain `menunggu_keuangan`, menolak arsip, dan menolak pegawai UPT dengan menyebut bahwa
  SK-nya ditindaklanjuti keuangan satkernya sendiri (ADR-009). Alasan wajib diisi.
- **Tidak ada data pegawai yang perlu dipulihkan.** Gaji pokok, masa kerja golongan, dan jadwal siklus
  berikutnya baru ditulis `selesaikanKgb()` saat konfirmasi, jadi pengembalian hanya memindahkan status.
  Diperiksa: sesudah dikembalikan, gaji pokok pegawai masih angka lama dan TMT KGB berikutnya tidak
  bergeser.
- Notifikasinya memakai tipe `followup_keuangan` yang sudah ada, bukan tipe baru, supaya langsung muncul di
  panel tindakan dasbor Tim SDM beserta tautan ke Proses KGB. Judulnya yang membedakan: "SK dikembalikan
  Keuangan".
- Jendela Konfirmasi pada dasbor menyatakan akibatnya lebih dulu (gaji pokok lama menjadi baru, nomor SK,
  pilihan rapelan) dan menyebut bahwa tindakannya tidak dapat dibatalkan.
- Diperiksa dari dua sisi dengan Chrome headless pada data lokal:
  - sebagai Keuangan, baris antrean menampilkan "Kembalikan | Konfirmasi"; mengirim tanpa alasan ditolak di
    layar; dengan alasan, antreannya kosong dan kabarnya muncul;
  - sebagai Super Admin, kartunya berada di kolom **Sedang diproses**, dan panel tindakan berbunyi
    "Keuangan: Keuangan mengembalikan SK KGB atas nama Indah Permata ... Alasan: ...".
- 443 uji lolos, `tsc --noEmit` bersih, ESLint bersih pada berkas yang disentuh.

## Catatan: tanda pisah panjang

Penyapuan menyeluruh dikerjakan bersama keputusan ini. ADR-007 bagian 6 sudah melarang tanda pisah panjang
di seluruh teks antarmuka, dokumen, dan komentar, tetapi aturannya terlanjur bocor ke 158 tempat di 46
berkas, termasuk ADR-030 sampai ADR-046. Semuanya diganti tanda baca biasa: titik dua untuk keterangan,
koma atau titik koma untuk sisipan.
