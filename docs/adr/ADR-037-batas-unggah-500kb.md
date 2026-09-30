# ADR-037: Satu batas unggahan 500 KB untuk seluruh berkas

Tanggal: 30 September 2026
Status: berlaku

## Konteks

Produksi berulang kali menjawab **Cloudflare error 1102, "Worker exceeded resource limits"**
(contoh Ray ID a42f7d17987a7975, 30 September 2026 01:35 UTC).

Batas unggahan sebelumnya berbeda-beda per jalur dan sebagian besar:

| Jalur | Batas lama |
|---|---|
| SK KGB (`BATAS_UKURAN_SK_BYTE`) | 10 MB |
| Arsip dokumen pegawai (`BATAS_DOKUMEN_BYTE`) | 5 MB |
| Berkas usulan UPT (`BATAS_BERKAS_USULAN_BYTE`) | 1 MB |
| Kiriman inventarisasi (`BATAS_BERKAS_INVENTARIS_BYTE`) | 1 MB |
| Logo kop (`BATAS_LOGO_BYTE`) | 500 KB |

Unggahan SK menyalin isi berkas ke memori **dua kali**: sekali saat `req.formData()`, sekali lagi saat
`file.arrayBuffer()` sebelum ditulis ke R2. Satu unggahan 10 MB karenanya dapat memegang belasan megabyte
sekaligus di satu permintaan Worker. Inilah satu-satunya risiko sumber daya yang dapat ditunjukkan
buktinya di kode.

Dua tersangka lain diperiksa dan **disingkirkan dengan bukti**:

- **Pembuatan PDF** tidak terjadi di Worker. `app/api/kgb/[id]/pdf/route.ts` tidak memuat `@react-pdf`
  sama sekali; PDF dirakit di peramban (`lib/kgbAksi.ts`). Yoga WASM pun tidak lagi dimuat `worker-entry.js`.
- **Durable Object `PembatasCekKgb`** memang diekspor `worker-entry.js`. Peringatan "no such Durable Object
  class is exported" hanya muncul pada `next dev`, yang tidak memakai bundel Worker; bukan cacat produksi.

Volume datanya kecil (72 pegawai, 81 riwayat KGB), sehingga `findMany` bertabel penuh maupun penyusunan
cadangan bukan beban yang masuk akal pada ukuran sekarang.

## Keputusan (pemilik, 30 September 2026)

1. **Satu batas untuk seluruh unggahan: 500 KB**, di `lib/batasUnggah.ts`. Kelima konstanta lama menunjuk
   ke sana, sehingga angkanya tidak dapat lagi berbeda antar layar dan cukup diubah di satu tempat.
2. **Pesan tolaknya seragam dan menyebut jalan keluarnya**, bukan hanya angkanya: pindai sebagai dokumen
   hitam putih, bukan foto kamera. Berkas yang melampaui batas hampir selalu foto kamera beresolusi penuh
   yang dibungkus PDF.
3. **Unggahan SK dialirkan ke R2** (`file.stream()`), tidak lagi disalin lebih dulu lewat `file.arrayBuffer()`.

## Akibat

- Puncak memori satu permintaan unggah turun sekitar dua puluh kali lipat.
- **SK hasil pindai berwarna atau berhalaman banyak dapat tertolak.** Ini pertukaran yang disadari:
  satu lembar SK yang dipindai sebagai dokumen hitam putih berukuran ratusan kilobyte, dan pesan tolaknya
  menyebutkan caranya. Bila ternyata terlalu ketat di lapangan, angkanya cukup diubah di satu berkas.
- Berkas yang **sudah** tersimpan tidak terpengaruh; batas hanya berlaku untuk unggahan baru.
- Tiga rute lain (`dokumen`, `inventarisasi`, `logo`) masih memakai `arrayBuffer()`. Dibiarkan, sebab pada
  batas 500 KB salinan gandanya tidak lagi berarti.
- **Ini mitigasi, bukan diagnosis.** Penyebab 1102 belum dibuktikan dari log; yang dikerjakan di sini
  adalah menghilangkan satu-satunya risiko sumber daya yang terlihat di kode. Bila 1102 masih muncul,
  langkah berikutnya membaca Workers Logs (`observability` sudah aktif di `wrangler.jsonc`) atau
  `npx wrangler tail sim-kgb` saat kejadian diulang, untuk mengetahui rute mana yang sebenarnya gagal.
