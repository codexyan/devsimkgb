# ADR-013: Antrian kerja KGB sebagai kartu utama dashboard

Tanggal: 27 September 2026
Status: berlaku; menggantikan susunan pita dan lini masa mendatar pada ADR-012

## Konteks

Tangkapan layar dashboard Super Admin pada layar laptop 1366×768 memperlihatkan bahwa *Antrian kerja KGB*
hanya menampilkan **satu baris pegawai**. Tinggi layar habis untuk tiga hal:

- pita navy dengan empat kartu angka (±195 px);
- lini masa selebar layar (±205 px);
- tiga baris alat antrian (±150 px).

Keempat kartu angka juga mengulang tab tahap di antrian. Jumlah "lewat batas" muncul di tujuh tempat. Nama
satker lengkap terpotong di semua kolom sempit.

## Keputusan

1. **Pita ringkas** (`PanelNavy ringkas`) setinggi satu baris: sapaan, tanggal, jumlah pegawai, dan tombol
   perbarui.
2. **Angka tahap menjadi ubin saringan di kepala antrian.** Ubin berisi Perlu diproses, Lewat batas, Di
   keuangan (Kanwil dan rekam UPT), Selesai dengan bilah kemajuan, serta Semua. Keempat kartu angka di pita
   dan modal rinciannya dihapus. Potensi rapelan kini dibuka dari *Perlu tindakan*.
3. **Satu baris alat.** Saringan satker berupa satu pilihan (semua, Kanwil, seluruh UPT, atau satu UPT),
   diikuti kolom cari dan tombol Daftar/Papan. Tombol Daftar/Papan hanya ikon di bawah 1600 px.
4. **Tabel padat.**
   - Nama pegawai dengan baris kedua golongan · satker ringkas; NIP, jabatan, dan nama satker lengkap ada di
     tooltip.
   - TMT dan batas input dalam satu kolom. Batas hanya tampil sebelum KGB diinput.
   - Status singkat; lamanya lewat batas tidak diulang.
   - Satu tombol langkah berikutnya per baris.

   Hasilnya, ±9 baris terlihat di 1366×768 dan ±10 baris di 1440×900.
5. **Rail kanan berisi tiga panel:**
   - *Perlu tindakan*: setinggi isinya. Butir rapelan hanya muncul bila menambah informasi.
   - *Jadwal input*: lini masa tegak enam bulan TMT.
   - *Pantau satker*: nama ringkas dan jumlah pegawai di antrian.
6. **Nama satker ringkas di tampilan padat** (`namaRingkasSatker`), misalnya "Rutan Rantau" dan "Lapas
   Perempuan Martapura". Ini pengecualian atas aturan nama lengkap, dan hanya berlaku untuk tabel antrian,
   kartu papan, dan rail dashboard. Formulir, ekspor, dan surat tetap memakai nama lengkap.

## Akibat

- Tidak ada perubahan data atau API.
- Tata letak diperiksa lewat tangkapan layar pada 1366×768, 1440×900, dan 420×860 dengan data contoh lokal
  (`DATA_BACKEND=lokal`).
