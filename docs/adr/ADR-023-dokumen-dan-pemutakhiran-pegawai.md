# ADR-023: Dokumen dan pemutakhiran data di halaman pegawai

Tanggal: 28 September 2026
Status: berlaku

## Konteks

Data Pegawai hanya memuat formulir ubah tanpa unggah berkas, dan satu-satunya dokumen yang terlihat adalah SK KGB
bertanda tangan sebagai tautan tab baru. Kiriman formulir pemutakhiran (ADR-022) dan berkas usulan UPT tidak
terlihat dari pegawai yang bersangkutan, tidak dibandingkan dengan Data Pegawai, dan tidak punya status tindak
lanjut. Selisih seperti masa kerja golongan II pada pegawai yang sudah III/a harus dicari manual.

## Keputusan (pemilik, 28 September 2026)

1. **Tab "Dokumen & Pemutakhiran"** di halaman pegawai (Super Admin dan Tim SDM KGB), dibuka dari penanda di
   daftar Data Pegawai (`?tab=dokumen`).
2. **Pemutakhiran data**: kiriman dari semua kegiatan formulir dibandingkan dengan Data Pegawai
   (`lib/pemutakhiranPegawai.ts`), dengan peringatan otomatis (MKG ganjil di golongan III/IV, genap di II,
   golongan lebih rendah, kenaikan pangkat yang belum tercatat).
3. **Status tindak lanjut** per kiriman: belum diperiksa, sesuai, perlu perbaikan (catatan wajib), sudah
   diterapkan, beserta siapa dan kapan. Disimpan di data.json kiriman; kiriman ulang kembali "belum diperiksa".
4. **Penerapan**: identitas (nama, tempat dan tanggal lahir, jabatan) dan SK CPNS diterapkan langsung ke Data
   Pegawai. Golongan dan masa kerja diterapkan **lewat Catat kenaikan pangkat atau Catat PMK** dengan isian terisi
   dari kiriman, supaya riwayat pangkat/PMK dan jadwal KGB tetap konsisten. Satker lewat Catat mutasi; TMT KGB,
   TMT CPNS, dan selisih lain yang tidak dijelaskan kiriman dicocokkan dengan SK lebih dulu.
5. **Arsip dokumen pegawai**: unggah PDF (SK CPNS, SK PNS, SK pangkat, SK KGB, SK PMK, SK jabatan, ijazah, lainnya)
   dengan nomor dan tanggal SK, paling besar 5 MB, di R2 `dokumen/<id pegawai>/`. Daftar dokumen menggabungkan
   arsip, SK KGB SIM-KGB, berkas usulan UPT, dan berkas formulir; semuanya dapat dipratinjau di halaman.

## Akibat

- Tidak ada migrasi basis data; arsip dokumen dan status tindak lanjut disimpan di R2.
- Hapus permanen pegawai ikut menghapus arsip dokumennya.
- Arsip dokumen tidak ikut cadangan data bulanan, sama dengan berkas SK KGB.
