# ADR-025: Satu halaman kerja per pegawai dan ubah data per bagian

Tanggal: 28 September 2026
Status: berlaku; tahap 2 dari penyederhanaan alur peremajaan data (lanjutan ADR-024)

## Konteks

Memperbarui data satu pegawai melewati enam pintu: modal Ubah pegawai, Catat kenaikan pangkat, Catat PMK, Catat
mutasi, tambah Hukdis, dan tab Dokumen & Pemutakhiran. Empat di antaranya berupa ikon kecil di baris daftar.
Selain itu:

- Modal Ubah menampilkan 20 isian sekaligus, dan `PATCH /api/pegawai/[id]` mengganti seluruh isian. Mengubah satu
  isian berarti mengirim ulang semuanya; tombol Terapkan pada tab pemutakhiran harus menyalin 20 kolom tersimpan.
- Golongan, masa kerja golongan, dan TMT KGB dapat diubah dari tiga tempat dengan aturan berbeda: modal Ubah
  (langsung, tanpa riwayat), Catat KP (dengan potongan MKG), dan Catat PMK (dengan pergeseran jadwal).

## Keputusan (pemilik, 28 September 2026)

1. **PATCH menerima perubahan sebagian.** Kolom yang tidak dikirim memakai nilai tersimpan
   (`gabungIsianPegawai`), sehingga mengubah satu bagian tidak menimpa bagian lain. Gaji pokok yang tidak dikirim
   dihitung ulang dari tabel PP 5/2024 bila golongan atau masa kerja berubah, bukan mempertahankan gaji lama.
2. **Halaman pegawai menjadi satu tempat kerja.** Menu *Tindakan* di sana memuat Ubah identitas, Ubah
   kepegawaian, Ubah dasar KGB, Catat kenaikan pangkat, Catat PMK, dan Mutasi. Tombol + Hukdis, Proses KGB, serta
   tab riwayat dan Dokumen & Pemutakhiran tetap di halaman yang sama.
3. **Daftar Data Pegawai hanya membuka.** Ikon kenaikan pangkat, PMK, mutasi, dan ubah dihapus; tersisa tombol
   **Buka**, pintasan Proses KGB, dan aksi administratif (nonaktifkan, aktifkan, hapus permanen) beserta aksi
   massalnya. Modal di halaman daftar kini khusus menambah pegawai.
4. **Golongan, MKG, dan TMT KGB tidak diubah dari formulir biasa.** Bagian *Dasar KGB* menampilkannya sebagai
   keterangan, dengan penjelasan bahwa perubahannya lewat Catat KP atau PMK. Salah ketik dibetulkan lewat
   **Koreksi data** yang terpisah, disertai peringatan bahwa tidak ada riwayat yang tercatat; perubahannya masuk
   Log Aktivitas seperti perubahan data pegawai lainnya.
5. **NIP diubah dari bagian Identitas**, menggantikan jalur lama di modal 20 isian. Aturan servernya tidak
   berubah: 18 angka, tidak boleh bentrok, dan SK yang sudah terbit tetap memuat NIP lama.

## Akibat

- Tidak ada migrasi basis data.
- Tab Dokumen & Pemutakhiran kini mengirim hanya kolom yang diterapkan, bukan seluruh isian pegawai.
- Peran yang boleh mengubah data pegawai tidak berubah (`canEditPegawai`); menu Tindakan hanya tampil untuk peran itu.
