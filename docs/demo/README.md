# Data peragaan SIM-KGB

Dua berkas CSV untuk memperagakan SIM-KGB kepada audiens. Dibuat ulang dengan
`npx tsx scripts/buat-csv-demo.ts` dan diperiksa dengan `npx tsx scripts/uji-csv-demo.ts`.

Tanggal peragaannya ditetapkan pada tetapan `HARI_PERAGAAN` di `scripts/buat-csv-demo.ts`
(**30 September 2026**). Bila peragaannya mundur ke bulan lain, ubah tetapan itu lalu jalankan
ulang; seluruh TMT dihitung mundur dari sana, jadi keadaannya tetap sama.

| Berkas | Untuk | Jumlah |
|---|---|---|
| `demo-pegawai-admin-upt.csv` | **Unggah daftar** pada akun Admin UPT | 12 pegawai |
| `demo-pegawai-kanwil.csv` | **Data Pegawai → Impor** pada akun Super Admin atau Tim SDM KGB | 14 pegawai |

## Yang akan terlihat pada 30 September 2026

| Keadaan | UPT | Kanwil | Yang dapat diperagakan |
|---|---|---|---|
| TMT sudah lewat | 2 | 2 | kartu **Terlambat**, jalur Arsip KGB |
| TMT 1 Nov 2026, batas 20 Sep sudah lewat | 2 | 2 | **berpotensi rapelan** — masih dapat diinput, dan inilah satu-satunya kelompok yang jalur penuhnya dapat diperagakan hari ini |
| TMT Des 2026 sampai Mar 2027 | 8 | 10 | kartu jadwal ke depan; input Desember terbuka 1 Oktober |

Jendela input Tim SDM adalah tanggal 1–20 pada bulan kedua sebelum TMT. Pada 30 September, jendela
untuk TMT November (1–20 September) sudah tertutup dan jendela untuk TMT Desember baru terbuka
1 Oktober. Jadi untuk memperagakan alur penuh **Input KGB → Buat SK → Unggah SK → Keuangan →
Gaji Web**, pakailah baris ber-TMT 1 November 2026.

## Catatan

- **Semua nama dan NIP fiktif.** Nomor urut NIP sengaja diambil dari blok 9xx (UPT 901–912,
  Kanwil 921–934) supaya data peragaan mudah dikenali dan dibersihkan kembali.
- Sebaiknya dijalankan pada **salinan lokal** (`DATA_BACKEND=lokal`), bukan produksi. Bila terpaksa
  di produksi, blok 9xx di atas menjadi penandanya.
- Gaji pokok sengaja dikosongkan pada berkas Kanwil supaya dihitung sistem dari tabel PP 5/2024;
  begitu pula TMT KGB berikutnya pada berkas UPT.
- Baris pada berkas UPT masuk sebagai **draf** dan masih menagih pindaian SK sebelum dapat diajukan
  ke Kanwil. Itu memang alur sebenarnya: CSV tidak membawa berkas PDF.
- Untuk memperagakan penolakan NIP yang dirusak Excel (ADR-038), ubah satu NIP pada berkas UPT
  menjadi `197112000000000000` lalu unggah; barisnya akan ditolak beserta sebab dan cara
  memperbaikinya, sementara baris lain tetap dapat disimpan.
