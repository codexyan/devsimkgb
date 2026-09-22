# ADR-003: Dashboard "Jernih" bertema navy dan batas hak akses per peran

**Status:** Diterima
**Tanggal:** 22 September 2026
**Penentu:** Pemilik SIM-KGB (Tim SDM Kanwil Ditjenpas Kalimantan Selatan)
**Cakupan:** kerangka `/dashboard` (token, sidebar, shell) dan halaman `/dashboard` untuk ketiga varian peran

## Konteks

Halaman publik sudah memakai bahasa "Jernih" bertema navy (ADR-002), sedangkan dashboard masih memakai palet lama:
- sidebar navy gelap tersendiri dengan aksen emas;
- kanvas lavender;
- kartu KPI yang masing-masing berwarna (navy, hijau, kuning, merah);
- teks 10 sampai 11 px berbobot tebal.

Pemilik meminta dashboard diselaraskan dengan tema baru, dimulai dari halaman utama dashboard. Bersamaan dengan itu, hak akses tiap peran diperiksa dan diklarifikasi.

## Keputusan

### Tampilan

1. **Token bersama, palet baru.** Nama token dashboard di `globals.css` (`--card`, `--dt*`, `--ln*`, `--tint-*`, `--st-*`, `cb-*`) tetap sama. Nilainya kini mengikuti palet Jernih: kanvas `#f4f6fa`, tinta navy, dan tindakan utama navy `#102a63`. Semua halaman dashboard ikut berubah warna tanpa mengganti markupnya. Mode gelap tetap ada dan diselaraskan ke navy pekat.
2. **Panel navy beranimasi di pembuka.** Tiap varian dashboard dibuka `PanelNavy`, berisi sapaan (jam WITA), tanggal, ringkasan hari ini, dan empat KPI. Latarnya `LatarNavy` yang sama dengan hero publik, kini di `app/_bersama/`. Aurora di panel diukur terhadap panel. Geraknya berhenti bila pengguna memilih prefers-reduced-motion.
3. **Sidebar navy.** Sidebar memakai gradient navy yang sama keluarganya dengan hero publik (`--latar-sidebar`), tanpa animasi.
4. **Aturan warna sama dengan publik:**
   - navy untuk permukaan pembuka dan tindakan utama;
   - emas hanya berarti "sekarang / posisi Anda": menu aktif, bulan berjalan di kalender, dan saringan "Berlaku bulan ini";
   - warna status hanya untuk titik dan label status.

   KPI tidak lagi berwarna per kartu.
5. **Kepadatan seimbang.** Teks minimal sekitar 12 px dan isi 13 px. Judul dan angka memakai Inter Tight (dimuat di layout akar untuk publik dan dashboard). Kartu bersudut 20 px dengan garis rambut, dan tombol berbentuk pil.
6. **Kelas `dsb-*` di `app/dashboard/dasbor.css`.** Kelas ini dipakai halaman dashboard lain saat didesain ulang berikutnya.

### Hak akses

7. **Empat peran tetap:** Super Admin, SDM KGB, SDM Hukdis, Keuangan.
8. **Konfirmasi keuangan hanya oleh petugas Keuangan** (`canKonfirmasiKeuangan`). Super Admin tetap membuka halaman Keuangan, tetapi hanya melihat. Tujuannya agar verifikasi SDM dan verifikasi Keuangan dilakukan dua orang berbeda. Follow up ke Tim SDM juga hanya oleh Keuangan.
9. **SDM Hukdis tidak membuka Proses KGB dan Laporan.** Layout keduanya memakai `PERAN_KGB`. API `/api/kgb`, `/api/dashboard`, `/api/kgb/summary`, dan `/api/laporan` menolak peran ini. Hukdis tetap melihat riwayat KGB per pegawai lewat Data Pegawai.
10. **Admin UPT menjadi tahap berikutnya.** Admin UPT akan punya login yang hanya bisa melihat, terbatas pada satker sendiri:
    - pegawai satkernya;
    - jadwal dan batas kirim surat;
    - status proses;
    - unduh SK final.

    Hukdis hanya tampil sebagai "KGB ditunda". Pembagian ini membutuhkan kolom satker di tabel pengguna (migrasi sebelum deploy) dan data pegawai UPT yang belum diimpor.

## Konsekuensi

- Halaman dashboard selain `/dashboard` ikut berganti warna, font, tombol, dan dialog lewat token. Tata letaknya belum memakai kelas `dsb-*` sampai didesain ulang satu per satu.
- Pratinjau lokal tidak butuh kredensial produksi. Sesi dicetak dengan `AUTH_SECRET` lokal dan respons API diganti data contoh di peramban, jadi tidak ada penulisan ke data asli.
- Matriks hak akses dijaga `lib/auth/roles.test.ts`.
