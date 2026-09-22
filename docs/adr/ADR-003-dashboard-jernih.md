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

### Pembaruan 22 September 2026 (lanjutan): dashboard tanpa angka ganda, Satker & UPT, modul Data

11. **Panel atas memuat "Perlu tindakan".** Pemberitahuan tidak lagi berupa deretan banner di bawah panel, melainkan daftar di dalam panel navy dengan tombol di tiap baris. Chip ringkasan dihapus karena mengulang KPI.
12. **KPI mengikuti alur KGB tahun ini:** belum diproses, dalam proses, selesai, dan berpotensi rapelan. Ubinnya membuka Proses KGB yang sudah tersaring (`?status=`).
13. **Kartu dihapus karena isinya ganda.** Kartu Status proses sama dengan KPI. Kartu Tren sama dengan kalender KGB per bulan.
14. **Kartu pemantauan satker menggantikan tren** (`PemantauanSatker`):
    - satu kartu per satker yang punya data, diurutkan dari yang paling perlu perhatian;
    - satker tanpa data diringkas dalam satu kartu.
15. **Modul Satker & UPT** (`/dashboard/satker`, hanya peran KGB) memuat:
    - ringkasan KGB 19 satker;
    - halaman rincian per satker berisi pegawai, KGB berjalan, dan jadwal surat usulan UPT;
    - saringan satker di Data Pegawai dan Proses KGB.

    Hitungannya ada di `lib/rekapSatker.ts` dan memakai definisi bersama `lib/rekapKgb.ts`.
16. **Data Pegawai dan Proses KGB memakai kelas `dsb-*`.**
    - Kolom status Data Pegawai menampilkan keadaan KGB berikutnya: dalam proses, lewat batas, siap diinput, atau tanggal dibuka.
    - "Lewat batas input" memakai definisi yang sama dengan dashboard.
    - Proses KGB memisahkan KGB yang masa inputnya belum dibuka ke tab "Belum dibuka".
    - Urutan bawaan Proses KGB adalah "Prioritas".
17. **Tema bawaan selalu terang.** Mode gelap hanya aktif bila pengguna memilihnya, tidak lagi mengikuti preferensi sistem.
18. **Basis data lokal untuk pengembangan.** `DATA_BACKEND=lokal` menyimpan data di berkas JSON (`lib/sheets/klienLokal.ts`), diisi data contoh oleh `scripts/seed-lokal.ts`. Tidak dipakai di produksi.

### Pembaruan 22 September 2026 (lanjutan): tata letak kerja, bukan brosur

19. **Ruang dipakai penuh.**
    - Halaman melebar sampai 1920 px.
    - Dashboard terdiri dari pita navy yang ringkas (sapaan dan strip empat angka yang dipisah garis) lalu dua kolom.
    - Kolom kiri berisi antrian kerja dengan tabel bergulir di dalam panelnya (lihat butir 23).
    - Kolom kanan berisi Perlu tindakan, kalender KGB per bulan, dan daftar satker.
20. **Satu antrian kerja** menggantikan tabel "Pegawai mendekati deadline" dan kanban "Alur proses", yang dulu menampilkan pegawai yang sama dua kali.
    - Tab tahapnya: perlu diproses, lewat batas, di keuangan, selesai, dan semua.
    - Aksi ada di tiap baris.
    - Urutan: lewat batas, sedang diproses, lalu TMT terdekat.
21. **Bahasa visual lebih tenang.**
    - Panel bersudut 12 px dengan garis rambut, tanpa bayangan.
    - Kontrol bersudut 8 px dan label bersudut 5 px, bukan pil.
    - Judul panel berupa satu baris teks, tanpa label huruf kapital di atasnya.
    - Status ditulis sebagai titik dan teks.
    - Aurora di pita diredam dan kisinya dihilangkan.
22. **Layar sempit.** Baris antrian menjadi blok bertumpuk tanpa gulir mendatar, dan Perlu tindakan tampil di atas antrian.

### Pembaruan 22 September 2026 (lanjutan): model gulir, Hukdis, dan Laporan

23. **Model gulir dashboard** (Super Admin, SDM KGB, Keuangan, SDM Hukdis; atribut `data-muat-layar`):
    - Layar kerja (lebar ≥ 1200 px dan tinggi ≥ 720 px): dashboard pas satu layar dan halaman tidak bergulir. Pita navy diam. Antrian setinggi isinya, paling tinggi sisa layar; bila lebih, hanya baris tabel yang bergulir, sedangkan kepala panel, tab, kepala kolom, dan kaki tetap terlihat. Kolom pendamping bergulir sendiri bila isinya lebih tinggi dari layar.
    - Layar lebar tetapi pendek: halaman bergulir biasa dan tabel antrian dibatasi setinggi layar.
    - Tablet dan ponsel: satu gulir halaman saja, tanpa gulir bersarang.
    - Tabel panjang di halaman modul (Laporan, Hukuman Disiplin) memakai `dsb-gulir-tabel`: bergulir di dalam panel setinggi layar dengan kepala kolom menempel, hanya pada layar ≥ 1024 × 640 px.
    - Pengganti `contain: size` yang membuat tinggi antrian mengikuti kolom kanan.
