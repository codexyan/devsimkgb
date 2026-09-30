# ADR-036: Dasbor Kanwil hanya bertampilan papan, dan Pantau satker menjadi kartu per bulan TMT

Tanggal: 30 September 2026
Status: berlaku; mengubah tampilan ADR-013

## Konteks

**Dua tampilan antrian, satu yang dipakai.** Antrian kerja KGB punya tampilan daftar (tabel) dan papan
(kanban). Bawaannya daftar, sehingga setiap Super Admin mendarat di tabel — padahal pemilik menyatakan
hanya memakai papan. Selain itu lima ubin tahap (Perlu diproses, Lewat batas, Di keuangan, Selesai, Semua)
**memaksa pindah ke daftar** saat ditekan, dan **papan mengabaikan saringan tahap sepenuhnya**: papan
memakai `dalamBulan`, daftar memakai `antrian` yang sudah tersaring tahap. Jadi di papan, ubin itu hanya
papan skor yang melempar pengguna ke tampilan lain.

**Tiga panel pendamping yang tumpul.** Pemilik menilai Perlu tindakan, Jadwal input, dan Pantau satker
kurang berdaya:

- **Pantau satker** hanya memberi lima angka gabungan per satker — lewat batas, perlu input, diproses, di
  keuangan, usulan — **tanpa menyebut bulan TMT sama sekali**. "Rutan Rantau 5" tidak dapat ditindaklanjuti:
  lima itu jatuh di bulan mana, dan mana yang mendesak, tidak terbaca.
- **Jadwal input** memang memecah per bulan TMT, tetapi se-Kanwil, sehingga tidak menjawab satker mana.
- **Perlu tindakan** justru sudah bekerja: ia kotak masuk berisi peringatan beserta tautan aksinya.

Keduanya menyimpan setengah jawaban dari pertanyaan yang sama: *pekerjaan satker ini jatuh di bulan TMT
yang mana*.

## Keputusan (pemilik, 30 September 2026)

1. **Tampilan daftar dilepas.** Papan menjadi satu-satunya tampilan antrian; pemilih tampilan, tabelnya,
   kunci `localStorage` pilihannya, dan komponen `StatusAntrian` yang hanya dipakai tabel ikut dibuang.
2. **Ubin tahap menjadi penyaring papan.** Papan kini memakai `antrian`, yakni pegawai bulan terpilih yang
   lolos saringan tahap. Menekan ubin yang sedang aktif mengembalikan papan ke seluruh tahap.
3. **Pantau satker diganti kartu satker** (`PanelKartuSatker`), satu kartu per satker yang sedang punya
   pekerjaan, berisi baris per bulan TMT beserta tahap paling mendesak di bulan itu. Menekan satu baris
   bulan menyaring papan ke satker **dan** bulan itu sekaligus.
4. **Panel Jadwal input dilepas**, isinya terserap ke kartu satker. Lini masa se-Kanwil yang berdiri
   sendiri menjadi mengulang begitu rincian bulan melekat pada satkernya.
5. **Perlu tindakan dipertahankan** apa adanya.

## Akibat

- Tidak ada rute, skema, atau permintaan jaringan baru: kartu disusun dari `pegawaiJatuhTempo` yang sudah
  dimuat dasbor, dengan `posisiAntrian` yang sama dengan papan — sehingga angka di kartu dan isi papan
  tidak dapat berbeda.
- Cakupan kartu mengikuti `batasPipeline` di `app/api/dashboard/route.ts`: TMT sampai akhir tahun berjalan,
  minimal tiga bulan ke depan. Pandangan yang melintasi pergantian tahun menuntut cakupan itu diperlebar
  lebih dulu; itu belum dikerjakan.
- Satker tanpa pekerjaan tidak berkartu, hanya disebut jumlahnya satu baris, supaya rel pendamping tidak
  berisi belasan kartu kosong. Satker yang usulannya menunggu tetap berkartu meski tidak punya pekerjaan KGB.
- Aturan penyusunan dan pengurutannya murni di `lib/kartuSatkerDasbor.ts` beserta ujinya, termasuk bahwa
  yang sudah selesai tidak terhitung sebagai pekerjaan dan TMT yang belum tercatat tidak dikarang bulannya.
- Pengguna yang terbiasa membaca tabel kehilangan kolom yang dapat dipindai berurutan. Itu ditukar sadar
  dengan satu tampilan yang konsisten; bila kelak dibutuhkan lagi, menu Proses KGB tetap berbentuk daftar.
