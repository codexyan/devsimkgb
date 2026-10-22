# ADR-124: Batas unggahan naik dari 500 KB menjadi 600 KB

Tanggal: 22 Oktober 2026
Status: berlaku

## Konteks

ADR-037 menetapkan satu batas 500 KB untuk seluruh unggahan biasa (arsip dokumen pegawai, berkas usulan UPT, logo kop,
berkas surat). Alasannya dulu error 1102 "Worker exceeded resource limits", yang ternyata berasal dari batas CPU paket Free
dan sudah tidak berlaku sejak produksi memakai Workers Paid (8 Oktober 2026). Pindaian SK yang benar sering mepet 500 KB.

## Keputusan

1. `BATAS_UNGGAH_BYTE` menjadi **600 KB** (`600 * 1024`) dan `BATAS_UNGGAH_LABEL` menjadi "600 KB", di `lib/batasUnggah.ts`.
   Arsip dokumen, berkas usulan UPT, dan logo kop menunjuk ke konstanta itu, jadi ikut berubah.
2. Seluruh teks layar, pesan galat, dan panduan yang menyebut 500 KB diganti 600 KB. Uji `lib/batasUnggah.test.ts` memeriksa
   bahwa setiap teks "paling besar N KB" di `app` dan `lib` sama dengan batasnya, supaya angka tidak tertinggal lagi.
3. **Tidak berubah:** batas SK bertanda tangan tetap 5 MB (ADR-096), dan pesan yang menganjurkan pindai hitam putih tetap.

## Akibat

- Berkas 500 sampai 600 KB yang dulu ditolak kini diterima. Tidak ada perubahan skema atau penyimpanan.
- Tiap unggahan memegang hingga 600 KB di memori Worker (ADR-037 menghitung dua salinan), tambahan kecil pada paket berbayar.
