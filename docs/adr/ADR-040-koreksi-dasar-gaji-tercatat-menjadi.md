# ADR-040: Koreksi dasar gaji dibaca sebagai perbandingan "Tercatat → Menjadi"

Tanggal: 30 September 2026
Status: berlaku

## Konteks

Pada modal **Ubah dasar KGB**, tautan *Koreksi data yang salah ketik* membuka lima isian: golongan ruang,
masa kerja golongan, TMT golongan, TMT KGB terakhir, dan TMT KGB berikutnya. Pemilik melaporkan layar itu
"masih sangat membingungkan cara mengisinya", dan menanyakan kapan masing-masing isian sebenarnya dipakai.

Pemeriksaan kodenya menemukan empat hal.

1. **Label kembar tanpa penanda.** Blok ringkasan abu-abu (`pgw-ringkas-dl`) tetap tampil di atas, memuat
   Golongan, Masa kerja golongan, TMT KGB terakhir, dan TMT KGB berikutnya — lalu persis di bawahnya lima
   isian dengan label yang hampir sama. Tidak ada yang menyatakan mana nilai tercatat dan mana nilai yang
   akan disimpan. Ringkasannya berisi empat hal, isiannya lima; TMT golongan tidak punya pembanding.

2. **Mengganti golongan menghapus masa kerja, diam-diam.** `onChange` golongan memanggil
   `ubah("mkg")("0_0")`. Membetulkan salah ketik golongan III/b → III/c karena itu sekaligus menjatuhkan
   masa kerja ke 0 thn 0 bln dan gaji pokok ke angka terendah golongan itu, tanpa pesan apa pun. Ini cacat,
   bukan sekadar soal tampilan.

3. **Akibatnya tidak terlihat.** Yang benar-benar berubah adalah **gaji pokok**, dan tidak ada satu baris
   pun yang menyebutnya. Padahal justru angka itu yang menentukan koreksinya benar atau keliru — kasus
   NOOR AZMI SYAHBUDIN bulan ini berpangkal persis dari satu angka masa kerja yang salah salin.

4. **TMT KGB berikutnya diketik tangan.** Di impor Data Pegawai maupun formulir UPT, jadwal itu dihitung
   (`bulanKeKgbBerikutnya`), sebab selangnya tidak selalu dua tahun. Di layar koreksi ia dibiarkan manual,
   sehingga koreksi golongan atau masa kerja dapat meninggalkan jadwal yang bertentangan dengan angkanya.

## Keputusan (pemilik, 30 September 2026)

1. **Satu tabel berlajur "Tercatat" dan "Menjadi"**, menggantikan blok ringkasan dan isian yang terpisah.
   Tiap baris memuat nama isian, keterangan singkat *kapan dipakai*, nilai yang tercatat, dan isiannya.
2. **Akibat koreksi ditampilkan hidup** sebagai dua baris terakhir: gaji pokok dan TMT KGB berikutnya,
   keduanya lama berdampingan dengan baru. Angka yang benar-benar bergerak diberi warna, sehingga koreksi
   yang ternyata tidak mengubah apa pun juga terbaca.
3. **Mengganti golongan mempertahankan masa kerja** bila langkah itu ada pada golongan baru — keadaan yang
   paling lazim, sebab tabel PP 5/2024 memakai langkah masa kerja yang sama untuk hampir semua golongan.
   Bila tidak ada, diambil langkah terdekat dan **dikatakan di layar**, bukan diubah diam-diam.
4. **TMT KGB berikutnya dihitung sistem**, dengan tautan *Tulis sendiri* untuk menimpanya bila jadwalnya
   memang bergeser, misalnya karena penundaan hukuman disiplin.

Keterangan "kapan dipakai" yang kini tercetak di tiap baris:

| Isian | Dipakai saat | Pengaruhnya |
|---|---|---|
| Golongan ruang | golongan yang tercatat salah ketik sejak awal | menentukan kolom tabel gaji |
| Masa kerja golongan | angka MKG pada SK KGB atau SK pangkat terakhir salah salin | menentukan **gaji pokok** |
| TMT golongan | tanggal berlakunya golongan salah ketik | tidak dipakai menghitung KGB |
| TMT KGB terakhir | TMT pada SK KGB terakhir salah ketik | titik hitung jadwal berikutnya |

TMT golongan memang tidak masuk hitungan: `kalkulasiKGB` hanya membaca golongan, masa kerja golongan,
TMT KGB terakhir, dan TMT KGB berikutnya. Menyatakannya di layar mencegah operator mengira tanggal itu
yang menggeser jadwal.

## Akibat

- Hitungannya dipindah ke `lib/koreksiDasarGaji.ts` — modul murni, sehingga dapat diuji tanpa tampilan
  (`lib/koreksiDasarGaji.test.ts`). Cacat nomor 2 di atas kini punya uji yang menjaganya.
- Kenaikan pangkat yang sah tetap lewat **Catat kenaikan pangkat**; peringatan kuning di layar koreksi
  menyebutkannya secara tegas, bukan sekadar mengatakan "pakai untuk salah ketik".
- Pada layar sempit, ketiga lajur menjadi satu lajur dan nilai tercatat diberi awalan "Tercatat: " supaya
  tidak terbaca sebagai nilai baru.
- Koreksi tetap tidak mencatat riwayat kenaikan pangkat atau PMK, dan tetap tercatat di Log Aktivitas.
  Yang berubah hanyalah keterbacaannya.
