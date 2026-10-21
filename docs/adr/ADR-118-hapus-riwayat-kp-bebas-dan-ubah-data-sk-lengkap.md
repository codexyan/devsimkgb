# ADR-118: Hapus riwayat kenaikan pangkat bebas dan Ubah data SK yang lebih lengkap

Tanggal: 21 Oktober 2026
Status: berlaku

## Konteks

Pegawai Balai Pemasyarakatan Kelas II Amuntai (Naily Wardani) punya tiga riwayat kenaikan pangkat untuk satu SK
(III/b → III/c, SK 6 Mei 2025), dicatat 20 sampai 21 Oktober 2026:

| | Nomor SK | TMT | MKG | Gaji pokok |
|---|---|---|---|---|
| A | `WP.19-79.SA.12 TAHUN 2025` | 1 Jun 2026 | 16 thn | 3.878.500 |
| B | `NOMOR WP.19-79.SA.12 TAHUN 2025` | 1 Jun 2025 | 18 thn | 4.000.600 |
| C | `WP.19-79.SA.12` | 1 Jun 2026 | 18 thn | 4.000.600 |

Tombol "Hapus duplikat ini" (ADR-069) tidak muncul, karena ketiganya dianggap SK berbeda: nomornya ditulis berbeda
dan angkanya tidak persis sama. Penjaga nomor ganda saat Catat KP juga lolos oleh sebab yang sama. Ubah data SK
(ADR-068) hanya dapat membetulkan nomor, tanggal, penetap, dan jenis, sehingga TMT dan masa kerja yang keliru tidak
dapat dibetulkan.

## Keputusan

1. **Inti nomor SK.** `kunciIntiNomorSk` membuang awalan "NOMOR" dan akhiran "TAHUN xxxx", lalu membandingkan sisanya.
   Dipakai untuk mengenali riwayat kembar (ADR-069) dan penjaga nomor ganda saat Catat KP dan PMK. Pencocokan pindaian
   dan Atas dasar tetap memakai `kunciNomorSk`.
2. **Hapus riwayat kenaikan pangkat bebas, khusus Super Admin.** `DELETE /api/pegawai/[id]/pangkat?riwayatId=&mode=bebas`.
   - Riwayat yang menopang data pegawai tidak dapat dihapus. Penopang adalah kenaikan pangkat dengan TMT paling akhir,
     dan bila TMT-nya sama, yang dicatat paling akhir (`lib/riwayatPenopang.ts`). Golongan, TMT golongan, masa kerja,
     dan gaji pokok pegawai berasal dari riwayat itu.
   - Penopang baru boleh dihapus bila ada riwayat lain dengan TMT, golongan, masa kerja, dan gaji yang sama persis.
   - Menghapus riwayat lain tidak mengubah data pegawai maupun KGB. Bila nomor SK-nya tidak lagi tercatat dan masih
     disebut sebagai Atas dasar pada KGB atau SK dasar pegawai, hasilnya memberi peringatan; datanya tidak diubah.
   - Log Aktivitas: "Hapus riwayat KP".
   - PMK tidak dapat dihapus bebas, sebab tiap PMK sudah menambah masa kerja pegawai. PMK ganda tetap dihapus lewat
     alur kembar (ADR-069).
3. **Ubah data SK lebih lengkap, khusus Super Admin.** Selain nomor, tanggal, penetap, dan jenis:
   - Kenaikan pangkat: TMT pangkat, masa kerja golongan baru, dan keterangan. Gaji pokok dihitung ulang dari tabel gaji
     (PP 5/2024), tidak diketik. Golongan tetap terkunci.
   - PMK: keterangan saja, karena TMT dan masa kerjanya sudah dihitung terhadap data pegawai.
   - Bila yang diubah adalah kenaikan pangkat penopang, TMT golongan, masa kerja, dan gaji pokok pada Data Pegawai
     ikut dibetulkan, dan jadwal KGB "belum diproses" dihitung ulang. KGB Sedang Diproses atau Menunggu Keuangan tidak
     diubah; hasil simpan menyebutkannya agar ditinjau.
   - Bukan penopang: hanya riwayatnya yang berubah.
   - Tim SDM KGB tetap hanya dapat membetulkan nomor, tanggal, penetap, dan jenis. Isian lanjutan dari peran lain
     diabaikan server.

## Akibat

- Kasus Naily: C tetap sebagai penopang; A dan B dapat dihapus tanpa mengubah angka. TMT yang benar (2025 atau 2026)
  diputuskan Tim SDM dari SK fisik, lalu dibetulkan lewat Ubah data SK pada C.
- Baris KGB yang ditolak dengan MKG 18 thn 6 bln pada pegawai itu tidak disentuh; itu urusan alur KGB.
