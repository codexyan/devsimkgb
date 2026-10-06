# ADR-069: Riwayat kenaikan pangkat dan PMK yang tercatat dua kali

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

Sesudah ADR-068 dideploy, produksi mencatat enam permintaan `PATCH /api/pegawai/[id]/pangkat` yang dijawab 409 (6 Oktober
2026, 02.13 sampai 02.15 UTC). Pegawai itu punya dua riwayat kenaikan pangkat untuk SK yang sama:
- nomor sama, TMT sama, dan golongan II/b → III/a yang sama;
- yang berbeda hanya jenis (Reguler dan Penyesuaian Ijazah) dan pejabat penetapnya.

Pemeriksaan nomor kembar pada ADR-068 menolak setiap pembetulan pada keduanya, dan belum ada cara menghapus salah
satunya. Linimasa SK penetap gaji pokok menampilkan SK itu dua kali dengan penetap berbeda, sehingga membingungkan.

## Keputusan

1. **Riwayat kembar:** dua riwayat sejenis dengan nomor SK, TMT, dan (untuk kenaikan pangkat) golongan baru yang sama
   adalah satu SK yang tercatat dua kali (`lib/riwayatKembar.ts`). Riwayat yang hanya bernomor sama tetapi berbeda
   golongan atau TMT bukan duplikat.
2. **Penanda di tab Pangkat & PMK:** baris yang kembar diberi penanda "Tercatat dua kali", lengkap dengan jenis dan
   penetap pasangannya, serta tombol **Hapus duplikat ini** untuk Super Admin dan Tim SDM KGB.
   - Jendela konfirmasinya menampilkan riwayat yang dihapus dan yang tetap tercatat.
   - `DELETE /api/pegawai/[id]/pangkat?riwayatId=` (dan `/pmk`) hanya menghapus riwayat yang punya kembaran.
   - Data pegawai, KGB, dan pindaian tidak diubah, sebab riwayat yang tersisa mencatat SK dan kenaikan yang sama.
   - Riwayat tanpa kembaran tidak dapat dihapus dari sini, karena data gaji pegawai sudah dihitung darinya.
3. **Pembetulan pada riwayat yang telanjur kembar tetap boleh.** Penetap, tanggal, dan jenis dapat dibetulkan.
   Nomornya baru boleh diganti setelah duplikatnya dihapus, supaya KGB dan pindaian yang menunjuk nomor itu tidak
   terbelah.
4. **Mencegah duplikat baru:** Catat KP/PMK, termasuk lewat persetujuan usulan UPT, menolak SK bernomor sama yang
   sudah tercatat untuk pegawai itu. Pesannya mengarahkan ke Ubah data SK.
5. **Log Aktivitas** mencatatnya sebagai "Hapus KP kembar" atau "Hapus PMK kembar".

## Akibat

- Linimasa SK langsung menampilkan SK itu sekali setelah duplikatnya dihapus.
- Duplikat yang sudah ada di produksi dibersihkan Tim SDM dari tab Pangkat & PMK, satu per pegawai.
