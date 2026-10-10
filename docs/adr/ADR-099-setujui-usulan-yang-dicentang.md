# ADR-099: Setujui usulan UPT yang dicentang

Tanggal: 10 Oktober 2026
Status: berlaku. Menggantikan persetujuan per surat dari detail usulan (ADR-015, ADR-076). Review SK oleh UPT (ADR-087)
tidak berubah.

## Konteks

Pengguna merasa alur validasi dari dasbor ke modul Usulan UPT terlalu panjang. Alur tinjauan Kanwil sebelumnya:
1. panel dasbor (ringkasan per UPT);
2. **Tinjau**, yang membuka halaman Usulan UPT tersaring ke UPT itu;
3. klik satu pegawai, buka berkasnya satu per satu, lalu **Setujui dan terapkan**;
4. ulangi untuk pegawai berikutnya.

Satu-satunya jalan pintas adalah **Setujui N usulan pada surat ini**, yang tidak dapat memilih: bila 3 dari 80 bermasalah,
ketiganya harus dikembalikan satu per satu dulu, atau semua ditinjau satu per satu.

Data produksi per 10 Oktober (agregat):

- **Usulan yang sudah ditinjau:** 85 usulan, 82 disetujui dan 3 dikembalikan (3,5%). Persetujuan 20 kali lewat per surat
  dan 13 kali satu per satu.
- **Usulan yang menunggu:** 80 usulan pegawai baru dalam satu surat dari LP Banjarmasin. Semuanya NIP baru, tanpa hukdis,
  dan masing-masing membawa SK KGB terakhir dan SK kenaikan pangkat. Pada 69 di antaranya masa kerja menurut SK kenaikan
  pangkat cocok dengan hitungan sistem; 11 lainnya tanpa SK sesudah SK KGB terakhir.
- **Periksa SK oleh UPT:** 57 SK, semuanya disetujui tanpa minta perbaikan, rata-rata dalam 0,9 jam.

Berkas wajib sudah ditagih saat UPT mengajukan. Isi pindaian SK tidak dapat diperiksa mesin; yang dapat dilakukan sistem
hanyalah menandai yang janggal menurut data.

Pilihan pengguna dari opsi yang diajukan:
- **Setujui yang dicentang** untuk tinjauan usulan. Opsi lain yang tidak dipilih: tinjau beruntun cepat, dan tinjau
  langsung di dasbor.
- **Periksa SK oleh UPT tetap seperti sekarang.** Opsi lain yang tidak dipilih: persetujuan massal oleh UPT, dan lewati
  review bila sama dengan usulan.

## Keputusan

1. **Tanda bersama** (`lib/tandaUsulan.ts`, diuji), dihitung dari data usulan yang menunggu.

   Usulan tidak dapat dicentang bila server pasti menolaknya:
   - NIP pegawai baru sudah tercatat di satker lain (ADR-091);
   - SK KGB-nya sudah diunggah, sedangkan usulan mengubah dasar gaji (ADR-011).

   Usulan tidak ikut tercentang sampai peninjau mencentangnya sendiri bila:
   - NIP sudah tercatat di satker yang sama;
   - SK KGB-nya sudah dibuat dan harus dibuat ulang;
   - KGB yang sedang diproses dihitung ulang karena dasar gajinya berubah;
   - ada laporan hukdis;
   - masa kerja menurut SK kenaikan pangkat berbeda dengan hitungan sistem, tidak diisi, atau SK-nya belum dapat dihitung.
2. **Keadaan SK terstruktur.** `periksaSkDilaporkan` (`lib/dasarSkUsulan.ts`) mengembalikan catatan yang sama dengan
   sebelumnya beserta keadaannya: `cocok`, `beda`, `belum_dicocokkan`, atau `belum_dihitung`. `GET /api/usulan`
   mengirimnya sebagai `keadaanSk` untuk usulan yang menunggu, sehingga tanda tidak menebak dari kalimat.
3. **Halaman Usulan UPT, tab Menunggu:**
   - tiap pegawai bercentang dan dikelompokkan per surat, dengan centang semua di kepala surat (dapat sebagian);
   - usulan tanpa tanda tercentang sejak awal;
   - tanda tampil di baris, dengan penjelasan saat penunjuk diarahkan ke tanda;
   - tombol **Perlu dilihat (k)** menampilkan yang bertanda saja;
   - baris yang detailnya sudah dibuka ditandai **Dilihat**, sebagai jejak sampel yang sudah diperiksa;
   - bilah di bawah daftar menyebut "N dari M usulan dicentang" dan berisi tombol **Setujui N yang dicentang**.

   Lingkupnya semua usulan menunggu di UPT yang sedang disaring. Pencarian dan saringan Perlu dilihat hanya menyaring
   tampilan.
4. **Konfirmasi** menyebut:
   - jumlah per surat;
   - usulan bertanda yang dicentang peninjau sendiri, beserta tandanya;
   - jumlah yang tetap menunggu.

   Persetujuannya memakai `POST /api/usulan/batch` yang sama, tiga usulan per permintaan (ADR-079). Kotak "Setujui N
   usulan pada surat ini" di detail dilepas. Setujui dan Kembalikan per pegawai tetap ada.
5. **Dasbor:** baris UPT di panel Usulan UPT menunggu menyebut "k perlu dilihat" (`ringkasUsulanPerUpt`).

## Akibat

- Untuk 80 usulan yang sedang menunggu, tinjauan menjadi: buka Tinjau, periksa beberapa sampel, lalu sekali Setujui.
  Usulan yang janggal tidak ikut tanpa disengaja.
- Usulan yang tidak dicentang tetap menunggu, sehingga proses KGB pegawainya tetap tertahan sampai disetujui atau
  dikembalikan (ADR-014).
- Persetujuan tetap tidak dapat dibatalkan. Jalan perbaikannya tetap Kembalikan usulan yang sudah disetujui (ADR-076).
- Tidak ada migrasi. `keadaanSk` dihitung saat dibaca.

## Uji

- Uji unit: `lib/tandaUsulan.test.ts` (5), keadaan SK di `lib/dasarSkUsulan.test.ts`, dan perlu dilihat di
  `lib/ringkasUsulanUpt.test.ts`.
- Uji di server lokal dengan 6 usulan menunggu pada dua surat:
  - panel dasbor menulis "6 usulan · 2 surat · 3 perlu dilihat";
  - dua usulan hukdis tidak tercentang, NIP di satker lain nonaktif, dan kepala surat berstatus sebagian;
  - saringan Perlu dilihat menampilkan 3 usulan;
  - mencentang sendiri satu usulan hukdis menjadikan 4 dicentang;
  - konfirmasi menyebut 1 usulan bertanda dan 2 yang tetap menunggu;
  - sesudah disetujui, tepat 4 usulan berstatus disetujui dan 2 tetap menunggu;
  - lebar 390 px tanpa gulir mendatar.
