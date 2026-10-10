# ADR-101: Pita jadwal Dasbor Admin UPT menjadi linimasa bulan kirim dengan tahap dan hitung mundur

Tanggal: 11 Oktober 2026
Status: berlaku. Mengganti pita jadwal per bulan TMT di Dasbor Admin UPT.

## Konteks

Pengguna menilai pita jadwal di kepala Dasbor Admin UPT kurang interaktif, kurang modern, dan indeksnya membingungkan.
Pita lama memuat empat kartu "TMT <bulan>", masing-masing dengan "N pegawai" dan "kirim 1–20 <bulan>", lalu kartu
"Selesai TMT <tahun>".

Masalah yang ditemukan:

1. **Dua bulan dalam satu kartu.** Judulnya bulan TMT, padahal tindakan UPT jatuh di bulan kirim, dua bulan sebelumnya.
   "TMT Des 2026" berarti kirim Oktober, jadi operator harus menerjemahkan sendiri.
2. **Angka tanpa status.** "0 pegawai" tidak menyebut berapa yang sudah diusulkan, sedang di Kanwil, SK terbit, atau
   selesai.
3. **Tidak ada rasa waktu.** Tidak ada hitung mundur ke batas kirim maupun posisi hari ini.
4. **"Selesai TMT 2026 · 0 / 0 · 0%" terbaca sebagai kegagalan**, misalnya di satker yang pegawainya belum tercatat.
5. **Kartu tidak tampak dapat diklik.** Tidak ada penanda, dan isinya hanya daftar dengan dua angka.
6. **Kartu Terlambat menyuruh mengajukan semua pegawai** yang TMT-nya lewat, termasuk yang sudah diproses Kanwil.
   Label di jendelanya menyebut "Menunggu diproses Kanwil" untuk pegawai yang justru belum diusulkan.

## Keputusan

Pilihan pengguna dari opsi yang diajukan:
- tata letak linimasa dengan hitung mundur;
- klik tetap membuka jendela, diberi tab status;
- empat tahap papan.

1. **Linimasa bulan kirim** (`lib/pitaJadwalUpt.ts`, diuji; `PitaJadwalUpt.tsx`). Empat bulan dimulai dari bulan
   berjalan, dan tiap kartu berjudul "Kirim <bulan>" dengan "TMT <bulan>" sebagai keterangan.

   Kartu bulan berjalan paling lebar dan memuat:
   - garis sebulan, dengan jendela kirim tanggal 1 sampai batas kirim surat (ADR-094) dan isi sampai hari ini;
   - titik hari ini;
   - pil Terbuka atau Ditutup;
   - hitung mundur: "sisa N hari", "hari terakhir kirim", atau "ditutup".

   Bulan berikutnya menyebut "dibuka N hari lagi".
2. **Empat tahap sama dengan kolom papan Alur KGB** (`tahapPita`):
   - **Perlu diusulkan:** belum diusulkan, draf, atau dikembalikan;
   - **Di Kanwil:** usulan ditinjau, data disetujui dan menunggu input KGB, atau KGB sedang diproses;
   - **SK terbit:** belum direkam di Gaji Web;
   - **Selesai.**

   Tiap kartu memuat batang bertumpuk dengan legenda warna. Kartu bulan berjalan menuliskan rinciannya, dan "N menunggu
   Periksa SK" bila ada, karena SK itu masih di Kanwil tetapi menunggu tindakan UPT.
3. **Kartu Terlambat** juga memakai batang tahap. Keterangannya menyebut "N perlu diusulkan", atau "sudah berjalan, belum
   selesai" bila semuanya sudah diproses.
4. **Kartu KGB tahun ini** berupa cincin kemajuan "selesai / total". Bila belum ada KGB tercatat, kartu menulis "Belum ada
   KGB <tahun> tercatat", bukan 0%.
5. **Pegawai baru yang sudah diusulkan** belum punya TMT tercatat, jadi tidak ditaruh di bulan mana pun. Pita menyebut
   jumlahnya: "N pegawai baru menunggu tinjauan Kanwil; masuk jadwal setelah disetujui".
6. **Jendela periode** tetap jendela (modal), dengan isi baru:
   - tab Semua dan empat tahap, masing-masing dengan jumlahnya; penanda tab bergeser, dan tab kosong nonaktif;
   - daftar yang muncul bergiliran;
   - label pegawai yang selaras dengan tahapnya, misalnya "Perlu diusulkan", "Draf disiapkan, belum diajukan", atau
     "Disetujui, menunggu input Kanwil".

   Tombol Siapkan usul KGB kolektif muncul bila ada yang perlu diusulkan.
7. **Gerak:**
   - kartu muncul bergiliran;
   - angka menghitung naik (`AngkaNaik`);
   - garis jendela terisi sampai hari ini, dan titik hari ini muncul lalu berdenyut;
   - batang tahap tumbuh dan cincin berputar naik;
   - kartu terangkat saat disorot, dengan panah bergeser.

   Semuanya mati bila Animasi disetel Kurangi atau perangkat meminta gerak dikurangi (`html[data-gerak]`,
   `kurangiGerak`).
8. **Ponsel:** pita menjadi korsel geser per kartu, tanpa menggeser halaman.

## Akibat

- Indeks pita kini sama dengan tindakan operator: bulan ini kirim surat untuk TMT dua bulan ke depan.
- Angka pita sejalan dengan kolom papan. Kolom papan memuat semua bulan, sedangkan pita per bulan TMT.
- Pita sedikit lebih tinggi (±110 px di desktop) karena batang tahap dan rinciannya.
- Hanya tampilan dan hitungan di peramban; tidak ada perubahan data, rute, atau migrasi.

## Uji

- `lib/pitaJadwalUpt.test.ts` (6 uji):
  - tahap sejalan dengan papan;
  - Periksa SK;
  - jumlah per tahap;
  - susunan bulan kirim dan TMT;
  - jendela kirim, termasuk hari terakhir, ditutup, pergantian tahun, dan Februari;
  - kalimat hitung mundur.
- Uji di peramban lokal, akun Admin UPT Rutan Rantau:
  - kartu Oktober menulis "4 pegawai · sisa 10 hari · 2 perlu diusulkan · 1 di Kanwil · 1 SK terbit", sama dengan papan;
  - tab jendela berisi 4/2/1/1/0, dengan Selesai nonaktif;
  - label daftar selaras dengan tabnya;
  - bingkai gerak pada 60–1800 ms menunjukkan kartu bergiliran, garis isi, titik hari ini, dan cincin;
  - dengan Kurangi, `animation: none` dan transisi 0 detik;
  - 1440×900 dan 1366×650 tanpa teks terpotong;
  - 390×844 menjadi korsel, tanpa gulir mendatar halaman.
