# ADR-020: Atas dasar SK KGB adalah SK terbaru yang menetapkan gaji pokok

Tanggal: 28 September 2026
Status: berlaku; mengubah butir "SK kenaikan pangkat tidak dipakai sebagai SK dasar" pada ADR-010

## Konteks

Bagian "Atas dasar" SK KGB memuat surat keputusan terakhir tentang gaji/pangkat: pejabat penetap, tanggal,
nomor, TMT, dan masa kerja golongan pada tanggal itu. ADR-010 menetapkan SK dasar sebagai SK KGB terakhir
(atau SK CPNS bagi KGB pertama) dan tidak memakai SK kenaikan pangkat.

Pegawai yang naik pangkat sesudah KGB terakhir, terutama lewat penyesuaian ijazah dari golongan II ke III/a,
menerima gaji pokok baru dari SK kenaikan pangkat itu. Bila SK KGB berikutnya tetap berdasar SK KGB lama,
bagian "Atas dasar" menyebut SK yang golongan dan gaji pokoknya sudah tidak berlaku. Hal yang sama terjadi
dengan SK peninjauan masa kerja (PMK), yang menambah masa kerja golongan dan menetapkan gaji pokok baru.

## Keputusan (pemilik, 28 September 2026)

1. Atas dasar SK KGB adalah **SK terbaru yang menetapkan gaji pokok**: SK KGB, SK kenaikan pangkat (termasuk
   penyesuaian ijazah), atau SK PMK. Jadwal KGB tetap dihitung dari TMT KGB terakhir; kenaikan pangkat tidak
   menggesernya (Buku Saku KP 2026).
2. Tahap 1, kenaikan pangkat:
   - `riwayat_pangkat` mendapat kolom `penetap_sk`, diisi pada formulir Catat Kenaikan Pangkat.
   - Input KGB mencari SK dasar seperti ADR-010, lalu memeriksa riwayat kenaikan pangkat. Bila SK kenaikan
     pangkat ber-TMT pada atau sesudah TMT SK dasar itu, isian Atas dasar diganti dengan SK kenaikan pangkat
     (`dasarDariKenaikanPangkat`), dengan catatan asalnya. Isian yang sudah disunting tidak ditimpa.
   - Mencatat kenaikan pangkat yang lebih baru dari KGB terakhir yang selesai mengganti penetap SK dasar pada
     jadwal "belum diproses" dengan penetap SK kenaikan pangkat (`skKpLebihBaru`); kosong bila belum diketahui,
     supaya penetap SK KGB lama tidak ikut tercetak.
3. Tahap 2, PMK: lihat ADR-021. PMK dapat menggeser jadwal KGB, sehingga dicatat tersendiri di Data
   Pegawai, dan SK PMK ikut dibandingkan sebagai Atas dasar.

## Akibat

- Migrasi `20260928100000_riwayat_pangkat_penetap.sql` wajib dijalankan di Supabase **sebelum** kodenya
  di-deploy, karena mencatat kenaikan pangkat dengan penetap menulis kolom baru itu.
- Riwayat kenaikan pangkat yang dicatat sebelum aturan ini tidak memiliki penetap. Input KGB menandainya dan
  meminta Tim SDM mengisi baris "Oleh".
- KGB yang sudah sedang diproses atau menunggu keuangan tidak diubah; kenaikan pangkat tetap mengembalikannya
  sebagai daftar "perlu ditinjau" (ADR-005).
