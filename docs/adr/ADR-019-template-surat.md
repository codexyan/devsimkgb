# ADR-019: Template surat KGB berversi yang diatur Super Admin

Tanggal: 27 September 2026
Status: berlaku

## Konteks

Surat KGB disusun di peramban oleh `lib/generateSuratKGB.tsx`. Kop, ukuran kertas (A4), margin, kalimat
isi, dan daftar tembusan tertulis mati di kode, disalin dari "Template KGB.docx". Format naskah dinas bisa
berganti, misalnya kop baru, kertas F4, kalimat baru, atau tembusan tambahan. Tiap perubahan semacam itu
menuntut pembaruan program.

## Keputusan

1. **Template terstruktur** (`lib/templateSurat.ts`, `IsiTemplateSurat`), terdiri dari:
   - kertas (lebar dan tinggi dalam mm, bebas, dengan pilihan cepat A4, F4, dan Legal);
   - margin serta huruf dan spasi;
   - kop: baris teks untuk surat Kanwil dan untuk surat yang ditandatangani Dirjen, logo (bawaan, tanpa,
     atau unggahan), letak logo, letak teks, dan garis kop;
   - Sifat, Lampiran, dan Hal, baris "a.n." dan tanggal, tujuan;
   - empat paragraf isi;
   - tembusan, dengan tanda "kecuali pegawai Kanwil".
2. **Isian otomatis** `{nama}`, `{kppn}`, `{gaji_baru}`, dan seterusnya (`PENANDA_TEMPLATE`), serta `**tebal**`.
   Isian yang tidak dikenal ditolak saat disimpan. Rincian data pegawai, SK dasar, hasil KGB, dan tanda
   tangan tetap disusun kode, karena bentuknya tabel isian dan aturannya (Srikandi, Plh/Plt) sudah diatur
   di tempat lain.
3. **Berversi per tanggal.** Tabel `template_surat` (versi, berlaku_mulai, isi JSON, catatan, pembuat).
   - Rute PDF memilih versi dengan `pilihVersi`: tanggal mulai berlaku terakhir yang tidak melewati tanggal
     surat. Tanpa versi yang cocok, `TEMPLATE_BAWAAN` dipakai.
   - SK yang sudah terbit, termasuk yang diunduh ulang, tetap tercetak dengan format ketika terbit.
   - Versi baru tidak boleh berlaku sebelum hari ini.
   - Versi yang sudah mulai berlaku menjadi riwayat dan tidak dapat dihapus. Hanya versi terjadwal yang
     boleh dihapus.
4. **Templat bawaan** meniru surat lama dengan ukuran yang sama persis (pt diubah ke mm). Dirender
   berdampingan dengan kode lama: posisi seluruh kata sama dalam 0,24 pt, dan logo serta garis kop identik.
5. **Akses:**
   - Super Admin mengubah template di Pengaturan → Template surat KGB.
   - Tim SDM KGB melihat dan mempratinjau di menu Template surat (`/dashboard/template-surat`).
   - Penyimpanan versi, penghapusan versi terjadwal, dan unggah logo tercatat di log aktivitas.
6. **Logo unggahan** (PNG/JPEG ≤ 500 KB) disimpan di R2 `template/`. Logo disajikan
   `GET /api/template-surat/logo` kepada peran yang menyusun SK.
7. **Pratinjau** memakai jalur penyusunan PDF yang sama dengan SK sungguhan, dengan data contoh pegawai UPT,
   pegawai Kanwil, atau pimpinan Kanwil (kop Dirjen).

## Akibat

- Migrasi `20260927300000_template_surat.sql` harus dijalankan. Sebelum itu, SK memakai templat bawaan dan
  penyimpanan versi dijawab 503.
- Ukuran kertas bebas membuat isi bisa melebihi satu halaman bila margin atau huruf dibesarkan. Pratinjau
  menunjukkannya sebelum versi disimpan.
