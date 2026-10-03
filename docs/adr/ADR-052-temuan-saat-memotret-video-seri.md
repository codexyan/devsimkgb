# ADR-052: Temuan saat memotret video seri skema KGB

Tanggal: 3 Oktober 2026
Status: berlaku

## Konteks

Video seri skema KGB untuk Super Admin dipotret dari server dev lokal dengan data fiktif. Selama memotret
tercatat empat hal di aplikasi. Pemilik meminta keempatnya ditangani; temuan kelima muncul saat menyiapkan video kenaikan pangkat.

## Keputusan (pemilik, 3 Oktober 2026)

### 1. Seed jenis hukdis: hukuman sedang menunda KGB 12 bulan

`scripts/jenis-hukdis-pp94.ts` menyatakan "tidak ada jenis yang menunda KGB", dan keempat skrip pemakainya
menimpa setiap jenis dengan `berdampakKGB: false`. Itu bertentangan dengan panduan (bagian hukdis: menurut
Pasal 42 PP 94/2021, sebelum PP mengenai gaji dan tunjangan berlaku, hukuman disiplin sedang masih mengikuti
Pasal 7 ayat (3) PP 53/2010, termasuk penundaan KGB 1 tahun) dan dengan isi halaman Jenis Hukdis di produksi.

- Ketiga jenis Pemotongan Tunjangan Kinerja 25% (6, 9, 12 bulan) kini `berdampakKGB: true`, `durasiTunda: 12`.
  Jenis ringan dan berat tetap tidak menunda; hukuman berat PP 53/2010 Pasal 7 ayat (4) pun tidak memuat
  penundaan KGB.
- Nilainya kini milik seed itu sendiri. `seed-lokal.ts`, `seed-sheets-master.ts`, `migrasi-tahap1.ts`, dan
  `salin-sheets-ke-supabase.ts` tidak lagi menimpanya.
- Contoh riwayat hukdis di `seed-lokal.ts` (pemotongan tukin 6 bulan) ikut berdampak, supaya data lokal
  sejalan dengan jenisnya.

Produksi tidak berubah: jenis yang sudah ada tidak disentuh skrip mana pun (hanya jenis yang belum ada yang
dibuat). Yang dibetulkan adalah basis data baru dan data lokal, yang selama ini membuat hukuman sedang tampak
tidak menahan KGB.

### 2. Papan antrian: kolom yang tersaring tab tidak lagi tertulis "Tidak ada"

Di dasbor Kanwil, papan hanya memuat pegawai dari tab tahap yang aktif. Pada tab bawaan "Perlu diproses",
kolom Keuangan Kanwil, Rekam UPT, dan Selesai selalu tertulis **"Tidak ada"**, padahal tab "Di keuangan"
menghitung pegawai di sana (diamati: "Di keuangan 3 · 2 Kanwil · 1 rekam UPT" dengan kedua kolom kosong).
Saringan per tab memang disengaja; tulisan "Tidak ada" yang menyesatkan.

Kolom yang isinya tersaring kini menyebut jumlah dan tabnya, misalnya "2 pegawai di tab Di keuangan.
Tampilkan", dan tombol Tampilkan membuka tab itu. Kolom yang memang kosong tetap "Tidak ada". Peta kolom ke
tab ada di `TAB_KOLOM` (`app/dashboard/page.tsx`), sejalan dengan `cocokTahap`.

### 3. Logo vertikal: "Sistem Informasi Manajemen"

`public/logo-vertikal.svg` bertuliskan "Sistem Informasi Monitoring", berbeda dari kepanjangan yang dipakai di
footer aplikasi dan README. Tulisannya sudah berupa kurva, dan huruf "j" untuk "Manajemen" tidak ada di
kurva lama, jadi seluruh baris keterangan digambar ulang dari kurva Inter (font aplikasi, OFL) dengan tinggi
tinta dan posisi kiri yang sama, berakhir di x 270 dari lebar 274. Berkas ini belum dipakai kode mana pun.

### 4. Ringkasan halaman Hukuman Disiplin: bukan cacat

Tercatat bahwa angka Hukdis aktif dan Menunda KGB tidak berubah sesudah laporan UPT dicatat. Diuji ulang di
server lokal dengan laporan sungguhan: angkanya **berubah sendiri sekitar 5 detik** sesudah Simpan, tanpa
memuat ulang (0 menjadi 1 untuk keduanya). Selama itu jendela input masih terbuka menunggu jawaban server;
lamanya berasal dari kompilasi rute di server dev. Skrip potret dulu hanya menunggu 3 detik. Tidak diubah.

### 5. Tinjauan Kanwil menampilkan angka SK yang akan diterapkan (temuan tambahan)

Ditemukan saat menyiapkan video kenaikan pangkat. Pada laporan SK kenaikan pangkat Arif Setiawan (II/d 9 tahun,
ke III/a), daftar "Perubahan yang diusulkan" di halaman Usulan UPT menampilkan **gaji pokok Rp3.153.600** dan
**TMT KGB berikutnya 1 Agustus 2027 → 1 Agustus 2026**. Itu angka mentah usulan: III/a tanpa potongan masa
kerja 5 tahun, dan jadwal yang dihitung ulang. Yang diterapkan saat disetujui berbeda dan benar
(`setujuiUsulan` membuang kolom dasar gaji usulan dan memakai hitungan SK): III/a 4 tahun, **Rp2.964.000**,
jadwal KGB tetap. Peninjau jadi menyetujui angka yang tidak pernah terjadi.

Hitungan SK dipisah ke `lib/dasarSkUsulan.ts` (`hitungDasarSkUsulan`, `usulanMenurutSk`) dan dipakai **kedua**
tempat: penerapan di `setujuiUsulan`, dan daftar perubahan di `GET /api/usulan`. Keduanya kini tidak dapat
berselisih. Diperiksa pada laporan sungguhan dari kartu UPT:

| Laporan | Sebelum | Sesudah |
|---|---|---|
| Arif, KP II/d → III/a | Gaji pokok → Rp3.153.600; TMT KGB berikutnya → 1 Agustus 2026 | Masa kerja 9 → 4; gaji pokok Rp2.843.700 → Rp2.964.000; jadwal tidak tercantum (tidak berubah) |
| Dimas, PMK 7 tahun 9 bulan | Masa kerja (bulan) 0 → 9 | Masa kerja (tahun) 6 → 7; KGB berikutnya 1 Januari 2028 → 1 Januari 2027 |

Data yang sudah disetujui tidak terdampak: penerapannya sejak awal memakai hitungan SK. Perilaku penerapan
tidak berubah; kodenya hanya dipindah (446 uji, termasuk 3 uji baru di `lib/dasarSkUsulan.test.ts`).

## Akibat

- 446 uji lolos (`node --import tsx --test` untuk lib, app, scripts); `tsc --noEmit` bersih; ESLint bersih
  pada berkas yang disentuh, kecuali galat lama yang sudah ada di main (`page.tsx` setState di efek,
  `seed-sheets-master.ts` tipe `any`).
- Papan diperiksa di Chrome headless pada data video (25 November 2026): tab Perlu diproses menampilkan
  "2 pegawai di tab Di keuangan" dan "1 pegawai di tab Di keuangan"; Tampilkan membuka tab Di keuangan
  dengan 2 dan 1 kartu.
- Tanpa migrasi.
