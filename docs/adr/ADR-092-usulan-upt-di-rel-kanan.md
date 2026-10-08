# ADR-092: Panel Usulan UPT menunggu pindah ke rel kanan dasbor Kanwil

Tanggal: 8 Oktober 2026
Status: berlaku. Mengubah letak panel ADR-034/ADR-076. Isi dan cara kerjanya tidak berubah.

## Konteks

Panel *Usulan UPT menunggu* berdiri selebar halaman di antara pita sapaan dan *Antrian kerja KGB*.

Pada layar laptop 1440×900:
- panel itu memakan 126 px, ditambah jaraknya;
- antrian hanya kebagian 650 px tinggi;
- kolom Perlu diinput memuat sekitar dua setengah kartu.

*Perlu tindakan* di rel kanan juga mengulang isi panel yang sama ("3 usulan data UPT menunggu tinjauan…").

Pengguna meminta panel itu dipindah ke samping, bersama Perlu tindakan, supaya antrian tampil maksimal.

## Keputusan

Pilihan pengguna: panel rel paling atas, dan hapus baris yang sama di Perlu tindakan selama panel tampil.

1. Panel menjadi **panel pertama di rel kanan**, di atas Perlu tindakan, karena usulan menahan proses KGB pegawainya.
   Isinya tetap satu baris per UPT dengan jumlah usulan, umur terlama, dan tombol Tinjau. Kepalanya memuat jumlah
   usulan dan tautan *Semua →*. Subjudulnya menyebut jumlah UPT dan jumlah pegawai yang proses KGB-nya tertahan.
2. Baris usulan di **Perlu tindakan dilepas**. Panel tampil tepat ketika baris itu dulu tampil, yaitu bila ada usulan
   menunggu. Keterangan "proses KGB N pegawai tertahan" pindah ke subjudul panel, dan umur terlama ada di tiap baris UPT.
3. **Layar sempit** (di bawah 1200 px): rel melebur ke kisi seperti sebelumnya. Urutannya dijaga:
   1. Usulan UPT menunggu;
   2. Perlu tindakan;
   3. antrian;
   4. panel lainnya.

## Akibat

- Pada 1440×900 tinggi antrian naik dari 650 px menjadi 790 px (+21%). Rel kanan menggulir sendiri pada mode
  "muat satu layar", jadi panel tambahan di sana tidak memendekkan antrian.
- Hanya tampilan. Data, rute API, dan aturan tidak berubah.
