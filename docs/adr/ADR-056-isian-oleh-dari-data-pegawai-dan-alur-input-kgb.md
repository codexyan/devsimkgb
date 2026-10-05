# ADR-056: Isian "Oleh" dari data pegawai, dan perbaikan alur Input KGB sampai SK

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Tim SDM melaporkan bahwa baris **Oleh (pejabat penetap SK terakhir)** pada Input KGB tidak mengambil data
terbaru dari Data Pegawai. Pada Input Ulang KGB untuk seorang pegawai, isinya masih "Kepala Kantor Wilayah
Kementerian Hukum dan HAM Kalimantan Selatan", berikut nomor SK yang berspasi ("W.19-KP.04.04- 5591").

Penyebabnya: isian Atas Dasar diisi dari **salinan**, yaitu data KGB yang ditolak (Input Ulang), KGB
sebelumnya pada kartu dasbor, atau jadwal Belum Diproses. Salinan itu tidak ikut berubah ketika SK dasar
dibetulkan di Data Pegawai (kartu Dasar KGB: SK dasar dan Ditetapkan oleh). Data pegawai hanya dibaca bila
salinannya tidak bernomor.

Pemeriksaan alur Input KGB → Buat SK → PDF sekaligus menemukan cacat lain:

| No. | Cacat | Akibat |
|---|---|---|
| 1 | Gaji pokok dapat dikoreksi selama KGB berjalan | SK tetap mencetak Gaji Pokok Lama dari salinan saat Input KGB |
| 2 | PDF mencetak pangkat/golongan dari data pegawai, gaji dan masa kerja dari data KGB | Satu SK memuat dua golongan berbeda sesudah koreksi atau kenaikan pangkat. Koreksi golongan juga tidak memperbarui pangkat ("Penata Muda Tingkat I (III/c)") |
| 3 | POST /api/kgb mengisi penetap yang kosong dengan penetap jadwal | Penetap itu dapat milik SK lain |
| 4 | Penetap dicampur antar-SK | Lihat rincian di bawah tabel |
| 5 | SK kenaikan pangkat/PMK sebagai dasar tidak dibatasi | KP lama terpilih bila riwayat KGB kosong walau KGB sesudahnya terjadi di luar SIM-KGB; KP yang berlaku sesudah TMT KGB yang diinput juga ikut terpilih. Server (`skKpLebihBaru`) mengulang celah yang sama untuk penetap jadwal |
| 6 | Persetujuan usulan yang mengganti nomor SK dasar mempertahankan penetap SK lama | Nomor SK baru tercetak dengan penetap SK lama |
| 7 | Nomor SK milik KGB yang dibatalkan tetap terkunci | Input Ulang dengan nomor arsiparis yang sama ditolak "sudah dipakai" |
| 8 | Buat SK selalu menyimpan ulang isian awal pada pratinjau pertama | Dapat menimpa isian yang lebih baru dengan data kartu yang usang |
| 9 | TMT SK dasar sesudah TMT KGB diterima tanpa peringatan | Lazimnya TMT KGB baru yang terketik di kolom yang salah |
| 10 | Input KGB dari dasbor tidak membaca SK arsip | Arsip tanpa surat membuka isian yang hanya berisi TMT |

Rincian butir 4, dua tempat penetap dicampur antar-SK:
- data pegawai + penetap jadwal;
- SK usulan UPT + penetap dari sumber lain.

## Keputusan

1. **SK dasar Data Pegawai diutamakan** (`selaraskanDasarPegawai`, `app/dashboard/components/kgb/format.ts`).
   - **SK yang sama:** nomor setara walau berbeda spasi atau huruf besar (`kunciNomorSk`), atau tanggal SK sama
     ketika salah satunya tidak bernomor. Nomor, tanggal, dan penetap diambil dari data pegawai.
   - **Data pegawai lebih baru, atau salinan tidak menyebut SK:** SK dasar data pegawai dipakai seluruhnya.
   - **Salinan menyebut SK yang lebih baru**, yaitu SK KGB terbitan SIM-KGB: salinan dipertahankan, sebab
     penetapnya memang penandatangan SK itu.
   - **SK kenaikan pangkat atau PMK yang lebih baru tetap menang.**
   - **Isian yang sudah disunting operator tidak pernah ditimpa.** Penandanya dipasang saat operator mengetik,
     bukan diperiksa di dalam fungsi pembaru state. Fungsi itu dijalankan dua kali di mode pengembangan React,
     dan versi pertama membuat pembaruan otomatis gugur.
2. **Penetap tidak dicampur antar-SK.**
   - Server hanya memakai penetap dari isian; yang kosong ditagih di Buat SK.
   - Persetujuan usulan yang mengganti nomor SK dasar mengosongkan penetap SK lama.
3. **Batas SK kenaikan pangkat/PMK.**
   - Batas bawah: TMT SK dasar atau TMT KGB terakhir pegawai, mana yang lebih akhir.
   - Batas atas: TMT KGB yang diinput (klien).
   - `skKpLebihBaru` menerima TMT KGB terakhir pegawai sebagai batas bawah (server).
4. **Gaji pokok dikunci selama KGB berjalan,** sama dengan golongan dan masa kerja.
5. **PDF mencetak pangkat/golongan dari data KGB.** Koreksi golongan tanpa pangkat membaca pangkat dari golongan
   baru (`gabungIsianPegawai`).
6. **Nomor SK KGB yang dibatalkan dilepas** (`nomorSkBentrok`). **Buat SK menganggap isian awal sudah tersimpan.**
7. **Pemeriksaan isian.**
   - TMT SK dasar sesudah TMT KGB ditolak (kecuali Arsip, yang kolomnya berarti TMT SK yang diarsipkan).
   - Nomor SK berspasi di sekitar tanda pemisah diberi petunjuk.
8. **Input KGB dari dasbor membaca SK arsip** (`prev*` dari kolom SK record arsip). Isian TMT-saja diganti pencarian
   riwayat dan data pegawai.

## Akibat

- **Uji lokal, kasus Input Ulang:** salinan bernomor berspasi dengan penetap Kemenkumham, sedangkan data pegawai
  sudah dibetulkan. Isian kini nomor tanpa spasi dan penetap Kementerian Imigrasi dan Pemasyarakatan.
- **Uji lokal, dengan SK kenaikan pangkat TMT April 2026:** dasarnya SK itu, dengan penetapnya sendiri.
- **Yang belum ditangani:**
  - Unduh ulang SK masih mencetak isian dasar terkini dan memakai penetap Kanwil bila kosong pada surat lama.
    Menyimpan salinan dasar pada surat dapat menyusul.
  - Kolom SK dasar data pegawai belum diperbarui otomatis saat KGB selesai di SIM-KGB; urutan tanggal SK di
    atas yang menjaganya.
