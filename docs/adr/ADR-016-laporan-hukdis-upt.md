# ADR-016: Modul hukuman disiplin Admin UPT

Tanggal: 27 September 2026
Status: berlaku

## Konteks

UPT memegang SK hukuman disiplin pegawainya, tetapi yang berwenang mencatat hukdis dan menggeser jadwal KGB
adalah SDM Hukdis Kanwil.

- Sampai ADR-015, UPT hanya dapat melaporkan hukdis lewat centang *Ada hukuman disiplin* di formulir usulan
  data. Laporannya menumpang pada usulan data dan sampai di meja Tim SDM KGB, yang tidak berwenang mencatat
  hukdis. SDM Hukdis tidak menerimanya sebagai antrean sendiri.
- Laporan itu tidak membawa pindaian SK hukumannya, dan hukdis tidak dapat dilaporkan tanpa sekaligus
  membuat usulan data.
- Sesudah dicatat Kanwil, UPT hanya melihat penanda "KGB ditunda" di daftar pegawai (ADR-004).

## Keputusan

1. **Modul Hukuman Disiplin untuk Admin UPT** (`/dashboard/upt/hukdis`, komponen `HukdisUpt`), berisi dua hal:
   - **Lapor.** Jenis hukuman dipilih dari katalog `HukdisJenis`. UPT mengisi nomor dan tanggal SK, TMT
     mulai, TMT berakhir (terisi dari masa hukuman jenisnya), dan keterangan, lalu mengunggah pindaian SK
     (PDF, paling besar 1 MB, wajib). Yang dikirim adalah laporan: data pegawai dan jadwal KGB tidak berubah.
   - **Pantau.** Daftar laporan yang pernah dikirim beserta statusnya (menunggu, dikembalikan dengan catatan
     Kanwil, sudah dicatat), dan hukdis pegawai satker yang sudah tercatat.
2. **Tinjauan oleh SDM Hukdis.** Laporan masuk ke tabel baru `laporan_hukdis` (`lib/laporanHukdis.ts`) dan
   tampil sebagai panel *Laporan dari UPT* di modul Hukuman Disiplin Kanwil, dengan notifikasi `hukdis_upt`
   untuk SDM Hukdis dan Super Admin.
   - **Catat** membuka formulir input hukdis yang sudah ada, terisi dari laporan. Peninjau boleh
     mengubah isiannya setelah mencocokkannya dengan SK.
   - Penyimpanannya memakai jalur yang sama dengan input hukdis biasa (`lib/catatHukdis.ts`): riwayat hukdis,
     penanda pada pegawai, dan penggeseran KGB bila menunda. Laporannya menjadi *diterima* dan menunjuk ke
     baris riwayat yang terbit darinya.
   - **Kembalikan** menuntut catatan. Laporan kembali ke UPT, yang memperbaikinya lalu mengirim ulang;
     pindaian SK lama ikut bila tidak diganti. UPT menerima notifikasi `hukdis_dikembalikan`.
   - Satu pegawai hanya boleh punya satu laporan yang belum dicatat.
3. **Tampilan hukdis tercatat tetap terbatas (ADR-004).** Untuk hukdis yang sudah dicatat, UPT hanya melihat
   status berlaku, dampaknya pada KGB, dan tanggal berakhir. Jenis, nomor SK, keterangan, dan dasar hukumnya
   tidak dikirim ke UPT. Laporan yang dikirim UPT sendiri tetap terlihat utuh, karena isinya berasal dari UPT.
4. **Centang hukdis di formulir usulan data dihapus.** Semua laporan hukdis lewat modul ini, supaya SDM Hukdis
   punya satu antrean. Usulan lama yang telanjur memuat laporan hukdis tetap menampilkannya di tinjauan
   usulan, tetapi usulan baru tidak lagi memuatnya.

## Akibat

- Tabel baru `laporan_hukdis` (migrasi `20260927100000_laporan_hukdis.sql`). Karena migrasi dijalankan manual:
  - Selama tabel belum ada, modul UPT dan panel Kanwil menampilkan pemberitahuan "belum aktif".
  - Pengiriman laporan dijawab 503 dengan pesan yang jelas, bukan galat server.
- Pindaian SK disimpan di R2 dengan pola kunci berkas usulan (`usulan/<satker>_skHukdis_...`). Berkas dibuka
  lewat `/api/hukdis/laporan/[id]/berkas`, yang hanya boleh diakses SDM Hukdis, Super Admin, dan Admin UPT
  satker pelapornya. Tim SDM KGB tidak dapat membukanya.
- `POST /api/pegawai/[id]/hukdis` kini memanggil `catatHukdis`; perilakunya tidak berubah.
- Menu Admin UPT mendapat entri *Hukuman Disiplin*. Dasbor SDM Hukdis menampilkan jumlah laporan yang menunggu
  di *Perlu tindakan*.
