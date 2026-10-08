# ADR-091: Usulan pegawai baru yang NIP-nya sudah tercatat diterapkan sebagai perbaikan data

Tanggal: 8 Oktober 2026
Status: berlaku. Melengkapi ADR-079 (persetujuan pegawai baru yang terputus).

## Konteks

Super Admin tidak dapat menyetujui usulan pegawai baru Hendra Irawan dari Lapas Perempuan Martapura. Persetujuannya
berhenti dengan pesan "NIP … sudah tercatat atas nama Hendra Irawan. Kembalikan usulan ini dan minta UPT mengirim usulan
perbaikan data." Hendra memang sudah ada di data induk: KGB-nya sedang diproses dan SK-nya sudah disetujui UPT.

NIP draf pegawai baru diperiksa saat draf dibuat. Saat diajukan, NIP-nya tidak diperiksa ulang. Pegawainya bisa tercatat
di antara dua saat itu, misalnya oleh persetujuan yang terputus (ADR-079) yang tidak lagi dikenali sebagai lanjutan karena
pegawainya sudah punya usulan disetujui. Usulan seperti itu buntu:
- menyetujuinya akan menggandakan pegawai;
- mengembalikannya memaksa UPT menghapus draf lalu mengetik ulang usulan perbaikan.

Kedua papan juga tampak berbeda, padahal datanya sama. Satu orang punya dua hal: KGB yang berjalan dan usulan pegawai baru
yang tertinggal.
- **Papan Kanwil** memisahkan keduanya: KGB di kolom Sedang diproses, usulan di Usulan UPT menunggu.
- **Papan UPT** menggabungkan kartu per NIP: usulan menunggu tampil sebagai kartu utama ("Pegawai baru: menunggu
  tinjauan"), dan status SK hanya ada di baris "Juga".

Detail usulan di Kanwil juga menulis "Pegawai ini belum tercatat", yang tidak benar.

## Keputusan

Pilihan pengguna: terapkan sebagai perbaikan di Kanwil, dan jadikan perbaikan saat diajukan di UPT.

1. Usulan pegawai baru yang NIP-nya sudah tercatat **di satker yang sama** diperlakukan sebagai **usulan perbaikan data**
   pegawai itu (`lib/usulanBaruTercatat.ts`):
   - jenis menjadi `perubahan`;
   - `pegawaiId` menunjuk pegawai tercatat;
   - `unitKerja` dikosongkan;
   - isian lain tetap. Isian yang sama dengan data tercatat tidak terbaca sebagai perubahan.
2. **Persetujuan Kanwil** (`setujuiUsulan`, satu per satu maupun per surat): lanjutan ADR-079 tetap didahulukan.
   - Bila bukan lanjutan, jenisnya ditulis lebih dulu, lalu usulan diterapkan lewat jalur perbaikan.
   - Penyesuaian KGB berjalan, penolakan perubahan dasar gaji sesudah SK diunggah, dan pencatatan SK KP/PMK mengikuti
     jalur itu apa adanya.
   - Usulan yang gagal diterapkan tetap berjenis perbaikan, jadi Kembalikan mengirimnya ke UPT sebagai perbaikan.
3. **Pengajuan UPT** memeriksa ulang NIP draf pegawai baru.
   - Bila tercatat di satker ini, draf diajukan sebagai perbaikan. Kelengkapan dan berkas bawaan dihitung sebagai
     perbaikan, dan kabarnya menyebut nama pegawai yang dijadikan perbaikan.
   - Pengajuan ditolak bila pegawai itu sudah punya usulan lain yang belum selesai.
4. **NIP yang tercatat di satker lain** tetap ditolak, sebab pemindahan antarsatker dicatat Kanwil.
   - Di Kanwil, pesannya menyebut satker pegawai itu.
   - Di UPT, draf bertanda "Belum lengkap: NIP … sudah tercatat di satker lain. Hapus draf ini". Nama dan id pegawai satker
     lain tidak dikirim ke UPT.
5. **Tampilan:**
   - **Kanwil, Usulan UPT:** usulan tampil sebagai perbaikan dengan daftar perubahan terhadap data tercatat, bertanda
     *NIP sudah tercatat*. Catatannya menjelaskan bahwa menyetujui tidak menambah pegawai. Yang di satker lain bertanda
     *NIP di satker lain*.
   - **UPT, papan Alur KGB:**
     - draf bertuliskan "Perbaikan data" dengan catatan "NIP sudah tercatat atas nama …; diajukan sebagai perbaikan data";
     - usulan yang sudah menunggu bertuliskan "Perbaikan data: menunggu tinjauan";
     - baris pegawai baru di tabel Pegawai Satker tidak lagi menggandakan pegawai yang sudah ada.

## Akibat

- Tidak ada migrasi: hanya nilai kolom `jenis`, `pegawaiId`, dan `unitKerja` pada baris usulan yang berubah.
- Usulan Hendra yang sedang menunggu dapat langsung disetujui sesudah rilis. Bila isiannya sama dengan data tercatat,
  persetujuan tidak mengubah data, KGB, maupun SK-nya.
- Isian pegawai baru yang berbeda dari data tercatat, misalnya nama bergelar atau jabatan baru, ikut diterapkan bila
  disetujui. Kanwil melihat daftarnya lebih dulu, sama dengan usulan perbaikan biasa.
