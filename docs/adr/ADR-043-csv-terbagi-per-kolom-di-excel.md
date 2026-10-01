# ADR-043: Berkas CSV terbagi per kolom di Excel — petunjuk `sep=;`

Tanggal: 1 Oktober 2026
Status: berlaku

## Konteks

Pemilik membuka `docs/demo/demo-pegawai-kanwil.csv` di Excel dan seluruh isinya menumpuk di **kolom A**:
satu baris pegawai utuh — NIP, nama, jabatan, satker, golongan, sampai tanggal — menjadi satu sel
panjang. Hal yang sama terjadi pada templat yang diunduh Admin UPT.

Berkasnya sendiri sah. Yang berbeda adalah cara Excel membacanya: Excel **tidak** memisah kolom
berdasar koma, melainkan berdasar **"List separator"** pada Region Windows. Setelan di perangkat
pemilik, dibaca dari `HKCU\Control Panel\International`:

| Setelan | Nilai |
|---|---|
| `LocaleName` | `en-ID` |
| **`sList`** (List separator) | **`;`** |
| `sDecimal` | `,` |

Jadi Excel mencari titik koma, berkasnya berisi koma, dan karena tidak ada satu pun pemisah yang
dikenalinya, seluruh baris jatuh ke satu sel. Setelan yang sama (`sDecimal` koma) pula yang membuat NIP
tampil `1,97E+17`.

Ini bukan kekhususan satu perangkat: seluruh UPT di Kalimantan Selatan memakai Windows berwilayah
Indonesia, sehingga semua operator melihat gejala yang sama. Menyuruh mereka mengubah Region Windows
bukan jalan keluar — satu setelan sistem diubah demi satu berkas, dan tidak semua operator berwenang
mengubahnya.

Seluruh penghasil CSV di aplikasi memakai koma: templat Admin UPT, templat impor Kanwil, ekspor Data
Pegawai, dua ekspor Keuangan, CSV cadangan bulanan (ADR-018), dan berkas peragaan `docs/demo/`.

## Keputusan (pemilik, 1 Oktober 2026)

1. **Berkas diawali baris `sep=;` dan datanya dipisah titik koma.** Baris itu menimpa setelan Region,
   sehingga kolomnya terbagi benar di lokal mana pun — Indonesia maupun Amerika — tanpa operator
   menyentuh setelan Windows. Dipilih di atas "titik koma saja", yang hanya benar selama Region-nya
   Indonesia.
2. **Berlaku untuk seluruh penghasil CSV**, bukan templat Admin UPT saja, agar setiap unduhan berperilaku
   sama.

Templat `.xlsx` sungguhan — yang sekaligus mengunci kolom `nip` sebagai Text — ditimbang dan tidak
diambil sekarang: pekerjaannya jauh lebih besar dan menyentuh sisi unggah. Persoalan NIP tetap dijaga
dengan cara lama.

## Akibat

- **`lib/csv.ts` menjadi satu-satunya penentu bentuk berkas:** `PEMISAH_CSV`, `KEPALA_BERKAS_CSV`
  (BOM + `sep=;`), `selCsv`, `keBerkasCsv`, dan `buangPetunjukPemisah`. Empat salinan `selCsv` yang
  berbeda-beda di halaman Keuangan, impor Kanwil, dan cadangan dihapus, diganti yang satu ini.
- **Koma tetap dikutip** meski bukan lagi pemisah, agar berkasnya utuh di pengurai yang menebak sendiri
  pemisahnya.
- **Pembacaan unggahan membuang baris `sep=` lebih dulu** lewat `beforeFirstChunk` PapaParse, pada layar
  unggah UPT dan impor Kanwil. Pemisahnya sendiri tetap ditebak PapaParse, jadi berkas simpanan Excel —
  bertitik koma maupun berkoma — sama-sama terbaca; ini yang sudah berlaku sejak ADR-031 dan tidak
  berubah.
- **Yang tidak diselesaikan: NIP.** Klik ganda kini membagi kolomnya rapi, tetapi Excel tetap membaca NIP
  18 angka sebagai bilangan dan merusaknya. Peringatan di layar unggah karena itu ditambah satu kalimat:
  rapi bukan berarti aman, jalannya tetap **Data → From Text/CSV** dengan kolom `nip` disetel Text. CSV
  cadangan tidak terpengaruh, sebab kolom NIP-nya sudah ditulis `="…"`.
- **Baris `sep=` hanya dikenal Excel dan LibreOffice.** Google Sheets tidak mengenalnya dan akan
  menampilkannya sebagai baris pertama; baris itu tinggal dihapus setelah diimpor.
- **Berkas peragaan dibangun ulang** dengan `npx tsx scripts/buat-csv-demo.ts` agar bentuknya sama persis
  dengan berkas yang diunduh dari aplikasi, dan diperiksa ulang dengan `scripts/uji-csv-demo.ts`
  (12 + 14 baris, semuanya lolos pemeriksa yang sesungguhnya dipakai aplikasi).
- Diuji: `lib/csv.test.ts` menjaga bentuk berkas, pengutipan, pembuangan baris `sep=`, dan urai balik
  PapaParse untuk berkas bertitik koma maupun berkoma. Seluruh 433 uji lolos; `tsc --noEmit` dan ESLint
  bersih pada berkas yang disentuh.
