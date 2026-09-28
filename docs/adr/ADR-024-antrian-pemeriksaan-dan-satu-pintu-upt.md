# ADR-024: Antrian pemeriksaan, dokumen berpusat di SIM-KGB, dan satu pintu UPT

Tanggal: 28 September 2026
Status: berlaku; tahap 1 dari penyederhanaan alur peremajaan data

## Konteks

Setelah ADR-022 dan ADR-023, alur peremajaan data di sisi Super Admin dan Tim SDM Kanwil masih berulang:

- Menu Inventarisasi menampilkan daftar kiriman tetapi tidak menunjukkan mana yang datanya berbeda; untuk
  memeriksa, Tim SDM berpindah ke Data Pegawai lalu membuka tab per pegawai.
- UPT dapat mengirim data dan SK yang sama lewat dua jalur: Usulan UPT (ADR-007) dan kegiatan inventarisasi UPT.
- Satu SK dapat tersimpan sebagai berkas usulan, berkas kiriman, arsip dokumen, dan salinan ZIP di Google Drive.

## Keputusan (pemilik, 28 September 2026)

1. **Menu Inventarisasi menjadi antrian pemeriksaan.** Daftar kiriman memuat kolom *Perbandingan* (jumlah isian
   berbeda, atau "Belum terdaftar di SIM-KGB") dan *Tindak lanjut*, ditambah saringan *Perlu dikerjakan*. Tombol
   **Periksa** membuka perbandingan, peringatan, penerapan isian, pratinjau berkas, serta Catat kenaikan pangkat
   dan PMK di tempat. Tab di halaman pegawai tetap ada untuk melihat riwayat satu pegawai.
2. **SIM-KGB menjadi rujukan dokumen.** Kiriman yang ditandai *sesuai* atau *sudah diterapkan* menyalin berkasnya
   ke arsip dokumen pegawai, dikenali dari kunci asal supaya tidak tersalin dua kali. Berkas yang sudah disalin
   tidak lagi ditampilkan sebagai entri terpisah. Unduhan ZIP ke Google Drive tetap ada sebagai cadangan.
3. **Satu pintu UPT.** Template *Inventarisasi KGB pegawai UPT* tidak lagi ditawarkan untuk kegiatan baru;
   pemutakhiran data pegawai UPT lewat Usulan UPT. Kegiatan yang sudah dibuat dengan template itu tetap terbaca
   dan dapat ditutup, sehingga kiriman yang sudah masuk tidak hilang.

## Tahap berikutnya (disetujui, belum dibangun)

- Satu halaman kerja per pegawai; ikon KP/PMK/mutasi/ubah di daftar diganti satu tombol Buka.
- Modal Ubah 20 isian dipecah menjadi tiga bagian (Identitas, Kepegawaian, Dasar KGB) yang disimpan terpisah.
- Golongan, MKG, dan TMT KGB hanya berubah lewat Catat KP atau PMK; salah ketik diperbaiki lewat Koreksi data
  yang terpisah dan tercatat.

## Akibat

- Tidak ada migrasi basis data.
- `GET /api/inventarisasi` kini membandingkan tiap kiriman dengan Data Pegawai, sehingga memuat seluruh pegawai
  satu kali per permintaan.
