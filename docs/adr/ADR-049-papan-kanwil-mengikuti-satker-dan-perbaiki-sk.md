# ADR-049: Papan Kanwil mengikuti satker yang disaring, SK yang sudah dibuat dapat diperbaiki, dan dasbor Keuangan murni Kanwil

Tanggal: 1 Oktober 2026
Status: berlaku; melanjutkan ADR-047

## Konteks

Tiga hal yang ditemukan pemilik sesudah pengembalian SK oleh Keuangan berjalan (ADR-047).

**1. Kartu yang dikembalikan menjadi buntu.** Di kolom Sedang diproses, kartu yang SK-nya sudah pernah
dibuat hanya menawarkan **Unggah TTE**. Padahal `ModalBuatSk` sendiri sudah mendukung pembuatan ulang dan
menyatakannya di layar: *"SK baru untuk KGB ini sudah pernah dibuat. Buat dan Unduh SK akan mencatat ulang
nomor, tanggal, dan …"*. Jadi kemampuannya ada, pintunya yang tertutup. Akibatnya KGB yang dikembalikan
Keuangan karena angkanya keliru hanya punya satu tombol, dan tombol itu justru mengunggah ulang SK yang
salah.

**2. Papan Kanwil memuat kolom yang tidak mungkin dikerjakannya.** Kolomnya enam, termasuk **Rekam UPT**,
dan kartu di kolom itu tidak punya satu tombol pun: `aksiBarisTanpaUsulan()` mengembalikan `null` untuk
posisi `rekam_upt`. Padahal sesudah SK diunggah, pegawai Kanwil menunggu keuangan Kanwil dan pegawai UPT
menunggu satkernya merekam di Gaji Web (ADR-009); keduanya tidak pernah terjadi pada orang yang sama.

**3. Dasbor Keuangan memuat urusan UPT.** Panel `PanelGajiWebUpt` memantau SK pegawai UPT yang belum
direkam, dan komentarnya sendiri mengakui bahwa keuangan Kanwil tidak menindaklanjutinya.

## Keputusan (pemilik, 1 Oktober 2026)

1. **Kartu Sedang diproses yang SK-nya sudah dibuat mendapat dua tombol**: *Perbaiki SK* bergaris yang
   membuka kembali Buat SK, dan *Unggah TTE* sebagai tombol utama. Yang SK-nya sudah benar tetap satu klik
   seperti sebelumnya; yang perlu dibetulkan tidak lagi buntu.
2. **Kolom papan mengikuti satker yang disaring.** Memilih Kanwil menghilangkan kolom Rekam UPT; memilih
   seluruh UPT atau satu UPT menghilangkan kolom Keuangan Kanwil, sehingga alurnya berbunyi Sedang
   diproses, Rekam UPT, Selesai. Saringan "Semua satker" tetap memperlihatkan keduanya, sebab di situ
   memang kedua jenis pegawai bercampur.
3. **Panel pemantauan Gaji Web UPT pindah** dari dasbor Keuangan ke dasbor Super Admin dan Tim SDM KGB,
   yang memang menagih UPT-nya.

## Akibat

- Tanpa migrasi basis data, tanpa rute baru, dan tanpa perubahan aturan di server.
- `PapanAntrian` menerima `kolom` opsional; tanpa prop itu seluruh kolom tampil seperti sebelumnya,
  sehingga pemakai lain komponen ini tidak terpengaruh.
- Rute `/api/keuangan/gaji-web-upt` memang dijaga `canViewKGB`, yang mencakup Super Admin dan Tim SDM KGB,
  jadi kepindahan panelnya tidak menuntut perubahan izin.
- Diperiksa dengan Chrome headless pada data lokal:

  | Saringan satker | Kolom papan |
  |---|---|
  | Semua satker | Belum dibuka · Perlu diinput · Sedang diproses · Keuangan Kanwil · Rekam UPT · Selesai |
  | Kanwil | Belum dibuka · Perlu diinput · Sedang diproses · **Keuangan Kanwil** · Selesai |
  | Seluruh UPT | Belum dibuka · Perlu diinput · Sedang diproses · **Rekam UPT** · Selesai |

- Kartu KGB yang dikembalikan Keuangan kini bertombol `["Batalkan proses KGB", "Perbaiki SK", "Unggah
  TTE"]`, dan menekan Perbaiki SK membuka jendela **Buat Surat Keputusan KGB** sebagaimana mestinya.
- Dasbor Tim SDM memuat panel **SK UPT belum direkam**; dasbor Keuangan tidak lagi memuatnya, panelnya
  tinggal KGB menunggu konfirmasi, Perlu tindakan, dan Per bulan TMT dasar Gaji Web.
- 443 uji lolos; `tsc --noEmit` bersih. ESLint pada berkas yang disentuh hanya menyisakan satu galat lama
  `react-hooks/set-state-in-effect` pada efek muat ulang 60 detik yang tidak disentuh keputusan ini.
