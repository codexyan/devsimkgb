# ADR-033: UPT tetap tidak menghapus data pegawai, pembatalan pencatatan lewat laporan, dan pita jadwal yang dapat ditelusuri

Tanggal: 29 September 2026
Status: berlaku; menguatkan ADR-004, memperluas jalur laporan pada ADR-016

## Konteks

**Hapus data pegawai.** Pemilik menanyakan apakah Admin UPT sebaiknya diberi akses menghapus data pegawai.
Keadaan sekarang: `canEditPegawai` hanya Super Admin dan SDM KGB (`app/api/pegawai/[id]/route.ts`), dan
peran `admin_upt` sengaja tidak masuk helper hak akses mana pun (ADR-004 butir 1), dijaga
`lib/auth/roles.test.ts`. Penghapusan punya dua rasa, dan yang permanen tidak dapat dibatalkan: ia ikut
memusnahkan riwayat KGB, surat KGB, serah terima, riwayat hukdis, berkas SK di R2, dan arsip dokumen.

Kebutuhan sah UPT sudah tertutup: pegawai pindah, pensiun, atau meninggal lewat **laporan mutasi dan
pemberhentian**; data keliru lewat **Usulkan perbaikan data**; draf yang belum dikirim memang sudah boleh
dihapus UPT sendiri. Yang belum tertutup hanya satu: pegawai yang **sudah disetujui padahal seharusnya
tidak pernah tercatat**; entri ganda, atau orang yang lahir dari NIP salah ketik. Untuk itu UPT terpaksa
melaporkan "pemberhentian" (yang membuat riwayatnya bohong, sebab orangnya tidak berhenti jadi PNS) atau
menghubungi Kanwil di luar sistem.

**Pita jadwal.** Kartu TMT di dashboard UPT hanya memuat angka tanpa jalan menuju namanya, sehingga tidak
dapat ditindaklanjuti. Pita itu juga hanya melihat ke depan: KGB yang TMT-nya sudah lewat namun belum
selesai tidak muncul sama sekali, padahal justru itu yang menjelaskan angka "Selesai TMT tahun ini" yang
timpang. Angka `terlambat` per satker sudah dikirim API tetapi tidak pernah ditampilkan.

## Keputusan (pemilik, 29 September 2026)

1. **UPT tetap tidak dapat menghapus maupun menonaktifkan data pegawai.** ADR-004 tidak diubah.
2. **Jenis laporan baru: "Pembatalan pencatatan"**, menumpang jalur laporan mutasi yang sudah ada
   (`laporan_mutasi`, `lib/mutasiPegawai.ts`), sebab bentuknya sama persis; UPT melapor, Kanwil menetapkan
   dan tabel tersendiri berarti menyalin seluruh antrian tinjauan, notifikasi, dan jejak auditnya.
   - **Isiannya berbeda dari jenis lain:** tidak ada SK dan tidak ada TMT berlaku, sebab barisnya keliru
     sejak awal. Yang wajib justru **alasan** (entri ganda, NIP salah ketik, tidak pernah bertugas di satker
     ini) dan **keterangan beserta buktinya**, karena tanpa SK hanya kalimat UPT yang dapat diperiksa Kanwil.
   - **Yang dilakukan Kanwil saat menerima: menonaktifkan (`aktif: false`), bukan menghapus.** Riwayat KGB
     dan berkas SK tetap utuh, dan Super Admin masih dapat memulihkannya bila laporannya yang keliru.
   - Kanwil tidak dapat membuat jenis ini langsung dari modulnya sendiri; ia hanya lahir dari laporan UPT.
3. **Kartu pita jadwal dapat dibuka.** Tiap kartu periode menjadi tombol yang menampilkan pegawai pada
   periode itu beserta keadaan KGB-nya, jumlah yang masih menunggu tindakan UPT, dan pintasan ke Usulan
   kolektif dengan pegawai itu sudah tercentang.
4. **Kartu "Terlambat" di kepala pita**, berisi KGB yang TMT-nya sebelum bulan usulan berjalan dan belum
   selesai. Pintasannya membuka Usulan kolektif dengan `?terlambat=1`, yang mencentang hanya yang benar-benar
   masih menunggu tindakan UPT: Kanwil belum memproses KGB-nya sama sekali. Halaman itu langsung dibuka pada
   saringan "Semua", sebab saringan periode justru menyembunyikan mereka.

## Akibat

- Tidak ada perubahan skema: `laporan_mutasi` sudah memuat `jenis`, `alasan`, dan `keterangan`.
- UI tinjauan Kanwil tidak berubah, sebab ia menampilkan label dari `LABEL_JENIS_MUTASI` secara umum.
- Nama tabel dan menunya tetap "mutasi" meski kini memuat jenis yang bukan perpindahan. Itu ditukar sadar
  dengan biaya menyalin seluruh alur tinjauan; bila kelak jenis non-perpindahan bertambah, penamaannya
  perlu ditinjau ulang.
- `perubahanPegawaiMutasi` kini dapat mengembalikan `aktif`, dan `catatMutasi` meneruskannya apa adanya ke
  `db.pegawai.update`.
- Pegawai yang dinonaktifkan hilang dari rekap dan daftar (`rekapSatker` menyaring `aktif`), sehingga angka
  satker langsung betul setelah Kanwil menerima laporannya.
