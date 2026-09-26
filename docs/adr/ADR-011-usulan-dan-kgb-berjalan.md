# ADR-011: Usulan UPT ditinjau dari papan, menyesuaikan KGB berjalan, dan draf SK disimpan di server

Tanggal: 27 September 2026
Status: berlaku; menggantikan draf SK di peramban yang sempat dipakai sehari

## Konteks

Tiga hal ditemukan saat Tim SDM memproses KGB dengan usulan UPT yang masih berjalan.

- **Usulan tidak terlihat di tempat kerja.** Papan dan daftar KGB tidak menandai pegawai yang punya usulan
  UPT menunggu. Tim SDM harus pindah ke menu Usulan UPT untuk melihat apa yang diusulkan.
- **Menyetujui usulan tidak menyentuh KGB yang berjalan.** Bila UPT membetulkan golongan atau masa kerja
  setelah Input KGB, data pegawai berubah tetapi hitungan KGB tetap memakai data lama. SK dapat terbit
  dengan gaji pokok yang salah.
- **Draf nomor SK hilang.** Draf nomor SK baru disimpan di peramban, sehingga hilang di komputer lain.
  Pemilik meminta draf itu disimpan di sistem.

## Keputusan

1. **Usulan tampil langsung di papan dan daftar.** Papan dan daftar dasbor Super Admin dan SDM menandai
   pegawai yang punya usulan menunggu, lewat penanda *Ada usulan UPT* dan tombol *Usulan UPT (n)*. Tombol
   itu membuka `ModalUsulanUpt`, yang berisi:
   - perbandingan lama → baru;
   - laporan hukdis;
   - SK dasar dari UPT;
   - berkas;
   - tombol Setujui dan Kembalikan.

   Modal ini memakai rute yang sama dengan menu Usulan UPT.
2. **Persetujuan menyesuaikan KGB berjalan** (`lib/sesuaikanKgbUsulan.ts`), selama SK bertanda tangan belum
   diunggah:
   - KGB yang sedang diproses dihitung ulang dari data baru. SK dasar dari Input KGB tidak disentuh, dan
     potensi rapelan dinilai terhadap tanggal Input KGB.
   - SK yang sudah dibuat tetapi belum diunggah dilepas agar dibuat ulang. Nomor dan tanggalnya dipindah
     ke draf.
   - Jadwal Belum Diproses diselaraskan.

   Setelah SK diunggah (menunggu keuangan), usulan yang mengubah golongan, masa kerja, gaji pokok, atau TMT
   ditolak sebelum apa pun ditulis.
3. **Draf SK disimpan di server.** Kolom `draf_nomor_surat` dan `draf_tanggal_surat` ditambahkan pada
   `riwayat_kgb`.
   - Simpan draf pada Buat SK menulis ke kolom ini lewat `PATCH /api/kgb/[id]` dengan `{ drafSk }`, dan
     membacanya lewat `GET /api/kgb/[id]`.
   - Buat dan Unduh SK mengosongkannya.
   - Nomor yang sudah dipakai SK lain atau dipesan draf KGB lain ditolak (`lib/nomorSkBentrok.ts`).
   - Draf lama di peramban dibaca sekali sebagai cadangan lalu dibersihkan.

## Akibat

- Migrasi `20260927010000_kgb_draf_sk.sql` wajib dijalankan sebelum deploy. Tanpanya, setiap pembuatan record
  KGB gagal karena kolom draf ikut ditulis.
- Menu Usulan UPT tetap ada untuk riwayat dan persetujuan massal per surat.
- Persetujuan satu per satu maupun massal melaporkan penyesuaian KGB-nya ke peninjau dan ke log aktivitas.
