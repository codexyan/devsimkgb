# ADR-039: Batas wewenang hukdis Admin UPT dinyatakan di layar, dan pelurusan salinan yang tertinggal

Tanggal: 30 September 2026
Status: berlaku

## 1. Nama menu hukdis UPT dibedakan dari modul Kanwil

### Konteks

ADR-016 sudah menetapkan pembagiannya: UPT melaporkan SK hukuman disiplin, SDM Hukdis Kanwil yang
mencatatnya dan menggeser jadwal KGB. **Kodenya memang sudah begitu** — diperiksa ulang hari ini:

- `app/api/upt/hukdis/route.ts` hanya memanggil `db.laporanHukdis.create` dan `db.laporanHukdis.delete`;
- `app/api/upt/hukdis/[id]/route.ts` menolak pembatalan laporan yang statusnya di luar
  `LAPORAN_HUKDIS_DIPEGANG_UPT`, dan menjawab laporan satker lain sebagai 404;
- tidak satu pun jalur UPT menulis `riwayatHukdis`, `pegawai`, atau `riwayatKGB`.

Yang tidak selaras adalah **namanya**. Menu Admin UPT dan modul SDM Hukdis Kanwil sama-sama bernama
**"Hukuman Disiplin"**. Bagi operator UPT yang hanya melihat sidebar-nya, nama itu terbaca sebagai
kewenangan atas hukuman disiplin — padahal wewenangnya berhenti pada melaporkan. Nama yang sama untuk
dua kewenangan yang berbeda adalah salinan yang keliru, sekalipun kodenya benar.

### Keputusan (pemilik, 30 September 2026)

1. Menu Admin UPT bernama **"Lapor Hukdis"**, bukan "Hukuman Disiplin". Modul Kanwil tetap
   "Hukuman Disiplin", sebab di sanalah hukuman dicatat.
2. Batas wewenangnya dinyatakan **menetap di layar**, bukan hanya di jendela lapor. Operator yang membuka
   halaman itu sekadar memeriksa status tidak selalu melewati jendela tersebut.
3. Panduan dan halaman publik menyebutkan batas itu apa adanya: hukuman disiplin dijatuhkan dengan SK
   pejabat berwenang di luar SIM-KGB, dan di dalam SIM-KGB hanya Kanwil yang dapat mencatatnya serta
   menunda KGB karenanya. UPT juga tidak dapat menghapus hukuman yang sudah tercatat.
4. Aturannya **dijaga uji** (`lib/laporanHukdis.test.ts`): seluruh berkas di bawah `app/api/upt/hukdis/`
   diperiksa tidak memanggil tulisan apa pun ke `riwayatHukdis`, `riwayatKGB`, `suratKGB`, maupun
   `pegawai`. Aturan ini tidak terbaca dari satu berkas mana pun, sehingga mudah hilang saat rute
   ditambah; uji itu menahannya.

### Akibat

- Tidak ada perubahan perilaku. Yang berubah nama menu, salinan teks, dan satu penjaga baru.
- Penjaganya memakai pencocokan teks biasa, bukan RegExp yang dirakit dari potongan. Versi pertamanya
  memakai `` new RegExp(`db\.${tabel}\.(...)\b`) `` dan **lulus tanpa memeriksa apa pun**, sebab di dalam
  template literal `\b` menjadi karakter backspace, bukan batas kata. Penjaga yang rusak lebih berbahaya
  daripada tidak ada penjaga, karena memberi rasa aman yang palsu.

## 2. Salinan yang tertinggal dari keputusan sebelumnya

Tiga tempat masih menjelaskan keadaan yang sudah tidak berlaku:

| Tempat | Tertulis | Semestinya |
|---|---|---|
| `panduan/LayarUpt.tsx`, tiruan layar papan | kolom Selesai: "60 hari terakhir" | "Sudah direkam di Gaji Web" (ADR-038) |
| `panduan/IsiPanduan.tsx`, langkah Input KGB | "Antrian kerja KGB pada ubin Perlu diproses (tampilan Daftar atau Papan)" | tampilan Daftar sudah dilepas (ADR-036) |
| `(publik)/kgb/page.tsx`, akun untuk UPT | menyebut apa yang dikerjakan UPT, tanpa batasnya | ditambah: akun itu melaporkan, bukan memutuskan |

Ketiganya diluruskan. Yang pertama paling merugikan: keterangan kolom di aplikasi sudah diubah ADR-038,
tetapi tiruan layarnya di panduan masih mengajarkan arti yang lama, sehingga panduan justru membantah
aplikasinya sendiri.

Batas unggahan 500 KB (ADR-037) diperiksa ulang dan sudah seragam di seluruh salinan teks; tidak ada
angka lama yang tersisa. ADR-016 masih menuliskan "paling besar 1 MB" dan sengaja dibiarkan: ADR adalah
catatan keputusan bertanggal, bukan dokumen yang diperbarui, dan ADR-037 sudah menggantikannya.
