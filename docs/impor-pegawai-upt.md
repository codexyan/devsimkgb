# Mengimpor pegawai UPT dan menyiapkan akun Admin UPT

Panduan operasional untuk Tim SDM Kanwil. Peran Admin UPT (ADR-004) hanya berguna setelah pegawai UPT ada di
SIM-KGB, karena isinya disaring menurut kolom **unitKerja** setiap pegawai.

## Urutan pekerjaan

1. **Impor pegawai satu satker**, lalu periksa hasilnya.
2. **Buat akun Admin UPT** untuk satker itu di menu Pengguna.
3. Ulangi untuk satker berikutnya. Mengerjakan satu satker sampai tuntas membuat kesalahan data mudah dilacak.

## 1. Impor pegawai

Buka **Data Pegawai → Impor CSV** (`/dashboard/pegawai/import`), lalu unduh templatnya dari tombol
**Unduh Template CSV**. Kolom yang dipakai:

| Kolom | Wajib | Catatan |
| --- | --- | --- |
| `nip` | ya | 18 digit, menjadi penanda unik pegawai |
| `nama` | ya | nama beserta gelar |
| `jabatan` | ya | mis. Penjaga Tahanan |
| `pangkat` | ya | mis. Penata Muda Tingkat I |
| `golonganRuang` | ya | mis. III/b |
| `unitKerja` | tidak, tetapi **wajib untuk UPT** | harus sama persis dengan nama satker; kosong berarti Kanwil |
| `tmtGolongan` | ya | yyyy-mm-dd |
| `mkgTahun`, `mkgBulan` | ya | masa kerja golongan saat ini |
| `gajiPokok` | tidak | kosongkan saja; diisi otomatis dari tabel PP 5/2024 |
| `tmtKgbTerakhir` | ya | dasar perhitungan siklus berikutnya |
| `tmtKgbBerikutnya` | ya | inilah yang muncul sebagai jadwal di dashboard UPT |
| sisanya | tidak | tempat/tanggal lahir, jenis kelamin, pendidikan, eselon, hukdis |

**Kolom `unitKerja` menentukan siapa yang dapat melihat pegawai itu.** Nama satker yang diterima ada di
`lib/satker.ts` dan ditampilkan di halaman impor ("Daftar unit kerja"). Halaman impor menolak baris yang unit
kerjanya di luar daftar, jadi salah ketik tertangkap sebelum data masuk.

Setelah impor, buka **Satker & UPT** dan pastikan jumlah pegawai satker itu sesuai. Pegawai yang unit kerjanya
tidak dikenali akan muncul sebagai "Belum sesuai daftar satker" di Laporan dan di pemantauan satker.

## 2. Buat akun Admin UPT

Menu **Pengguna → Tambah Pengguna**: isi NIP dan nama operator UPT, pilih peran **Admin UPT**, lalu pilih
satkernya. Satker wajib diisi untuk peran ini.

Akun tersebut hanya dapat melihat, dan hanya satkernya sendiri:

- daftar pegawai satker beserta status KGB-nya di Kanwil;
- jadwal pengiriman surat usulan enam bulan ke depan;
- SK yang sudah dikonfirmasi keuangan, untuk diunduh.

Yang tidak dapat dilakukan akun UPT: mengubah data apa pun, membuka modul Kanwil (Proses KGB, Laporan,
Keuangan, Hukuman Disiplin, Satker & UPT), dan melihat rincian hukuman disiplin. Hukdis hanya tampil sebagai
"KGB ditunda".

Untuk memindahkan akun ke satker lain, kirim PATCH `/api/users/[id]` berisi `{"satker":"<kode>"}`, atau hapus
akun lalu buat ulang.

## Yang perlu diingat

- SK baru dapat diunduh UPT **setelah dikonfirmasi keuangan**; sebelum itu statusnya tetap terlihat, tetapi
  berkasnya belum tersedia.
- Surat usulan resmi tetap dikirim lewat Srikandi. SIM-KGB hanya menampilkan jadwal dan statusnya.
- Jadwalnya: surat UPT dikirim pada bulan ketiga sebelum TMT dan diterima Kanwil paling lambat awal bulan
  kedua sebelum TMT; batas input Tim SDM ada di Pengaturan (`batas_input_sdm`).
