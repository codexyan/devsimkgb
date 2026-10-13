# ADR-112: Pegawai baru dari UPT langsung terdata; yang ditinjau Kanwil adalah usulan KGB-nya

Tanggal: 13 Oktober 2026
Status: berlaku. Mengubah prinsip "UPT hanya mengusulkan, pegawai baru masuk data induk setelah Kanwil menyetujui"
(ADR-004, ADR-007, ADR-072, ADR-091) pada satu hal saja: kapan baris pegawai dibuat. Tinjauan Kanwil, surat usulan, dan gerbang
Input KGB (ADR-014) tetap.

## Konteks

Ahmad Rijani (lahir 28 November 1989) tidak dapat ditambahkan Super Admin karena Admin UPT sudah menyiapkan drafnya. Draf
pegawai baru hanya dilihat UPT, sehingga Kanwil tidak melihat apa pun, namun NIP-nya tertahan (ADR-110). Satu-satunya jalan
yang tersisa adalah UPT menghapus drafnya, atau mengajukannya dengan surat Srikandi lalu Kanwil menyetujuinya.

Pemilik menjelaskan bahwa urutannya keliru: **mendata pegawai tidak memerlukan tinjauan Kanwil**; yang memerlukan surat dan
tinjauan adalah **mengajukan KGB**. Pegawai yang sudah diinput UPT seharusnya tetap terdata, dan hanya proses KGB-nya yang
menunggu usulan pertamanya disetujui.

## Keputusan (pemilik, 13 Oktober 2026)

1. **Terdata begitu draf lengkap tersimpan.** Memakai definisi "lengkap" yang sama dengan saat diajukan
   (`kekuranganUsulan`, termasuk berkas wajib). Draf yang belum lengkap tetap draf biasa dan tampil sebagai baris bertanda,
   seperti ADR-072. Server membuat baris `pegawai` aktif (`lib/terdatakanPegawaiBaru.ts`, memakai pembentuk yang sama dengan
   persetujuan: `lib/pegawaiBaruDariUsulan.ts`) pada penyimpanan draf, pembuatan, dan pengajuan.
2. **Tidak ada skema baru.** Pegawai tertaut ke drafnya lewat `usulan_pegawai.pegawaiId`; jenis usulan tetap `baru` dan
   statusnya tetap `draf`, `menunggu`, atau `revisi`. "Data belum ditinjau" bukan kolom, melainkan keadaan pegawai yang
   punya usulan `baru` tertaut yang belum disetujui (`usulanBaruBelumDitinjau`, `idPegawaiBelumDitinjau`).
3. **Input KGB tertahan sampai usulan pertamanya disetujui.** `usulanMenahan` (ADR-014) kini menahan Input KGB, Arsip KGB,
   Buat SK, dan Unggah SK TTE selama pegawai itu punya usulan baru tertaut yang draf, dikembalikan, atau menunggu, di samping
   usulan perbaikan yang menunggu. Pesan penolakan menyebut keadaannya (belum diajukan, dikembalikan, atau menunggu tinjauan).
   Membatalkan KGB tetap boleh.
4. **Persetujuan melanjutkan pegawai yang sudah ada.** Pegawai yang tertaut dikenali dari `usulan.pegawaiId`, bukan dari
   perkiraan waktu (ADR-079). Isiannya ditulis ulang dengan hitungan yang sama, yang dicatat Kanwil sesudahnya (hukdis,
   mutasi, pemberhentian, penetap SK dasar, status aktif) dibiarkan, riwayat KP/PMK dibuat atau diperbarui tanpa menggandakan,
   jenis usulan tetap `baru`, dan Input KGB terbuka.
5. **Sunting sebelum ditinjau memperbarui pegawai di tempat**, termasuk membetulkan NIP; sesudah disetujui baris pegawai
   hanya berubah lewat usulan perbaikan atau Kanwil.
6. **Hapus di UPT = hapus draf dan nonaktifkan pegawainya**, tidak pernah menghapus permanen. Kanwil dapat mengaktifkannya
   kembali atau menghapusnya permanen; hapus permanen melepas tautan usulan yang belum selesai (`pegawaiId` menjadi kosong),
   dan penyimpanan berikutnya membuatkan pegawainya lagi. NIP pegawai nonaktif tidak dapat ditambahkan ulang oleh UPT, dengan
   pesan yang menyuruh meminta Kanwil mengaktifkannya.
