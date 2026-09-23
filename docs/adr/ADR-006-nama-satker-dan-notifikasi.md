# ADR-006: Nama satuan kerja ditulis lengkap, dan notifikasi diperluas ke UPT

**Status:** Diterima
**Tanggal:** 23 September 2026
**Penentu:** Pemilik SIM-KGB (Tim SDM Kanwil Ditjenpas Kalimantan Selatan)
**Cakupan:** `lib/satker.ts`, `app/dashboard/satker/labelSatker.ts`, `lib/generateNotifikasi.ts`,
`app/api/notifikasi/*`, halaman Notifikasi, Pengguna, Log Aktivitas, Pengaturan, dan halaman publik
`/kgb` serta `/panduan`

## Konteks

Tiga hal muncul bersamaan dari pemakaian sehari-hari:

1. **Nama unit kerja tampil tersingkat.** Daftar satker memakai "Lapas", "Rutan", "Bapas", dan "LPKA",
   termasuk pada tabel, ekspor Gaji Web, dan surat. Pemilik meminta nama unit kerja tidak disingkat karena
   dokumen kepegawaian dan SK memakai nama resmi lengkap.
2. **Modul notifikasi terasa tidak bekerja.** Di produksi hanya ada 30 notifikasi "KGB terlambat" dari
   14 September 2026 dan tidak ada yang baru. Pemeriksaan menunjukkan pembuatan notifikasi memang berjalan
   (cron harian aktif, jeda 15 menit saat aplikasi dibuka), tetapi: pengingat lama tidak pernah tertutup
   walau KGB-nya sudah diinput, akun Admin UPT tidak menerima notifikasi apa pun, dan tidak ada cara
   memicu pemeriksaan untuk memastikan modulnya hidup.
3. **Tiga halaman administrasi belum mengikuti model pas satu layar** (`data-muat-layar`): Pengguna, Log
   Aktivitas, dan Pengaturan masih memakai gaya lama `adm-*`, `bg-white` yang tidak ikut mode gelap, dan
   halaman panjang yang seluruhnya bergulir.

## Keputusan

### 1. Nama satuan kerja lengkap

`SATKER[].nama` memakai nama resmi lengkap: "Lembaga Pemasyarakatan", "Rumah Tahanan Negara", "Balai
Pemasyarakatan", "Lembaga Pembinaan Khusus Anak", "Kantor Wilayah". `namaSingkatSatker` dihapus; seluruh
pemakaiannya diganti `namaTampilSatker`, yang kini mengembalikan nama apa adanya. Label jenis satker tidak
lagi ditempel di samping nama karena sudah menjadi bagian namanya.

Pencocokan nama (`cariSatker`) tidak berubah: `kunciSatker` sudah menyeragamkan bentuk panjang dan pendek,
sehingga nilai `unitKerja` lama yang tersimpan tersingkat tetap dikenali dan ditampilkan lengkap. Dua uji
menjaga keduanya: nama daftar tidak boleh mengandung singkatan, dan bentuk singkat lama harus tetap cocok.

Nilai `unitKerja` pegawai yang sudah tersimpan tidak diubah massal. Penyimpanan berikutnya menulis nama
lengkap karena formulir menyimpan `satker.nama`, dan tampilan selalu melewati `namaUnitKerja`.

### 2. Notifikasi

- **Pengingat yang selesai urusannya ditutup.** `rencanaNotifikasi` mengumpulkan pegawai yang pengingatnya
  masih berlaku hari ini; notifikasi `kgb_jatuh_tempo` dan `rapelan` untuk pegawai di luar daftar itu
  ditandai dibaca. Sebelumnya hanya `sk_menunggu_keuangan` yang ditutup otomatis, sehingga pengingat lama
  menumpuk selamanya.
- **Tipe baru `sk_terbit`.** Dibuat untuk KGB berstatus selesai yang dikonfirmasi keuangan dalam 14 hari
  terakhir, satu kali per KGB. Ini kabar untuk UPT bahwa berkas SK sudah dapat diunduh.
