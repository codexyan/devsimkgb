# ADR-051: SK diserahkan ke R2 sebagai berkas utuh, bukan aliran

Tanggal: 3 Oktober 2026
Status: berlaku

## Konteks

Saat memotret layar untuk video alur SK, Unggah TTE di server dev lokal selalu gagal dengan
**500 "Gagal menyimpan file. Coba lagi."**, untuk PDF 300 KB yang jauh di bawah batas 500 KB.

Penyebabnya baris yang ditulis ADR-037 butir 3:

```ts
await env.SK_BUCKET.put(pathFile, file.stream(), { ... });
```

R2 hanya menerima aliran yang panjangnya diketahui. Pesan aslinya, yang tertelan `catch` di rute:

```
Provided readable stream must have a known length (request/response body or readable half of FixedLengthStream)
```

Diuji terpisah dengan PDF 307.200 byte yang sama, di dua lingkungan:

| Cara menyerahkan | workerd (Miniflare, seperti produksi) | `next dev` (proksi binding dari Node) |
|---|---|---|
| `file.stream()` | berhasil | **gagal**, pesan di atas |
| `file` (Blob) | berhasil | berhasil |
| `await file.arrayBuffer()` | berhasil | berhasil |

Di workerd, `File` dari `req.formData()` membawa panjangnya ke alirannya, jadi produksi tidak terdampak.
Di `next dev`, binding R2 adalah proksi dari Node (`getPlatformProxy`), dan aliran dari `File` milik Node
tidak membawa panjang apa pun. `FixedLengthStream` tidak ada di Node, jadi tidak dapat dipakai untuk
menolongnya.

## Keputusan (pemilik, 3 Oktober 2026)

1. **Berkasnya diserahkan langsung**: `put(pathFile, file, ...)`. Blob membawa ukurannya sendiri dan
   diterima di kedua lingkungan.
2. **Bukan kembali ke `arrayBuffer()`.** Itu juga berhasil di keduanya, tetapi menghidupkan lagi salinan
   kedua yang dihapus ADR-037. Menyerahkan Blob tidak membuat salinan tambahan di pihak rute.
3. Diperbaiki di branch tersendiri, **tanpa deploy dari mesin ini**; deploy lewat Workers Builds.

## Akibat

- Unggah TTE kembali dapat diuji di server dev lokal. Diperiksa dengan Chrome headless pada data video:
  dua unggahan (pegawai UPT dan pegawai Kanwil) dijawab 200, keduanya berpindah ke `menunggu_keuangan`,
  dan alur sesudahnya (Tinjau Keuangan, Sudah direkam di Gaji Web oleh UPT) berjalan.
- Perilaku produksi tidak berubah: di workerd, aliran maupun Blob sama-sama diterima.
- Pelajarannya untuk rute lain: **lolos di `next dev` belum berarti lolos di workerd, dan sebaliknya**.
  Binding Cloudflare di `next dev` adalah proksi dengan batasnya sendiri. Kegagalan R2 yang hanya muncul
  di lokal sebaiknya diuji ulang di Miniflare sebelum disimpulkan sebagai cacat produksi.
- `tsc --noEmit` bersih, ESLint bersih pada berkas yang disentuh. Tanpa migrasi.
