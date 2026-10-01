# ADR-045: Satu SK satu kartu di Admin UPT, dan pindaian SK PMK punya tempatnya sendiri

Tanggal: 1 Oktober 2026
Status: berlaku; melengkapi ADR-044

## Konteks

ADR-044 memberi Admin UPT dua tindakan bernama, tetapi keduanya membuka **jendela yang sama**:
`FormulirUsulan`, 717 baris, memuat identitas, jabatan, pangkat, gaji, KGB, sebab perubahan, dan berkas
sekaligus. Yang dikerjakan tindakan itu hanya menggulirkannya ke bagian yang tepat. Operator yang
memegang satu SK kenaikan pangkat tetap disodori seluruh formulir perbaikan data.

Pola kartu sendiri-sendiri sudah ada di modul yang sama: `ModalLaporMutasi` (191 baris) dan
`ModalLaporHukdis` (297 baris) — satu urusan satu jendela, dan yang hukdis sudah memakai `KolomBerkas`
untuk pindaian SK-nya.

Celah kedua lebih serius. Berkas usulan ditentukan `BERKAS_USULAN`, dan slotnya hanya lima: surat usulan
Srikandi, SK KGB terakhir, SK kenaikan pangkat terakhir, SK CPNS, dan SK pengangkatan PNS. Untuk kenaikan
pangkat slotnya sudah ada dan malah sudah wajib; **untuk PMK tidak ada sama sekali**. SK peninjauan masa
kerja — dokumen yang menggeser masa kerja golongan dan memajukan jadwal KGB — tidak punya tempat untuk
diunggah, sehingga laporan PMK dari UPT sampai ke Kanwil tanpa satu pun dokumen pendukung dan disetujui
berdasar angka yang diketik saja.

## Keputusan (pemilik, 1 Oktober 2026)

1. **Satu SK, satu kartu.** `ModalDasarBaru` menggantikan jalan pintas ADR-044: kartu *Laporkan kenaikan
   pangkat* dan kartu *Laporkan peninjauan masa kerja*, masing-masing hanya memuat apa yang tertulis di SK
   itu, ditambah kotak **Dihitung sistem** dan satu kolom berkas. Identitas dan jabatan tetap di Usulkan
   perbaikan.
2. **Kolom `path_sk_pmk` pada `usulan_pegawai`**, dengan slot berkas "SK peninjauan masa kerja" yang hanya
   diminta bila sebab perubahannya PMK. Dipilih di atas menumpangkan pindaian PMK pada slot SK kenaikan
   pangkat, yang akan membuat satu kolom memuat dua jenis SK yang berbeda.
3. **Berkas wajib ditagih saat diajukan, bukan saat kartu disimpan** — sama dengan perlakuan berkas wajib
   lain (ADR-030), supaya operator yang pemindainya sedang antre tidak kehilangan apa yang sudah diketik.

## Akibat

- **Migrasi `20261001060000_usulan_sk_pmk.sql` dijalankan di Supabase produksi sebelum kodenya di-push**,
  bukan sesudah: `alter table public.usulan_pegawai add column if not exists path_sk_pmk text`. Kolomnya
  nullable dan tidak menyentuh baris yang ada.
- Pratayang pada kartu memakai fungsi yang **sama persis** dengan yang dipakai Kanwil saat menyetujui —
  `hitungKenaikanPangkat` dan `hitungPmk` — sehingga yang terlihat operator bukan taksiran. Kartu PMK pun
  menolak angka yang mustahil dengan kalimat yang sama dengan yang akan diucapkan Kanwil, misalnya "Masa
  kerja golongan pada SK PMK harus lebih besar dari masa kerja pegawai pada TMT PMK (9 tahun 3 bulan)".
- Kartu menyimpan lewat rute usulan yang sudah ada, jadi tidak ada tabel, rute, maupun panel tinjauan
  Kanwil yang baru. Karena rute PATCH menulis seluruh isian, kartu **selalu mengirim ulang nilai draf yang
  sudah ada** dan hanya menimpa yang memang ditetapkan SK-nya; tanpa itu, menyimpan dari kartu akan
  mengosongkan isian lain pada draf yang sama.
- Draf yang sudah menyebut sebab lain tidak ditimpa diam-diam: kartunya memberi tahu lebih dulu bahwa
  menyimpan akan menggantinya.
- **Pindaian SK PMK tidak ikut `bawaanPegawai`.** Berkas bawaan dimaksudkan untuk dokumen yang menempel
  pada pegawainya; SK PMK menempel pada satu peristiwa. Terbawa, PMK kedua akan tampak sudah berberkas
  padahal yang terlampir SK PMK yang pertama.
- `sebabAwal` pada `FormulirUsulan` dicabut kembali; formulir besar tetap menampilkan bagian sebab seperti
  sebelum ADR-044, kini beserta slot SK PMK-nya bila sebabnya PMK.
- Diperiksa pada data lokal dengan Chrome headless, sebagai Admin UPT Rutan Rantau:
  - kartu KP pada pegawai III/c menampilkan "Penata Tingkat I (III/d) · 12 thn 0 bln → 12 thn 0 bln ·
    Rp3.799.400" beserta catatan bahwa jadwal KGB tidak bergeser;
  - kartu PMK menampilkan "8 thn 0 bln → 8 thn 9 bln · Rp3.683.400 · KGB berikutnya 1 Februari 2028";
  - draf yang tersimpan dari kartu KP memuat sebab `kp` lengkap dengan nomor, tanggal, dan TMT-nya, dan
    kekurangannya menyebut SK KGB terakhir serta SK kenaikan pangkat terakhir;
  - draf dari kartu PMK menyebut kekurangan **SK peninjauan masa kerja**, yang sebelumnya tidak pernah ada.
- 441 uji lolos, termasuk tiga uji baru: kekurangan SK PMK, usulan non-PMK yang tidak pernah ditagih SK
  PMK, dan pindaian SK PMK yang tidak terbawa ke usulan berikutnya. `tsc --noEmit` dan ESLint bersih pada
  berkas yang disentuh.
