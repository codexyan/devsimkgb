# ADR-077: Review SK KGB oleh Admin UPT sebelum dicetak dan diunggah TTE

Tanggal: 7 Oktober 2026
Status: berlaku

## Konteks

Sebelum ini, *Buat SK* langsung mengunduh SK biasa (tanda tangan basah) dan versi Srikandi, lalu Kanwil mengunggah SK yang
sudah ditandatangani lewat *Unggah TTE*. Admin UPT baru melihat SK setelah TTE diunggah, sehingga kekeliruan pada SK pegawai UPT
baru ketahuan sesudah ditandatangani.

Pengguna meminta: setelah Kanwil membuat SK untuk pegawai UPT, Admin UPT mereview tampilannya lebih dulu; bila sudah benar,
barulah Kanwil mencetak untuk ttd basah, mengirim lewat Srikandi, lalu mengunggah TTE. Dari opsi yang diajukan, pengguna
memilih: review wajib dengan pengecualian oleh Super Admin, tanda air DRAF sampai disetujui, dan langkah Srikandi tidak dicatat
tersendiri.

## Keputusan

1. **Hanya pegawai UPT** (`pegawaiPerluReviewSk`, `lib/reviewSkUpt.ts`). SK pegawai Kanwil tetap seperti sebelumnya.
2. **Permintaan review otomatis.** Buat SK dan Perbaiki SK untuk pegawai UPT (`POST /api/kgb/[id]/pdf`) meminta review ke
   Admin UPT sebelum suratnya disimpan. Versi naik setiap SK dibuat ulang, dan tanggapan sebelumnya dihapus karena SK yang baru
   belum pernah dilihat UPT. Bila permintaan gagal, surat tidak disimpan, supaya persetujuan SK lama tidak terbawa ke SK baru.
3. **Tanggapan Admin UPT** (`GET`/`POST /api/upt/review-sk/[kgbId]`): kartu *Review SK KGB* di Perlu dikerjakan membuka
   *Periksa SK KGB*. Isinya disusun `lib/dataSuratKgbServer.ts`, yang juga dipakai route PDF Kanwil, sehingga yang direview
   persis sama dengan yang dicetak. Pratinjaunya bertanda air DRAF. Pilihannya *SK sudah benar*, dengan centang pernyataan
   sudah memeriksa, atau *Minta perbaikan* dengan catatan wajib. Hanya SK pegawai satker akun itu, selama KGB-nya Sedang
   Diproses.
4. **Terkunci sampai disetujui.**
   - Unggah TTE (`POST /api/kgb/[id]/upload-sk`) ditolak selama review menunggu atau diminta diperbaiki.
   - Setiap unduhan SK sebelum disetujui bertanda air DRAF. Server menentukan `draf`, dan semua jalur unduhan memakai
     keputusan yang sama (`lib/kgbAksi.ts`).
   - *Cetak SK* mengunduh SK biasa dan versi Srikandi tanpa tanda air setelah disetujui atau dilewati.
   - Kartu yang belum disetujui tidak dapat diseret ke kolom unggah.
5. **Lewati review** (`POST /api/kgb/[id]/review-sk`, `aksi: "lewati"`): hanya Super Admin, alasan wajib, tercatat di Log
   Aktivitas, dan permintaan di daftar kerja UPT ditutup. Tim SDM KGB dapat *Minta review UPT* untuk SK yang dibuat sebelum
   review aktif. SK seperti itu tidak terkunci sampai diminta.
6. **Kabar:** `review_sk` untuk Admin UPT (disaring per satker lewat id KGB, sama dengan SK terbit) dan `review_sk_hasil`
   untuk Tim SDM KGB, baik disetujui maupun diminta diperbaiki. Lonceng yang tidak berlaku lagi ditutup otomatis.
7. **Tampilan:**
   - Dasbor Kanwil: penanda *Menunggu review UPT*, *UPT minta perbaikan*, atau *Disetujui UPT, siap cetak*, serta Perlu
     tindakan untuk SK yang diminta diperbaiki dan yang siap dicetak.
   - Halaman Proses KGB dan jendela Buat SK menampilkan keadaan yang sama; Buat SK menampilkan catatan perbaikan dari UPT.
   - Dasbor UPT: status di tabel, serta kartu di Perlu dikerjakan atau Di Kanwil.
8. **Penyimpanan:** tabel baru `review_sk_upt`, satu baris per KGB, dengan migrasi manual
   `supabase/migrations/20261007090000_review_sk_upt.sql`. Selama tabelnya belum ada, review belum aktif dan alur lama
   berlaku tanpa galat (`tabelBelumAda`).

## Akibat

- SK pegawai UPT tidak lagi tercetak untuk ditandatangani sebelum satkernya memeriksa. Kekeliruan diperbaiki sebelum tanda
  tangan, bukan sesudahnya.
- Ada satu langkah tunggu. Bila UPT lambat, KGB ikut tertunda; Super Admin dapat melewatinya dengan alasan.
- Cetak, tanda tangan basah, dan pengiriman lewat Srikandi tetap dikerjakan di luar SIM-KGB; yang dicatat tetap Unggah TTE.
- Fitur baru berlaku setelah migrasi dijalankan.
