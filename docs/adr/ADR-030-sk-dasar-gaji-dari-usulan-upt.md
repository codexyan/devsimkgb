# ADR-030: SK yang mengubah gaji pokok disebut pada usulan UPT, dan dasar KGB berikutnya terlihat oleh UPT

Tanggal: 29 September 2026
Status: berlaku; melengkapi ADR-020 dan ADR-021 pada jalur UPT

## Konteks

Untuk KGB reguler, SK KGB yang sudah terbit dan direkam di Gaji Web menjadi "Atas dasar" SK KGB berikutnya. Itu
sudah berjalan: penyelesaian KGB menyimpan penandatangan SK pada jadwal berikutnya, dan Input KGB mengisi bagian
Atas dasar dari SK KGB terakhir. ADR-020 dan ADR-021 menambahkan pengecualiannya, yaitu SK kenaikan pangkat
(termasuk penyesuaian ijazah) dan SK PMK yang terbit sesudahnya.

Pengecualian itu hanya berlaku bila SK-nya dicatat lewat **Catat kenaikan pangkat** atau **Catat PMK** di
halaman pegawai, sebab dari situlah riwayatnya terbentuk. Padahal pegawai UPT diremajakan lewat **Usulan UPT**
(ADR-024). Akibatnya, sebelum keputusan ini:

1. **Usulan UPT yang mengubah golongan atau masa kerja golongan tidak membentuk riwayat apa pun.** Nilainya
   ditulis langsung ke data pegawai, sehingga SK KGB berikutnya tetap menyebut SK KGB lama walau gaji pokoknya
   sudah berasal dari SK PI atau PMK. Persis cacat yang hendak ditutup ADR-020.
2. **Tidak ada isian untuk SK-nya.** Formulir UPT tidak memuat jenis SK, nomor, tanggal, TMT, maupun pejabat
   penetapnya; dan PMK tidak punya tempat sama sekali, sehingga pergeseran jadwal KGB-nya tidak terhitung.
3. **Admin UPT tidak pernah melihat dasar KGB berikutnya**, padahal saat konfirmasi mereka diminta menyatakan
   bahwa "nomor, tanggal, dan TMT SK terakhir yang menjadi dasar gaji pokok sudah sesuai".

## Keputusan (pemilik, 29 September 2026)

1. **Usulan UPT menyebut sebab perubahannya.** Bila golongan atau masa kerja golongan berubah, usulan wajib
   memilih salah satu (`lib/dasarBaruUsulan.ts`):
   - **SK kenaikan pangkat atau penyesuaian ijazah**, dengan jenis KP, nomor, tanggal, TMT pangkat, dan penetap;
   - **SK peninjauan masa kerja (PMK)**, dengan nomor, tanggal, TMT PMK, dan penetap;
   - **Koreksi data, bukan SK baru**; pembetulan salah ketik; dasar KGB berikutnya tidak berpindah.

   Usulan yang mengubah keduanya tanpa menyebut sebabnya ditolak saat diajukan. Pegawai baru dikecualikan,
   sebab belum ada data tercatat yang berubah.
2. **Persetujuan Kanwil yang mencatat riwayatnya**, lewat jalur yang sama dengan Catat KP/PMK di halaman pegawai
   (`lib/catatDasarGaji.ts`, dipakai bersama oleh kedua rute). Yang berarti:
   - masa kerja golongan dan gaji pokok **dihitung sistem**, bukan diambil apa adanya dari angka yang diketik
     UPT: naik dari golongan II ke III tetap memotong masa kerja 5 tahun, dan PMK tetap menghitung pergeseran
     jadwal KGB-nya;
   - riwayat kenaikan pangkat atau PMK terbentuk, sehingga SK itu menjadi Atas dasar SK KGB berikutnya;
   - hitungannya dijalankan lebih dulu tanpa menulis apa pun, supaya penolakan ADR-011 (SK sudah ditandatangani)
     tetap terjadi sebelum ada data yang berubah.

   Panel tinjauan Kanwil menampilkan SK yang disebut UPT beserta akibat persetujuannya.
3. **Admin UPT melihat dasar KGB berikutnya**:
   - kolom *Dasar KGB berikutnya* pada Data Pegawai UPT, berisi jenis SK, nomor, dan tanggalnya;
   - kartu SK yang sudah direkam di Gaji Web menyebut bahwa SK itu menjadi dasar KGB berikutnya.

   Aturannya satu tempat (`lib/dasarKgbBerikutnya.ts`): SK terbaru yang menetapkan gaji pokok, yaitu SK KGB
   terakhir, atau SK kenaikan pangkat/PMK yang TMT-nya sesudahnya.

## Akibat

- Migrasi `20260929100000_usulan_dasar_baru.sql` wajib dijalankan di Supabase **sebelum** kodenya di-deploy.
  Tanpanya, penyimpanan usulan UPT gagal karena keenam kolomnya tidak dikenal.
- Angka masa kerja golongan yang diketik UPT pada usulan ber-SK menjadi keterangan, bukan penentu: untuk KP
  sistem menghitungnya sendiri, dan untuk PMK angka itu dibaca sebagai masa kerja yang tertulis pada SK PMK.
- `POST /api/pegawai/[id]/pangkat` dan `/pmk` tidak berubah perilakunya; isinya hanya dipindahkan ke lib agar
  dipakai bersama.
- Usulan lama yang sudah disetujui tidak dihitung ulang. Bila dasarnya perlu dibetulkan, Tim SDM mencatat SK-nya
  lewat Catat KP atau Catat PMK seperti biasa.
