# ADR-064: Proses KGB di ponsel, dan label sr-only yang melebarkan halaman

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Di ponsel, semua jendela di halaman Proses KGB (Detail, Input KGB, Buat SK, Linimasa) tampil terpotong di kanan.
Pengukuran di Chrome tanpa layar pada lebar 390 px menunjukkan:
- dokumen selebar 768 px (`scrollWidth`), padahal isi `<main>` hanya 382 px;
- karena itu viewport tata letak ponsel ikut melebar ke 768 px, dan modal yang `position: fixed` dipusatkan pada
  768 px itu.

Penyebabnya label `<span class="sr-only">Aksi</span>` di kepala kolom terakhir tabel:
- `.sr-only` memakai `position: absolute`;
- tidak ada leluhurnya yang *positioned*, sehingga blok acuannya dokumen, bukan wadah gulir tabel (`overflow: auto`);
- akibatnya label itu lolos dari pemotongan wadah dan berdiri di tepi kanan tabel selebar 900 px, sekitar x = 768.

Menambahkan `position: relative` pada wadah itu langsung mengembalikan lebar dokumen ke 390. Hal yang sama terjadi di
halaman satker (583 px).

Selain itu tabel Proses KGB selebar 900 px hanya dapat digeser ke samping di ponsel, sehingga status dan tombol aksinya
berada di luar layar.

## Keputusan

1. **Wadah gulir tabel menjadi blok acuan** (`position: relative`): `.tbl-scroll` (globals.css), `.dsb-gulir-tabel`,
   `.dsb-antrian-gulir`, serta dua pembungkus `overflow-x-auto` di halaman satker dan impor pegawai.
   - Isi absolute di dalamnya kini ikut terpotong dan digulir bersama tabel.
   - Satu-satunya menu melayang yang perlu keluar wadah (`.pgw-menu-isi`) berada di kepala halaman pegawai, bukan di
     dalam tabel.
   - Kepala kolom yang menempel tidak terpengaruh, sebab sticky mengacu ke wadah gulir.
2. **Proses KGB berkartu di bawah 768 px**, mengikuti pola Data Pegawai (`hidden md:block` untuk tabel, `md:hidden`
   untuk daftar kartu).
   - Tiap kartu memuat identitas, gaji lama → baru, TMT KGB beserta batas input, tanda status, dan tombol aksi yang
     sama.
   - Isi kartu dan sel tabel berasal dari fungsi yang sama (`keadaanBaris`, `identitasBaris`, `gajiBaris`, `tmtBaris`,
     `tandaBaris`, `aksiBaris`), sehingga keduanya tidak dapat berbeda.
3. **Saringan Proses KGB di ponsel (≤ 640 px) memakai dua kolom serata**, dengan kotak cari selebar baris. Sebelumnya
   lima pilihan bertumpuk satu per baris dengan lebar berbeda-beda.

## Akibat

Diukur di server lokal, Chrome tanpa layar:
- **Proses KGB, emulasi ponsel 390 px:**
  - lebar dokumen 390 (sebelumnya 768);
  - 29 KGB tampil sebagai kartu, tidak ada yang melewati layar;
  - jendela Detail dan Buat SK selebar layar (0–390).
- **Proses KGB, desktop 1440 px:** tetap tabel 29 baris, dan kepala kolom tetap menempel saat tabel digulir 400 px.
- **Sapuan halaman lain di 390 px:** 23 halaman Super Admin dan Admin UPT tidak lagi melebihi lebar layar, termasuk
  halaman satker yang sebelumnya 583 px.
