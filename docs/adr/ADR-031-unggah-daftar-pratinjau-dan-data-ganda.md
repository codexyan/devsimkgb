# ADR-031: Unggah daftar pegawai UPT lewat pratinjau, konfirmasi per baris, dan data ganda menjadi usulan perbaikan

Tanggal: 29 September 2026
Status: berlaku; mengubah perilaku unggahan massal pada ADR-015

## Konteks

- **Pratinjaunya tidak memperlihatkan data.** Jendela Unggah daftar memeriksa berkas lewat `periksaSaja`,
  tetapi yang ditampilkan hanya tiga angka (siap disimpan, perlu dilengkapi, ditolak) dan kalimat galat.
  Operator tidak pernah melihat hasil bacaan sistem atas barisnya sendiri. Padahal kesalahan yang paling
  merugikan justru **lolos pemeriksaan**: `seragamkanTanggal` menerima beberapa format, sehingga
  `01/06/2025` yang dimaksud 1 Juni dapat terbaca 6 Januari dan tetap dinyatakan sah; kolom yang bergeser
  satu posisi juga tetap sah. Keduanya baru ketahuan setelah datanya tersimpan.
- **Konfirmasinya satu tombol untuk semua.** Tidak ada cara membuang satu baris yang mencurigakan tanpa
  menyunting CSV dan mengunggah ulang dari awal.
- **Data ganda seluruhnya ditolak.** NIP yang sudah tercatat sebagai pegawai dibuang dengan alasan "NIP
  sudah tercatat sebagai pegawai" dan dihitung sebagai baris gagal. Padahal itulah keadaan yang paling
  lazim: UPT mengunggah daftar pegawainya secara utuh, dan yang sudah tercatat gagal semua. Rute impor
  juga mematok `jenis: "baru"`, sehingga secara struktural tidak punya jalan membuat usulan perbaikan.
- **Usulan perbaikan yang sedang berjalan tidak terjaring.** Pemeriksaan bentrok hanya melihat kolom NIP
  pada usulan, padahal usulan perbaikan menyimpan `pegawaiId` dan mengosongkan NIP.

## Keputusan (pemilik, 29 September 2026)

1. **Pindah dari jendela ke halaman tiga langkah** `/dashboard/upt/unggah`, mengikuti pola Usulan kolektif
   (ADR-029): *Pilih berkas* → *Periksa & konfirmasi* → *Selesai*. Jendela kecil tidak memuat tabel ratusan
   baris, dan operator UPT membacanya di ponsel.
2. **Langkah 2 menampilkan seluruh baris**, masing-masing dengan:
   - penilaiannya: *Pegawai baru*, *Perbaikan data*, *Sama, dilewati*, atau *Ditolak* beserta sebabnya;
   - **nilai hasil bacaan server**, bukan tulisan mentah di berkas, termasuk kolom hitungan (pangkat, gaji
     pokok, TMT KGB berikutnya). Inilah yang membuat tanggal salah tafsir terlihat sebelum tersimpan;
   - **kotak centang per baris**; bawaannya semua yang dapat disimpan tercentang, operator membuang yang
     tidak dikehendaki. Hanya baris yang dicentang yang dikirim untuk disimpan.
   - Barisnya bukan `<table>` yang digulir mendatar: di layar lebar kisinya berbaris seperti tabel, di
     layar sempit tiap baris menumpuk menjadi kartu (alasan yang sama dengan ADR-029).
3. **NIP yang sudah tercatat di satker ini tidak lagi ditolak.** Barisnya dibandingkan dengan data induk
   lewat `bandingkanUsulan`:
   - ada kolom yang berbeda → **usulan perbaikan** (`jenis: "perubahan"`, `pegawaiId` terisi), dan layarnya
     menampilkan tabel *Tercatat sekarang* berdampingan dengan *Menurut berkas*, hanya kolom yang berbeda;
   - tidak ada yang berbeda → **dilewati**, bukan disimpan dan bukan pula dihitung gagal.
4. **Yang tetap ditolak** beserta alasannya yang disebutkan:
   - NIP bukan 18 digit, nama kosong, tanggal tidak valid, NIP kembar di dalam satu berkas;
   - NIP yang tercatat di satker lain, **dengan menyebut nama satkernya**, supaya operator menghubungi
     Kanwil alih-alih mengira NIP-nya salah ketik;
   - pegawai yang sedang punya usulan belum selesai, diperiksa lewat NIP maupun `pegawaiId`.
5. **Kelengkapan tidak dilonggarkan.** Draf boleh belum lengkap, dan CSV memang tidak membawa pindaian SK
   maupun sebab perubahan golongan (ADR-030). Keduanya tetap ditagih `kekuranganUsulan` saat draf itu
   diajukan dari Usulan kolektif, dan disebutkan per baris di layar pratinjau sebagai "perlu dilengkapi
   nanti".
6. **Berkas dinilai ulang saat menyimpan**, tidak mempercayai hasil pratinjau: keadaan basis data dapat
   berubah di sela dua permintaan itu. Baris yang penilaiannya sudah berbeda dilewati dan jumlahnya
   dilaporkan di langkah 3.

## Akibat

- Tidak ada skema, kolom, atau cron baru. Rutenya tetap `POST /api/upt/usulan/impor`, dengan tambahan
  `pilih` pada permintaan penyimpanan dan balikan per baris pada `periksaSaja`.
- Aturan penilaian tetap satu tempat di `lib/imporUsulanUpt.ts`; peramban hanya mengurai CSV dan
  menggambar hasilnya.
- `ModalImporUpt` dihapus; tombol *Unggah daftar* di Data Pegawai kini menuju halaman ini.
- Satu berkas kini dapat sekaligus menambah pegawai baru dan meremajakan data pegawai lama, yang sebelumnya
  hanya dapat dilakukan satu per satu lewat *Usulkan perbaikan data*.
- Usulan perbaikan hasil unggahan tetap harus ditinjau Kanwil seperti usulan lain; tidak ada data induk
  yang berubah langsung dari berkas.
