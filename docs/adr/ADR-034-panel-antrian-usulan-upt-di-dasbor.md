# ADR-034: Panel antrian Usulan UPT di dasbor Kanwil

Tanggal: 30 September 2026
Status: berlaku; melengkapi ADR-011

## Konteks

Meninjau usulan UPT adalah pekerjaan harian Super Admin, bukan sesekali. Jalur menemukannya sudah cukup
lengkap: lonceng notifikasi berjumlah, butir pada pita *Perlu tindakan* beserta umur usulan terlama,
lencana pada menu *Usulan UPT*, penanda *Tertahan usulan UPT* pada kartu dan baris antrian beserta jendela
tinjauan di tempat (ADR-011), dan angka usulan per satker pada Pantau satker.

Yang belum ada: **tempat mengerjakannya tanpa berpindah halaman**. Pita *Perlu tindakan* hanya menyebut
jumlah lalu melempar ke modul; penanda pada antrian hanya muncul bagi pegawai yang sudah tercatat,
sehingga usulan pegawai baru — yang menjadi jalur utama sejak Unggah daftar (ADR-031) — tidak punya titik
sentuh di dasbor sama sekali.

## Keputusan (pemilik, 30 September 2026)

Satu panel **"Usulan UPT menunggu"** di dasbor Kanwil, tepat di bawah kepala halaman dan di atas Antrian
kerja KGB, karena usulan yang belum ditinjau menahan proses KGB pegawainya (ADR-014).

- Isinya **seluruh** usulan berstatus menunggu, termasuk usulan pegawai baru.
- **Dikelompokkan per UPT**, yang terbanyak lebih dulu: satu surat usulan lazim memuat beberapa pegawai
  satker yang sama, sehingga peninjau menuntaskan satu surat sekaligus alih-alih melompat antar satker.
- Tiap baris **ditinjau di tempat** lewat `ModalUsulanUpt`, jendela yang sama dengan menu Usulan UPT. Ia
  sudah generik (memakai `DetailUsulan`), jadi usulan pegawai baru tertangani tanpa perubahan.
- Panelnya berada **di luar** `.dsb-dasbor-isi`. Di dalam kisi itu ia merebut satu-satunya baris `1fr`
  pada mode "muat satu layar" dan menghimpit antrian menjadi sesobek garis.
- Tinggi daftarnya dibatasi `min(340px, 30vh)` agar antrian kerja tetap kebagian layar saat usulan menumpuk.

## Akibat

- Tidak ada rute, skema, atau permintaan jaringan baru: panel memakai `usulanMenunggu` yang sudah dimuat
  dasbor untuk pita *Perlu tindakan* dan Pantau satker.
- Dasbor bertambah tinggi satu panel saat ada usulan menunggu, dan kembali seperti semula saat kosong.
- Panel ini berhenti berguna bila usulan menumpuk sampai ratusan; bila itu terjadi, saringan per UPT di
  modul Usulan UPT tetap jalur yang benar, dan panel hanya menjadi pintu masuknya.