24. **Hukuman Disiplin.**
    - Status aktif dihitung dari tanggal berakhir (kalender WITA, tanggal berakhir ikut dihitung) oleh `/api/hukdis`. Karena itu dashboard SDM Hukdis kini membaca `/api/hukdis`, dan angka "Perlu diperbarui" (selalu 0) diganti "Menunda KGB".
    - Ringkasan: aktif (dengan rincian kategori), menunda KGB, berakhir ≤ 30 hari (`summary.berakhir30`), sudah berakhir.
    - Saringan: masa berlaku (aktif, berakhir ≤ 30 hari, menunda KGB, sudah berakhir, semua), kategori, satker, dan pencarian. Halaman menerima `?satker=` dan `?saringan=` dari dashboard.
    - Hukdis yang berjalan diurutkan dari yang paling dekat berakhir.
25. **Laporan.**
    - Angka memakai definisi yang sama dengan dashboard: KGB yang jatuh tempo tetapi belum diinput ikut sebagai Belum Diproses (entri virtual dari `entriVirtual`, tampil "Belum diinput" tanpa gaji baru dan nomor SK).
    - Rekap per satker memakai daftar satker baku (`kodeSatkerPegawai`), bukan teks unit kerja mentah; ada saringan satker.
    - Tampilan memakai kelas `dsb-*`; area cetak (`#laporan-print-area`, kop surat, rekap per bulan) tetap.

### Pembaruan 22 September 2026 (lanjutan): Keuangan dan halaman kerja tanpa ruang kosong

26. **Halaman kerja pas satu layar tanpa ruang kosong** (menggantikan "antrian setinggi isinya" pada butir 23). Pada layar kerja (≥ 1200 × 720 px) halaman bertanda `data-muat-layar` tidak bergulir dan panel mengisi tinggi yang tersisa:
    - `dsb-penuh`: panel yang mengambil sisa tinggi induknya (halaman, `dsb-kolom`, atau kolom pendamping).
    - `dsb-susut`: panel setinggi isinya yang menyusut dan bergulir di dalam bila ruang kurang.
    - `dsb-gulir`: bagian panel yang bergulir. Kepala panel, tab, saringan, kepala kolom, dan kaki tetap terlihat.
    - Berlaku untuk dashboard keempat peran, Keuangan, Riwayat Aktivitas, dan Hukuman Disiplin. Laporan tetap bergulir biasa karena dicetak.
    - Tablet dan ponsel tetap satu gulir halaman tanpa gulir bersarang.
27. **Modul Keuangan disusun menurut alur kerja petugas keuangan.**
    - Jadwal rekon Gaji Web (tanggal 1–15 bulan sebelum TMT) dihitung di `lib/rekonGaji.ts` (diuji). "Bulan fokus rekon" adalah bulan TMT yang rekonnya berjalan, atau sesudah tanggal 15, bulan TMT berikutnya.
    - Strip angka: menunggu konfirmasi, siap rekon bulan fokus, belum sampai keuangan, rapelan tahun ini.
    - Antrian SK berupa tabel urut TMT terdekat. **Tinjau SK** membuka berkas SK bertanda tangan dan datanya berdampingan, dengan pilihan rapelan, navigasi SK sebelumnya/berikutnya, dan pilihan membuka SK berikutnya setelah konfirmasi. Konfirmasi cepat tetap hanya untuk SK tanpa potensi rapelan dengan TMT yang belum lewat.
    - Tabel KGB per bulan TMT dengan saringan status dan pencarian, follow up Tim SDM per pegawai atau sekaligus, dan unduhan CSV **dasar Gaji Web** (KGB yang sudah dikonfirmasi).
    - Kolom kanan: daftar bulan TMT (komponen `DaftarBulanRekon`, juga di dashboard Keuangan) dan umpan konfirmasi terakhir.
    - Halaman menerima `?bulan=yyyy-mm`.
28. **Riwayat Aktivitas Keuangan**: log konfirmasi dikelompokkan per hari dengan saringan rapelan/konfirmasi cepat dan unduhan CSV; rekap dasar Gaji Web per bulan TMT dengan jendela rekon dan tautan ke bulan itu di halaman Keuangan; riwayat KGB per pegawai yang dapat dibuka. API log memuat sampai 500 entri. Halaman menerima `?tab=rekap|kgb`.
29. **Antrian kerja punya tampilan Papan (kanban)** di samping Daftar; pilihannya diingat per peramban. Pencarian (nama, NIP, satker) berlaku untuk keduanya.
    - Kolom mengikuti alur: Belum dibuka, Perlu diinput (keterangan jumlah lewat batas), Sedang diproses (jumlah tunggu TTE), Di keuangan, Selesai. Setiap kolom bisa diciutkan menjadi lajur sempit; bawaannya Belum dibuka dan Selesai diciutkan.
    - Kartu yang diseret ke kolom lain membuka modal aksi yang sama dengan tombolnya: ke Sedang diproses = Input KGB; ke Di keuangan = Unggah SK TTE (atau Buat SK bila belum dibuat); kembali ke Perlu diinput = Batalkan; KGB lewat batas ke Selesai = Arsip. Kolom yang tidak sah diredupkan selama menyeret. Data baru berubah setelah modal dikonfirmasi.
    - Setiap aksi juga ada sebagai tombol di kartu, untuk papan ketik dan layar sentuh. Di ponsel kolom digeser mendatar satu per satu.
