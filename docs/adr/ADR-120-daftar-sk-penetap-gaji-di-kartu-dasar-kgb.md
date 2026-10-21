# ADR-120: Daftar SK penetap gaji pokok di kartu Dasar KGB

Tanggal: 21 Oktober 2026
Status: berlaku

## Konteks

Kartu Dasar KGB di Data Pegawai hanya menampilkan satu SK acuan ("SK KGB terakhir") dan satu baris "Atas dasar KGB
berikutnya". Kenaikan pangkat yang baru dicatat tidak tercantum di kartu itu, tombol perbaikannya hanya ada di tab
Pangkat & PMK, dan begitu dasarnya bergeser (mis. ke SK KGB berikutnya), KP tidak tampak lagi di baris Atas dasar.
Jendela Linimasa SK memuat semuanya, tetapi hanya untuk dibaca.

## Keputusan

1. Kartu Dasar KGB mendapat baris **Riwayat SK penetap gaji pokok**: seluruh SK KGB, kenaikan pangkat, dan PMK menurut
   TMT, yang terbaru di atas, dari linimasa yang sama dengan Atas dasar (ADR-062, ADR-070).
2. Tiap baris menampilkan jenis, nomor, TMT, tanggal, penetap, rincian, perannya (Atas dasar KGB berikutnya,
   Tergantikan, atau Berlaku sesudah KGB berikutnya), dan dokumennya (ADR-066).
3. **Ubah data SK** dari baris kenaikan pangkat dan PMK membuka jendela yang sama dengan tab Pangkat & PMK (ADR-068,
   ADR-118), dengan hak yang sama. Baris SK dasar Data Pegawai membuka Ubah SK dasar. SK KGB tetap dibetulkan dari tab
   Riwayat KGB; barisnya menyebutkannya.
4. Hanya tampilan dan pintu masuk: tidak ada perubahan data, hitungan, atau skema.

## Yang belum tercakup

Isian SK dasar Data Pegawai tetap satu nilai yang ditimpa (Ubah SK dasar, persetujuan usulan UPT, pembetulan SK riwayat).
Nilai lamanya tidak punya riwayat tersendiri. Menyimpannya butuh tabel dan migrasi baru, dan ditunda sampai diminta.

## Penyempurnaan tampilan (21 Oktober 2026)

Butir pertama versi awal tampil sebagai daftar teks bertumpuk: label peran melebar satu baris penuh, nomor, tanggal, dan
penetap tersusun tanpa hierarki, dan SK yang sama tampil dua kali bila hanya ada satu. Diperbaiki:
- Tiap SK menjadi butir tersendiri: judul (jenis dan nomor) dengan label peran di sebelahnya, satu baris keterangan
  (TMT, tanggal SK, penetap, rincian), dan aksi di sisi kanan (di bawahnya pada layar sempit).
- SK yang menjadi Atas dasar ditonjolkan dengan warna hijau; yang berlaku sesudahnya diberi garis kuning di tepi kirinya.
- Daftar hanya tampil bila ada lebih dari satu SK, atau satu SK yang bukan Atas dasar. Satu SK yang sekaligus Atas
  dasar sudah tampil di baris Atas dasar, dan tombol Ubah SK dasar ada di kepala kartu.