7. **Pegawai pada ADR-091 tidak berubah.** Draf pegawai baru yang NIP-nya bentrok dengan pegawai lain (bukan pegawai yang
   dibuat dari draf itu sendiri) tetap diperlakukan sebagai perbaikan data bila satker sama, ditolak bila satker lain.

## Tampilan

Tidak ada komponen, tata letak, atau warna baru. Perubahan hanya logika, teks, dan penanda yang memakai kosakata yang sudah ada:

- **Kanwil**: Data Pegawai memberi baris kecil `Data belum ditinjau` di bawah NIP (tabel dan kartu mobile). Papan Kanwil
  memberi tanda `Data belum ditinjau` pada kartu yang tertahan, atau `Tertahan usulan UPT` bila usulannya sudah menunggu
  tinjauan. Detail Usulan UPT untuk pegawai terdata menyebut bahwa pegawainya sudah terdata dan persetujuan membuka proses
  KGB-nya; daftar usulannya menampilkan data lengkap, bukan selisih.
- **UPT**: draf yang lengkap tampil sebagai baris pegawai biasa di Pegawai Satker (tidak lagi ganda dengan baris bertanda),
  dengan keadaan `Data baru, belum diajukan ke Kanwil`, `Dikembalikan Kanwil, perbaiki`, atau `Data baru ditinjau Kanwil`.
  Perbarui data membuka formulir pegawai baru berisi drafnya. Usul KGB Kolektif memakai baris pegawainya dan tidak lagi
  menampilkan draf yang sama sebagai kartu kedua. Dialog hapus menjelaskan bahwa pegawainya ikut dinonaktifkan.
- **Notifikasi**: pengingat batas Input KGB tidak dikirim untuk pegawai yang datanya belum ditinjau (Input-nya memang
  ditolak); pengingat yang sudah ada ditutup. Notifikasi usulan menyebut pegawainya sudah terdata.
- **Log Aktivitas**: aksi baru `terdata_pegawai_baru` (`Pegawai baru terdata`).

## Akibat dan batasan yang disengaja

- Hitungan dasbor (jumlah pegawai, KGB tahun ini, belum diproses, terlambat) kini ikut menghitung pegawai yang datanya belum
  ditinjau, sebab pegawainya nyata dan KGB-nya memang akan jatuh tempo. Tanda `Data belum ditinjau` menjelaskan mengapa
  prosesnya tertahan.
- Pegawai terdata yang TMT-nya jatuh pada periode usul berjalan ikut tercentang di mode periode Usul KGB Kolektif. Ini
  melanjutkan aturan ADR-063 untuk pegawai biasa: mereka orang yang memang harus diusulkan pada periode itu. Draf yang belum
  lengkap tetap tidak ikut kecuali dipilih.
- Impor Unggah daftar tetap membuat draf yang belum lengkap (berkas pindaian tidak lewat CSV), sehingga barisnya baru terdata
  setelah dilengkapi di Usul KGB Kolektif.
- Edit Kanwil pada pegawai yang datanya belum ditinjau (PUT Data Pegawai) tetap diperbolehkan; isian draf UPT akan menimpa
  kolom yang sama pada penyimpanan draf berikutnya atau saat disetujui. Kanwil yang ingin membetulkan sebaiknya mengembalikan
  usulannya (atau menunggu pengajuan) agar UPT yang memperbaiki.
- Nonaktifkan oleh Kanwil tidak menghapus drafnya; UPT yang menyimpan ulang memperbarui pegawai yang sama dan tidak
  mengaktifkannya kembali.

## Uji

`lib/terdatakanPegawaiBaru.test.ts` (membuat pegawai tertaut, memperbarui di tempat tanpa menimpa catatan Kanwil, tidak
membuat dari draf belum lengkap, perbaikan, usulan selesai, atau NIP yang sudah dipakai, tautan menggantung, penahan tiga
status, persetujuan tanpa pegawai ganda), `lib/usulanBaruTercatat.test.ts` (pegawai dari draf sendiri bukan bentrokan),
`lib/generateNotifikasi.test.ts` (pengingat ditahan dan ditutup, pesan usulan terdata). Alur nyata diperiksa di peramban
sebagai Admin UPT dan Super Admin.
