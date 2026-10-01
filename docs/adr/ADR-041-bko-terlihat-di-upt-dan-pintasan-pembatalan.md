# ADR-041: BKO terlihat oleh satker asal, dan pembatalan pencatatan mudah ditemukan

Tanggal: 30 September 2026
Status: berlaku; melengkapi ADR-033, tidak mengubah ADR-004

## Konteks

Pemilik menyampaikan dua hal: **fitur BKO belum ada** pada Data Pegawai Super Admin, dan **fitur hapus
data pegawai belum ada** pada Admin UPT. Pemeriksaan kodenya menunjukkan keduanya sudah ada; yang belum
ada adalah **jalannya masuk** dan **terlihatnya**.

### BKO

Penugasan BKO sudah terpasang utuh dan sudah berperilaku persis seperti yang dikehendaki pemilik,
tanggung jawab KGB tetap pada satker asal, BKO hanya keterangan. `lib/mutasiPegawai.ts`:

```ts
case "bko":
  return { satkerTugas: namaSatkerTujuan };   // unitKerja sengaja tidak disentuh
```

Karena seluruh perhitungan satker memakai `kodeSatkerPegawai(unitKerja)`, pegawai BKO tetap terhitung di
satker asal untuk KGB, SK, dan KPPN. Ada pula jenis *Selesai BKO, kembali ke satker asal* yang
mengosongkan `satkerTugas`.

Yang kurang:

| | Sebelum |
|---|---|
| Penanda "BKO di …" di Data Pegawai Kanwil | ada (`ringkasKeadaanPegawai`) |
| Penanda BKO di daftar pegawai Admin UPT | **tidak ada**; `GET /api/upt` bahkan tidak mengirim `satkerTugas` |
| Mencatat BKO dari baris daftar Kanwil | tidak ada; harus membuka halaman pegawai |
| Menyaring siapa saja yang sedang BKO | tidak ada |

Baris kedua yang paling janggal: satker asal memegang kewajiban mengusulkan dan merekam KGB pegawai itu,
tetapi tidak diberi tahu bahwa orangnya sedang bertugas di tempat lain. Operator yang melihat orangnya
tidak ada di kantor dapat menyangka usulannya bukan lagi urusannya.

### Hapus data pegawai UPT

Sudah diputuskan **ADR-033** sehari sebelumnya: UPT tetap tidak menghapus maupun menonaktifkan, dan
sebagai gantinya ada jenis laporan **"Pembatalan pencatatan"** untuk baris yang seharusnya tidak pernah
ada. Itu sudah terpasang; `ModalLaporMutasi` memuatnya, `POST /api/upt/mutasi` menerimanya, Kanwil
menetapkan `aktif: false`.

Masalahnya penamaan. Kemampuan itu bersembunyi di balik tombol **Laporkan mutasi**, tempat yang tidak
akan ditebak siapa pun yang sedang mencari cara membuang satu baris. Pertanyaan pemilik yang berulang
adalah buktinya.

## Keputusan (pemilik, 30 September 2026)

1. **`satkerTugas` dikirim `GET /api/upt`**, dan daftar pegawai Admin UPT menampilkan penanda kuning
   *BKO di &lt;satker&gt;* beserta kalimat **"KGB tetap diusulkan satker ini"**. Nama satkernya ditulis
   lengkap lewat `namaUnitKerja`.
2. **Kartu papan "Perlu dikerjakan" ikut menyebutnya**, supaya operator yang menyiapkan usulan tidak
   mengira orangnya sudah pindah.
3. **Pintasan "Seharusnya tidak tercatat?"** pada tiap baris pegawai UPT, membuka jendela laporan yang
   sama dengan jenis *Pembatalan pencatatan* sudah terpilih. `ModalLaporMutasi` menerima `jenisAwal`;
   jenisnya tetap dapat diganti di dalam jendela.
4. Panduan Admin UPT menyatakan keduanya: bahwa pegawai BKO tetap menjadi tanggung jawab KGB satker asal,
   dan bahwa pembatalan pencatatan adalah laporan, bukan penghapusan; beserta alasannya.

Yang **tidak** diambil, dan sebabnya: pemilik tidak memilih tombol Catat mutasi pada baris Data Pegawai
Kanwil, saringan "Sedang BKO", maupun tampilan bagi satker tempat pegawai ditugaskan. Ketiganya tetap
terbuka untuk nanti; jalur mencatat BKO lewat halaman pegawai sudah berjalan.

## Akibat

- Tidak ada perubahan wewenang. ADR-004 dan ADR-033 tetap berlaku utuh: Admin UPT tidak menghapus, tidak
  menonaktifkan, dan tidak menetapkan mutasi. Yang bertambah hanya keterbacaan dan satu pintasan.
- Muatan `GET /api/upt` bertambah satu kolom per pegawai; pada volume sekarang tidak berarti.
- Tautan "Seharusnya tidak tercatat?" tampil pada setiap baris yang belum punya laporan berjalan.
  Itu disengaja: kemampuan yang hanya diketahui orang yang sudah tahu bukanlah kemampuan yang tersedia.
- Basis data peragaan lokal (`.data-lokal`) lebih tua dari skema dan belum punya kolom `satkerTugas`;
  pembacaannya sudah aman (`?? null`), tetapi penandanya baru terlihat setelah kolom itu ada.