- **Admin UPT menerima notifikasi satkernya sendiri:** `kgb_jatuh_tempo`, `rapelan`, dan `sk_terbit`.
  Penyaringan per satker dilakukan di `GET /api/notifikasi` dengan membaca satker dari baris pengguna,
  bukan dari token. Karena status dibaca dipakai bersama semua penerima, peran lihat-saja tidak boleh
  mengubahnya: `PATCH /api/notifikasi` dan `PATCH /api/notifikasi/[id]/baca` menolak `admin_upt` dengan 403.
- **`POST /api/notifikasi/periksa`** menjalankan pemeriksaan tanpa menunggu jeda 15 menit, untuk tombol
  "Periksa sekarang". Terbuka untuk peran Kanwil, tertutup untuk peran lihat-saja.

### 3. Tiga halaman administrasi memakai bahasa desain dasbor

Pengguna, Log Aktivitas, dan Pengaturan memakai `dsb-halaman` dengan `data-muat-layar`: kepala halaman,
strip angka, lalu dua kolom — kolom kerja di kiri dan kolom pendamping di kanan. Yang bergulir hanya isi
panel, bukan halamannya.

- **Pengguna:** tabel akun dengan tindakan per baris, kolom kanan berisi saringan peran dan permintaan
  perubahan profil. Ditambah tindakan "Pindah satuan kerja" untuk akun Admin UPT, yang API-nya sudah ada
  tetapi belum punya antarmuka. Akun yang sedang login tidak dapat menghapus dirinya sendiri atau mengatur
  ulang passwordnya dari sini.
- **Log Aktivitas:** entri dikelompokkan per hari dengan kepala hari yang menempel, dan `GET /api/audit-log`
  mengembalikan ringkasan jumlah per jenis aksi untuk seluruh hasil saringan, bukan hanya halaman yang
  tampil. Saringan awal 30 hari terakhir.
- **Pengaturan:** satu bagian tampil sekaligus, dipilih dari daftar bagian di kolom kanan, sehingga halaman
  tidak lagi memanjang. Tombol simpan ada di kepala halaman dan di kaki panel.

### 4. Halaman publik

Dua bagian panduan baru, beserta entri di `DAFTAR_ISI` dan pemetaan `PERAN`:

- **`cpns-pns`** — KGB pertama setelah CPNS diangkat PNS: masa kerja golongan dihitung sejak TMT CPNS,
  gaji CPNS 80 persen, TMT PNS mengikuti SK pengangkatan dan tidak berlaku surut, dan kekurangan gaji hanya
  dihitung untuk bulan yang benar-benar terlanjur dibayar dengan gaji pokok lama.
- **`kenaikan-pangkat`** — potongan MKG saat pindah golongan, apa yang berubah dan apa yang tetap, serta
  cara mencatatnya di SIM-KGB.

Beranda `/kgb` menambah tiga catatan jadwal yang menunjuk ke bagian-bagian itu dan ke akun Admin UPT.
Dasar hukum panduan menambah PP 11/2017 jo PP 17/2020 dan SE Kepala BKN Nomor 10 Tahun 2022.

## Akibat

- Nama satker menjadi panjang, sehingga beberapa kolom tabel memakai pemenggalan dengan `title` atau
  membungkus ke baris kedua. Ini diterima karena nama resmi lebih penting daripada kerapatan kolom.
- Pengingat KGB yang sudah diinput hilang dari daftar "belum dibaca" pada pemeriksaan berikutnya. Riwayatnya
  tetap ada di tab "Semua".
- Akun Admin UPT tidak dapat menandai notifikasi dibaca. Daftarnya selalu menampilkan keadaan terkini;
  ini konsekuensi status dibaca yang dipakai bersama, sesuai ADR-004 yang menjadikan peran ini lihat-saja.
