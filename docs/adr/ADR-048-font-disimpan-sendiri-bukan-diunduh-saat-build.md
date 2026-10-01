# ADR-048: Font disimpan sendiri di repo, bukan diunduh dari Google saat build

Tanggal: 1 Oktober 2026
Status: berlaku

## Konteks

Penggelaran ADR-047 gagal pada 1 Oktober 2026 pukul 07:16 UTC, dengan 28 galat yang isinya satu hal yang
sama:

```
Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
next/font/google queries have exactly one entry
  Import trace: ./app/layout.tsx
```

Penyebabnya bukan kode. `app/layout.tsx` memakai `next/font/google`, dan loader itu **mengunduh berkas
font dari jaringan setiap kali build berjalan**. Ketika unduhan gagal, Turbopack tetap menghasilkan CSS
yang menunjuk modul internal yang tidak pernah ada, lalu berhenti dengan galat yang sama sekali tidak
menyebut jaringan.

Yang membuktikannya bukan regresi:

| | |
|---|---|
| `app/layout.tsx`, `next.config.ts`, `package.json` | tidak disentuh satu pun commit hari itu |
| Build ADR-046, 29 menit sebelumnya | kode font yang sama, berhasil |
| `next build` di komputer pengembang | berhasil, sebab fontnya terunduh |
| Retry tanpa mengubah apa pun | berhasil, tayang pukul 07:33 UTC |

Jadi penggelaran produksi bergantung pada satu permintaan jaringan ke pihak ketiga yang tidak ada
hubungannya dengan isi perubahan. Sekali gagal, rilis tertahan dan penyebabnya tidak terbaca dari pesan
galatnya.

## Keputusan (pemilik, 1 Oktober 2026)

Berkas fontnya disimpan di repo dan dipasang dengan `next/font/local`. Build tidak lagi menyentuh jaringan
untuk font.

## Akibat

- `app/fonts/inter-latin-var.woff2` (48 KB) dan `app/fonts/inter-tight-latin-var.woff2` (44 KB), keduanya
  **font variabel subset latin**: satu berkas melayani seluruh bobot 100 sampai 900. Sebelumnya empat bobot
  tetap Inter dan empat bobot Inter Tight diunduh terpisah, jadi berkasnya justru lebih sedikit sekarang.
- Subsetnya tetap `latin` seperti sebelumnya, sehingga tidak ada glif yang hilang dari tampilan.
- Nama variabel CSS tidak berubah: `--font-inter` dan `--font-judul`, yang dipakai `app/globals.css`,
  `app/(publik)/publik.css`, dan `app/dashboard/dasbor.css`. Tidak ada berkas gaya yang perlu disentuh.
- Lisensinya SIL Open Font License 1.1, dan salinannya ikut di `app/fonts/OFL.txt` sebagaimana diminta
  lisensi itu sendiri.
- Berkasnya diambil dari layanan Google Fonts yang sama dengan yang dipakai loader sebelumnya, jadi
  bentuk hurufnya identik; yang berpindah hanya waktu pengambilannya, dari setiap build menjadi sekali saat
  keputusan ini dibuat.
- **app/globals.css berhenti menyebut nama font secara harfiah.** Dua deklarasinya tertulis 'Inter', dan
  itu hanya bekerja selama nama keluarga yang dihasilkan next/font kebetulan sama. Keduanya kini merujuk
  `var(--font-inter)`, sebangun dengan dasbor dan halaman publik yang memang sudah begitu; nama keluarga
  yang dihasilkan tidak lagi menjadi tali yang menahan tampilan.
- **Diperiksa dengan membandingkan produksi lawan lokal** pada halaman yang sama, mengukur lebar teks
  contoh pada font body dan judul dengan Canvas:

  | | Produksi (font Google) | Lokal (font di repo) |
  |---|---|---|
  | Lebar teks body | 262,48 px | 262,48 px |
  | Lebar teks judul | 237,11 px | 237,11 px |
  | Tinggi H1 | 160 px | 160 px |

  Tangkapan layar keduanya tidak dapat dibedakan. Tidak ada satu pun permintaan ke fonts.googleapis.com
  maupun fonts.gstatic.com yang tersisa; berkasnya dilayani dari /_next/static/media.
- Pembaruan font kelak menjadi pekerjaan tangan: unduh berkas baru, ganti yang lama. Itu memang harga yang
  dibayar, dan sepadan dengan penggelaran yang tidak lagi dapat digagalkan oleh jaringan.
