# ADR-089: Kartu Sedang diproses diurutkan dan ditandai menurut tindakan Kanwil

Tanggal: 8 Oktober 2026
Status: berlaku. Melengkapi ADR-077 dan ADR-087 (review SK oleh UPT).

## Konteks

Di papan antrian Kanwil, kartu kolom **Sedang diproses** diurutkan menurut TMT lalu nama. Kartu yang sudah disetujui UPT
dan siap dicetak tampak sama dengan kartu yang masih menunggu UPT; bedanya hanya titik kecil berwarna. Keterangan
kolom "n tunggu TTE" juga ikut menghitung SK yang masih menunggu review UPT.

Pilihan pengguna:
- Desain A: garis warna, label keadaan, dan tombol utama. Kartu yang menunggu UPT diredupkan.
- Urutan menurut tindakan Kanwil.

## Keputusan

1. **Tindakan berikutnya** per KGB yang sedang diproses (`lib/tindakanProses.ts`):
   - `perbaikan`: UPT minta perbaikan.
   - `siap`: disetujui UPT, review dilewati, atau pegawai Kanwil tanpa review.
   - `buat_sk`: SK belum dibuat.
   - `minta_review`: SK lama belum pernah direview.
   - `menunggu_upt`.
2. **Urutan** di kolom Sedang diproses:
   1. perbaikan;
   2. siap cetak;
   3. buat SK dan minta review;
   4. menunggu UPT paling bawah.

   Dalam tiap kelompok, batas input terdekat lebih dulu, lalu TMT dan nama.
3. **Tampilan kartu:**
   - **Siap cetak:** garis hijau di kiri dan label *SIAP CETAK*. Keterangannya "Disetujui UPT <tanggal>", atau alasan
     review dilewati. **Cetak SK** menjadi tombol utama hijau penuh di depan, disusul Unggah TTE.
   - **Perbaikan:** garis merah, label *PERBAIKI SK*, catatan UPT, dan Perbaiki SK sebagai tombol utama.
   - **Menunggu UPT:** bingkai putus-putus, isi diredupkan, dan keterangan lama menunggu ("Menunggu review UPT · n hari").
   - Tombol batalkan (✕) dipindah ke ujung, supaya tombol pertama selalu langkah berikutnya.
4. **Keterangan kolom** menjadi ringkasan menurut tindakan, misalnya "1 perbaikan · 1 siap cetak · 1 menunggu UPT".

## Akibat

- Hanya tampilan dan urutan; aturan cetak dan unggah tidak berubah. Tidak ada migrasi.
