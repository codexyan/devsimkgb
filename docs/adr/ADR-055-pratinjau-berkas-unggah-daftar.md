# ADR-055: Pratinjau berkas sebelum Unggah daftar diperiksa

Tanggal: 5 Oktober 2026
Status: berlaku

## Konteks

Unggah daftar langsung mengirim berkas ke server begitu dipilih, lalu menampilkan hasil pemeriksaan per
pegawai (ADR-031). Ada dua hal yang tidak pernah terlihat oleh operator di langkah itu.

1. **Kolom yang tidak terbaca.** Kolom yang judulnya tidak dikenali diabaikan diam-diam. Contohnya nomor
   urut, `nama_golongan`, atau `Tgl Lahir` sebelum dikenali. Isiannya lalu muncul sebagai "perlu dilengkapi"
   di Usulan kolektif, jauh sesudah unggahan.
2. **Isian di luar daftar pilihan.** Pemeriksaan unggahan tidak menolak isian kolom berpilihan yang di luar
   pilihan templat, dan menyimpannya apa adanya. Daftar asli Lapas Banjarmasin lolos sebagai 160 pegawai
   baru, 0 ditolak, padahal berisi:
   - `Eselon III A`, `L`/`P`, `S-1`, `JFT`;
   - tanggal lahir pengganti `2026-01-01`;
   - masa kerja golongan yang belum dipotong.

## Keputusan

1. **Berkas yang dipilih ditampilkan dulu di *Pratinjau berkas*, belum dikirim.** Pratinjau memuat:
   - nama berkas dan lembar yang dibaca (untuk Excel), jumlah baris, serta kolom yang dibaca dan diabaikan;
   - pemetaan tiap judul kolom ke kolom templat, misalnya `Tgl Lahir → Tanggal lahir`;
   - kolom wajib yang hilang dan kolom templat yang tidak ada;
   - tabel isinya apa adanya, 10 baris pertama dengan pilihan menampilkan semua.

   Operator menekan **Lanjut periksa** untuk mengirimnya, atau **Ganti berkas**. Dari langkah Periksa &
   konfirmasi, tombol kembali menuju pratinjau.
2. **CSV dan Excel dibaca sebagai tabel yang sama** (`bacaBerkasUpt`, `lib/imporUsulanUpt.ts`), sehingga
   pengenalan judulnya tidak lagi bergantung pada PapaParse:
   - baris judul dicari di 20 baris teratas (baris pertama yang memuat nip dan nama), jadi judul laporan di
     atasnya dilewati;
   - kolom ganda diabaikan;
   - yang dikirim ke server hanya kolom yang dikenali.
3. **Judul singkat yang lazim ikut dikenali**: `Tgl Lahir`, `T.Lahir`, `TMT Gol`, `Golongan`, `Pendidikan`.
   Hanya yang maknanya tidak mungkin tertukar; `TMT KGB` tidak termasuk.
4. **Isian di luar pilihan templat ditandai kuning, tidak ditolak** (`isianDiLuarPilihan`). Jumlah per kolom
   dan contohnya disebut, dengan saran membetulkannya di berkas. Pratinjau tidak menilai NIP, tanggal, atau
   hitungan; itu tetap tugas server.

## Akibat

- Operator melihat kolom yang hilang dan isian yang menyimpang sebelum apa pun dikirim.
- Pemeriksaan server tetap belum menolak isian di luar pilihan. Menolaknya, atau menormalkan bentuk yang
  jelas (`L` → `Laki-laki`, `S-1` → `S1`), adalah keputusan terpisah, sebab mengubah apa yang selama ini
  diterima.
- Uji asap lokal: daftar asli Lapas Banjarmasin (.xlsx mentah) memperlihatkan 14 kolom dibaca, 2 diabaikan,
  dan isian di luar pilihan pada empat kolom. Templat Excel dan CSV hasil perbaikan memperlihatkan 20 kolom
  dibaca, tanpa tanda. Ketiganya lanjut ke 160 pegawai baru.
