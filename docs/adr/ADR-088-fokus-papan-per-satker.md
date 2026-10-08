# ADR-088: Fokus papan antrian Kanwil per satker dan per periode TMT

Tanggal: 8 Oktober 2026
Status: berlaku. Melengkapi ADR-036 (kartu satker di dasbor Kanwil).

## Konteks

Panel **Pekerjaan per satker** sudah dapat menyaring papan antrian: menekan satker atau satu baris TMT. Tetapi pilihannya
hanya satu, hilang begitu halaman dimuat ulang atau berpindah menu, dan tidak tampak sebagai kunci. Kanwil ingin memilih
apa yang dikerjakan lebih dulu, misalnya LPP Martapura TMT Des 2026 dan Kanwil TMT Okt 2026, lalu papan tetap terfokus ke
situ.

Pilihan pengguna:
- Fokus tampilan, tidak menahan pekerjaan.
- Tersimpan per akun.

## Keputusan

1. **Gembok per satker dan per baris TMT** di panel Pekerjaan per satker (`lib/fokusPapan.ts`):
   - Satker yang dikunci menampilkan seluruh periodenya. Periode dapat dikunci satu-satu.
   - Mengunci periode di satker yang sedang dikunci utuh mempersempit satker itu ke periode tersebut.
   - Mengunci satker melepas kunci periode di dalamnya.
   - Boleh beberapa kunci sekaligus. Tanpa kunci, papan menampilkan semuanya.
2. **Hanya tampilan.** Papan, angka ubin, dan kolomnya disaring fokus. Kolom Keuangan Kanwil atau Rekam di UPT
   disembunyikan bila fokusnya hanya UPT atau hanya Kanwil. Tidak ada tindakan yang ditahan.
3. **Tersimpan per akun di peramban** (`localStorage`, kunci `kgb-fokus-papan:<NIP>`).
   - Kunci yang satker atau periodenya sudah tidak punya pekerjaan diabaikan, supaya papan tidak kosong diam-diam. Kunci
     itu dibuang saat fokus diubah berikutnya.
   - Mengubah fokus mengembalikan saringan satker dan TMT di kepala papan ke "semua", sebab fokus menjadi saringan utama.
4. **Terlihat:**
   - Kepala papan menampilkan penanda **Fokus: …** bergembok; tanda silangnya membuka semua kunci.
   - Panel menampilkan **Buka semua (n)** dan petunjuk singkat.

## Akibat

- Fokus tidak berpindah antarperangkat dan tidak dibagi ke akun lain. Perangkat atau akun lain menampilkan semuanya.
- Tidak ada perubahan server atau migrasi.
