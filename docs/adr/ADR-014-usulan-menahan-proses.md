# ADR-014: Usulan UPT yang menunggu menahan proses KGB, dan modul Usulan UPT dirancang ulang

Tanggal: 27 September 2026
Status: berlaku; melengkapi ADR-011

## Konteks

Usulan UPT yang menunggu tinjauan hanya ditandai di papan. Tim SDM tetap dapat melakukan Input KGB, Buat SK,
dan Unggah SK TTE dengan data lama. Bila usulannya disetujui belakangan, KGB memang dihitung ulang (ADR-011),
tetapi SK yang sudah dibuat terbuang. Bila SK TTE sudah diunggah, usulannya malah tidak dapat disetujui lagi.
Pemilik meminta usulannya ditinjau lebih dulu: perubahannya dipratinjau dan disetujui, baru prosesnya lanjut
dengan data terbaru.

Modul Usulan UPT juga hanya berupa daftar baris teks. Perubahannya baru terlihat setelah dibuka satu per
satu, dan panel petunjuk permanen memakan sepertiga layar.

## Keputusan

1. **Usulan yang menunggu menahan proses KGB** (`lib/usulanMenahan.ts`). Yang dihitung adalah usulan
   perbaikan berstatus *menunggu* untuk pegawai itu.
   - Rute yang menolak: Input KGB dan Arsip KGB (`POST /api/kgb`), Buat SK (`POST /api/kgb/[id]/pdf` tanpa
     pratinjau), dan Unggah SK TTE (`POST /api/kgb/[id]/upload-sk`).
   - Batalkan KGB tetap boleh.
   - Usulan yang dikembalikan ke UPT tidak menahan. Bila UPT mengirim ulang, pegawainya tertahan lagi.
   - SK yang sudah diunggah (menunggu keuangan) tidak tertahan.
2. **Antrian kerja mengikuti aturan yang sama.** Baris dan kartu pegawai yang tertahan berstatus
   *Tertahan usulan UPT*. Satu-satunya langkah yang tersedia adalah **Tinjau usulan UPT** (tombol ungu),
   ditambah Batalkan untuk KGB yang sedang diproses. Kartu tidak dapat diseret. Setelah disetujui, datanya
   diperbarui dan langkah berikutnya langsung tersedia.
3. **Isi tinjauan dipakai bersama** (`DetailUsulan`) oleh halaman Usulan UPT dan jendela tinjauan di antrian:
   - perubahan lama → baru, dengan baris dasar gaji disorot;
   - dampak persetujuan pada KGB yang berjalan (`kgb` dari `GET /api/usulan`);
   - laporan hukdis, SK dasar, dan catatan UPT;
   - berkas pendukung.
4. **Modul Usulan UPT dirancang ulang.**
   - Tab: Menunggu tinjauan, Dikembalikan, Selesai, dan Laporan mutasi, masing-masing dengan jumlahnya.
   - Daftar di kiri dikelompokkan per surat, dengan tombol Setujui seluruh surat.
     *Diubah 28 September 2026:* daftar menjadi satu butir per pegawai (NIP), dikelompokkan dan dapat disaring
     per UPT. Usulan lain pegawai yang sama tampil sebagai Riwayat usulan di detail, sehingga nama tidak lagi
     berulang. Angka tab menghitung pegawai. Setujui seluruh surat pindah ke detail usulan yang menunggu, dan
     tampil bila suratnya memuat lebih dari satu usulan yang menunggu.
   - Panel detail di kanan dengan pratinjau berkas di tempat. Tombol Kembalikan dan Setujui menempel di bawah.
   - Panel petunjuk permanen dihapus.

## Akibat

- Tidak ada perubahan skema.
- `GET /api/usulan` kini juga membaca riwayat KGB dan surat, untuk menampilkan dampak persetujuan.
