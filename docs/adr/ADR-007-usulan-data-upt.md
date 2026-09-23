# ADR-007: UPT menginventarisir data pegawainya dan mengusulkannya ke Kanwil

**Status:** Diterima
**Tanggal:** 23 September 2026
**Penentu:** Pemilik SIM-KGB bersama tim keuangan Kanwil
**Cakupan:** tabel `usulan_pegawai`, `lib/usulanPegawai.ts`, `lib/konfirmasiUpt.ts`,
`lib/pemeriksaanUlangKgb.ts`, API `/api/upt/usulan`, `/api/upt/konfirmasi`, `/api/usulan`,
halaman `/dashboard/usulan`, dashboard Admin UPT, dan bagian panduan untuk UPT

## Konteks

Tim keuangan mengingatkan satu hal yang tidak tertangani: UPT harus benar-benar memastikan masa kerja
golongan dan status hukuman disiplin pegawainya, karena salah data berujung pada kekurangan gaji atau,
yang lebih berat, kelebihan gaji yang harus disetor kembali ke kas negara. Asimetrinya nyata — rapel
diselesaikan dengan SPM-LS kekurangan gaji, sedangkan kelebihan bayar menjadi temuan pemeriksaan.

Dua celah ditemukan saat menelusuri kode:

1. **Hukuman disiplin hanya diperiksa sekali**, yaitu saat Input KGB (`app/api/kgb/route.ts`). Jarak input
   ke TMT sekitar dua bulan, dan hukuman disiplin yang terbit di sela itu lolos tanpa peringatan sampai
   SK terbit. Status aktif pegawai juga tidak diperiksa ulang.
2. **Dokumen aslinya dipegang UPT, tetapi yang mengetik datanya Kanwil.** Pengetikan ganda inilah sumber
   salah masa kerja golongan yang dikhawatirkan tim keuangan.

ADR-004 menetapkan Admin UPT sebagai peran lihat-saja. Keputusan ini mengubahnya secara terbatas.

## Keputusan

### 1. Pemeriksaan ulang pada dua pintu terakhir

`lib/pemeriksaanUlangKgb.ts` memeriksa hukuman disiplin yang menunda KGB dan status aktif pegawai saat
**Buat SK** dan saat **Konfirmasi keuangan**, bukan hanya saat Input KGB. Bila tidak lolos, permintaan
ditolak dengan 409 beserta langkah perbaikannya. Ditambah notifikasi **KGB perlu ditinjau** untuk KGB
berjalan yang keadaan pegawainya berubah, agar Tim SDM tahu sebelum menabrak penolakan itu.

### 2. Konfirmasi data per siklus oleh UPT

Admin UPT menyatakan bahwa masa kerja golongan, gaji pokok dasar, dan status hukuman disiplin sudah benar
untuk satu siklus KGB. Yang disimpan adalah TMT yang dikonfirmasi (`konfirmasi_upt_tmt`), bukan sekadar
penanda, sehingga konfirmasi kedaluwarsa sendiri saat pegawai masuk siklus berikutnya. Statusnya terlihat
Tim SDM pada kartu antrian KGB.

Konfirmasi ini **tidak menghalangi** pembuatan SK. Dari 18 UPT belum semuanya punya akun, dan memblokir
proses karena alasan administratif akan membuat KGB terlambat — yang justru menimbulkan rapel.

### 3. Usulan data pegawai dari UPT

UPT mengisi data pegawainya sendiri dan mengirimkannya sebagai **usulan**; Kanwil yang menerapkannya.
Polanya mengikuti `ProfileChangeRequest` yang sudah ada di aplikasi ini.

- **Cakupan:** biodata lengkap, data KGB (golongan, masa kerja golongan, gaji pokok, TMT), nomor dan
  tanggal SK terakhir sebagai dasarnya, serta laporan hukuman disiplin. Mengusulkan pegawai baru belum
  termasuk; pegawai baru tetap ditambahkan Kanwil.
- **Peninjau:** Super Admin dan Tim SDM KGB (`canProcessKGB`), karena merekalah yang memakai datanya.
- **Surat Srikandi:** nomor dan tanggalnya wajib, salinan PDF-nya diunggah (paling besar 5 MB, disimpan di
  R2 dengan awalan `usulan/`). Berkas hanya dapat dibuka peninjau Kanwil dan UPT pengusulnya.
- **Kolom kosong berarti tidak diusulkan berubah.** Angka nol tetap nilai yang sah, karena masa kerja
  golongan 0 tahun 0 bulan adalah keadaan nyata pegawai yang belum pernah KGB.
- **Satu usulan menunggu per pegawai**, agar antrian tinjauan tidak berisi dua versi yang saling menimpa.
- **Laporan hukuman disiplin tidak otomatis menjadi catatan hukdis.** Penetapannya tetap pada SDM Hukdis
  lewat modul Hukuman Disiplin, karena butuh nomor SK dan penilaian dampaknya pada KGB. Halaman tinjauan
  menyatakan ini secara terbuka kepada peninjau.

### 4. Jadwal surat usulan digeser ke bulan kedua sebelum TMT

Sebelumnya surat dikirim pada bulan ketiga sebelum TMT. Yang mengikat sebenarnya bukan bulan suratnya,
melainkan kunci gaji induk: SPM gaji bulan M paling lambat tanggal 15 bulan M-1 (PMK 62/2023 Pasal 225).
Surat kini dikirim tanggal 1 sampai 10 bulan kedua sebelum TMT — bulan yang sama dengan dibukanya input di
SIM-KGB — sehingga tetap selesai sebelum rekon gaji, tanpa memaksa UPT berpikir tiga bulan ke depan.

Memindahkan seluruh proses ke bulan TMT, seperti sempat diusulkan, ditolak: SK yang diteken akhir bulan TMT
melewatkan gaji induk bulan itu dan bulan berikutnya, sehingga setiap KGB menjadi rapel dua bulan.

### 5. Admin UPT mengganti passwordnya sendiri

Sudah didukung `/api/profile` sejak awal, tetapi tidak ada jalan masuknya karena menu Admin UPT hanya
berisi Dashboard. Menu **Profil Saya** ditambahkan.

## Akibat

- Peran Admin UPT tidak lagi murni lihat-saja: ada tiga penulisan yang diizinkan — konfirmasi data,
  usulan data, dan ganti password sendiri. Ketiganya tidak mengubah data induk secara langsung, kecuali
  password akunnya sendiri.
- Data induk berubah lewat dua jalur: Tim SDM langsung, dan persetujuan usulan UPT. Keduanya tercatat di
  log aktivitas dengan rincian kolom yang berubah.
- Hukuman disiplin tetap tidak terbaca UPT. Yang dikirim ke UPT hanya penanda "KGB ditunda", sesuai
  ADR-004; laporan yang mereka kirim sendiri boleh mereka lihat kembali di daftar usulan.
