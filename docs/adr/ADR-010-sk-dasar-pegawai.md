# ADR-010: SK dasar KGB pertama disimpan pada data pegawai

Tanggal: 26 September 2026
Status: berlaku

## Konteks

SK KGB mencetak SK dasarnya pada bagian "Atas dasar" dan pejabat penetapnya pada baris "Oleh". Bagi pegawai
yang belum pernah KGB, SK dasarnya adalah SK CPNS; sesudahnya SK KGB terakhir. SK kenaikan pangkat tidak
dipakai sebagai SK dasar (keputusan pemilik).

Sampai kini SK CPNS hanya dapat masuk lewat dua jalan. Pertama, diketik saat Input KGB. Kedua, dibawa usulan
UPT, tetapi nomornya tertinggal di baris usulan. Pegawai yang dicatat Kanwil lewat Tambah Pegawai atau Impor
tidak pernah membawanya, sehingga Tim SDM mengetik SK CPNS dari nol pada setiap KGB pertama.

## Keputusan

1. Tiga kolom baru pada `pegawai`: `nomor_sk_dasar`, `tanggal_sk_dasar`, `penetap_sk_dasar`. TMT-nya memakai
   `tmt_kgb_terakhir`, yang bagi CPNS sama dengan TMT CPNS. Tidak ada kolom TMT tersendiri.
2. Kanwil mengisinya pada formulir Tambah/Edit Pegawai dan pada tiga kolom opsional templat Impor CSV. Berkas
   CSV lama tanpa kolom itu tetap diterima.
3. Persetujuan usulan UPT menyalin nomor dan tanggal SK dari usulan ke kolom ini: pada pegawai baru selalu,
   pada usulan perbaikan hanya bila UPT mengisinya.
4. Input KGB mengisi Atas Dasar SK dengan urutan berikut:
   1. SK KGB terakhir yang selesai di SIM-KGB;
   2. SK dasar pada data pegawai;
   3. usulan UPT yang disetujui sebelum aturan ini ada (`GET /api/pegawai/[id]/sk-dasar`).

   Modal Input KGB dari ketiga tempat pemanggilnya menjalankan pencarian yang sama.

## Akibat

- Migrasi `20260926230000_pegawai_sk_dasar.sql` wajib dijalankan di Supabase **sebelum** kodenya di-deploy.
  Tanpanya, penulisan pegawai (tambah, edit, impor, persetujuan usulan) gagal karena kolomnya tidak dikenal.
- Setelah KGB pertama selesai di SIM-KGB, kolom ini tidak dipakai lagi. Nilainya dibiarkan sebagai catatan.
