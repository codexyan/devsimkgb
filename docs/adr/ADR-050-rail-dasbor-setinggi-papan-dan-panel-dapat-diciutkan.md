# ADR-050: Rail dasbor benar-benar setinggi papan, dan panelnya dapat diciutkan

Tanggal: 1 Oktober 2026
Status: berlaku

## Konteks

Pemilik meminta panel Perlu tindakan dan Pekerjaan per satker setinggi-tingginya sama dengan papan
Antrian kerja KGB, dan menanyakan bagaimana supaya semuanya tetap terlihat sekaligus yang mendesak
menonjol. Ia menambahkan satu hal yang akan datang sendiri: begitu seluruh UPT terisi, isi kartu satker
akan menjadi banyak.

Diukur pada layar kerja 1584 x 805:

| Yang diukur | Nilai |
|---|---|
| Tinggi papan Antrian kerja KGB | 448 px |
| Tinggi rail kanan | 448 px |
| Isi rail seluruhnya | **1.108 px** |
| Tersembunyi di balik gulir rail | 660 px |

Railnya memang sudah dibatasi setinggi papan; isinya yang menuntut dua setengah kali lipat.

| Panel | Kelas | Tinggi |
|---|---|---|
| Perlu tindakan | `dsb-panel` tanpa peran | **485 px** |
| Pekerjaan per satker | `dsb-panel` tanpa peran | 475 px |
| SK UPT belum direkam | `dsb-panel dsb-susut` | 120 px |

Dua cacatnya tegas. **Perlu tindakan lebih tinggi daripada railnya sendiri**, sebab `app/dashboard/page.tsx`
mengirim `className=""` yang menimpa bawaan `dsb-susut`, sehingga panel itu kehilangan perannya dalam
model gulir layar kerja (ADR-003 butir 23 dan 26). **Pekerjaan per satker membatasi dirinya sendiri di luar
model itu**, lewat `max-height: min(520px, 48vh)` pada `.ksk-daftar`, angka mati yang tidak tahu berapa
sisa tinggi yang sebenarnya ada.

Kekhawatiran tentang banyaknya satker juga nyata: satu kartu satker rata-rata **234 px**, jadi 19 satker
berarti sekitar **4.400 px** isi dalam satu panel.

## Keputusan (pemilik, 1 Oktober 2026)

1. **Perannya dibetulkan lebih dulu**: Perlu tindakan kembali `dsb-susut`, Pekerjaan per satker menjadi
   `dsb-penuh` dengan daftarnya sebagai bagian bergulir, sehingga tinggi panel ditentukan ruang yang ada,
   bukan angka mati.
2. **Tiap panel rail dapat diciutkan**, dan pilihannya diingat per peramban, sama seperti kolom papan
   antrian. Yang diciutkan tinggal kepalanya beserta angkanya, jadi tetap terbaca sebagai penanda.
3. **SK UPT belum direkam bawaannya diciutkan**: panel itu penanda, bukan antrian kerja harian.

## Akibat

- Isi rail turun dari 1.108 px menjadi **448 px**, persis setinggi papan. Rail tidak lagi bergulir sebagai
  satu kesatuan; yang bergulir hanya daftar di dalam panel, dan kepala panel tetap terlihat.
- Panel menjadi 170, 200, dan 50 px. Menciutkan Perlu tindakan memindahkan ruangnya ke Pekerjaan per
  satker, yang tumbuh dari 200 menjadi 320 px: ruang yang dilepas satu panel langsung dipakai panel lain,
  bukan menyisakan lubang.
- `usePanelCiut` menyimpan peta id ke boolean di `kgb-panel-ciut`, bukan daftar yang diciutkan, supaya
  panel yang belum pernah disentuh tetap memakai bawaannya sendiri. Dibaca sesudah render pertama, sebab
  `localStorage` tidak ada di server dan dapat ditolak peramban pada mode privat.
- **Satu jebakan yang ditemukan saat mengerjakan.** Begitu `.ksk-daftar` menjadi bagian bergulir panel
  pengisi, tingginya menjadi pasti, dan grid dengan baris `auto` membagi tinggi itu rata ke seluruh kartu:
  enam kartu berubah menjadi garis setinggi **8 px** dengan isinya terpotong. `align-content: start` tidak
  menolong. Diuji empat kemungkinan langsung di peramban:

  | Percobaan | Tinggi kartu | Isi yang dapat digulir |
  |---|---|---|
  | Bawaan (baris auto) | 8 px | 112 px |
  | `grid-auto-rows: max-content` | **381 px** | **1.468 px** |
  | `display: block` | 381 px | 1.428 px |
  | `display: flex` kolom | 12 px | 112 px |

  Yang dipakai `grid-auto-rows: max-content`, sebab ia menyelesaikannya tanpa melepas tata letak grid-nya.
- Panel Perlu tindakan dipakai juga oleh dasbor Keuangan, Hukdis, dan UPT; ketiganya ikut mendapat tombol
  ciut, dan bawaannya tetap terbuka.
- Diperiksa: menciutkan Perlu tindakan lalu memuat ulang halaman mempertahankan keadaannya, dan
  `localStorage` berisi `{"tindakan":true}`.
- 443 uji lolos; `tsc --noEmit` dan ESLint bersih pada berkas yang disentuh. Tanpa migrasi.
