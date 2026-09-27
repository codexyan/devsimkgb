# ADR-017: SK dasar dan berkas yang disetujui terbawa ke usulan perbaikan

Tanggal: 27 September 2026
Status: berlaku

## Konteks

Berkas usulan UPT disimpan per baris usulan (`usulan_pegawai.path_*`), bukan pada data pegawai.

- Pegawai yang didaftarkan lewat *Tambah pegawai* lengkap dengan SK CPNS dan pindaiannya tampil kosong lagi
  begitu UPT mengusulkan perbaikan. Berkasnya tertinggal pada usulan lama yang sudah disetujui.
- Nomor dan tanggal SK dasar baru disalin ke data pegawai sejak ADR-010. Pegawai yang disetujui sebelumnya
  tidak punya SK dasar, sehingga formulir perbaikan dan tabel kolektif menampilkannya kosong.
- Setelah *Simpan* di tabel kolektif, kolom berkas kembali bertuliskan "pilih PDF" karena daftar berkas
  tersimpannya tidak dimuat ulang. Operator mengira berkasnya tidak tersimpan.

## Keputusan

1. **Bawaan per pegawai** (`lib/bawaanUsulan.ts`):
   - Untuk tiap jenis berkas pegawai, diambil berkas dari usulan *disetujui* terbaru yang memuatnya. Surat
     usulan Srikandi tidak ikut, karena surat itu milik pengajuannya.
   - SK dasar diambil dari `pegawai.nomorSkDasar`/`tanggalSkDasar`. Bila kosong, dari usulan disetujui
     terakhir yang memuat nomor SK.
2. **`GET /api/upt`** mengirim `bawaan` per pegawai. Formulir perorangan dan tabel kolektif memakainya
   sebagai isian awal dan menampilkan berkasnya dengan tanda "dari usulan yang disetujui".
3. **Disalin, bukan dirujuk.** Saat draf disimpan (POST/PATCH) atau diajukan, berkas bawaan yang diminta
   keadaan pegawainya dan masih kosong disalin ke objek R2 baru milik usulan itu (`salinBerkasBawaan`).
   - Rujukan bersama akan ikut terhapus ketika draf dihapus.
   - Berkas bawaan yang dihapus operator pada formulir (`hapusBerkas`) tidak disalin.
   - Kelengkapan (`kekurangan`) dihitung dengan berkas bawaan, sehingga draf lama langsung terbaca lengkap.
4. Tabel kolektif memuat ulang daftar berkas tersimpan tiap baris setelah menyimpan.

## Akibat

- Tidak ada kolom atau migrasi baru.
- Pegawai yang ditambahkan Kanwil langsung (tanpa usulan UPT) tetap tidak punya berkas bawaan. Berkasnya
  diunggah sekali pada usulan pertama, lalu terbawa sesudahnya.
