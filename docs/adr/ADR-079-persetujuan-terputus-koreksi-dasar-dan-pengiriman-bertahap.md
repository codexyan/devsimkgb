# ADR-079: Persetujuan yang terputus dilanjutkan, keadaan pada SK KGB terakhir boleh dibetulkan, dan pengiriman bertahap

Tanggal: 7 Oktober 2026
Status: berlaku. Mengganti keputusan 5 ADR-078 (bagian atas dikunci ke data tercatat).

## Konteks

Pada 7 Oktober 2026 Admin UPT Lapas Perempuan Martapura mengajukan 57 pegawai dengan satu surat. Analitik Cloudflare
(waktu WITA) menunjukkan rangkaiannya:

1. **09.48–10.05**: pengajuan beberapa kali gagal. Satu permintaan memeriksa, memperbarui, membuat notifikasi, dan menyalin
   berkas R2 untuk seluruh draf, lalu terhenti oleh batas CPU Worker (`exceededResources`). Sebagian usulan sudah berstatus
   menunggu, sebagian masih draf.
2. **10.07–10.08**: persetujuan seluruh surat oleh Kanwil (`POST /api/usulan/batch`) gagal 500 dengan sebab yang sama.
   `setujuiUsulan` menulis riwayat kenaikan pangkat sebelum data pegawai, sehingga ada pegawai yang SK-nya sudah tercatat
   tetapi golongan dan masa kerjanya belum ikut (kasus Hafizatun: SEK-2156.SA.04.05 TAHUN 2026 tercatat, data tetap II/b).
   Menekan Setujui lagi ditolak pemeriksaan SK ganda (ADR-069): "SK kenaikan pangkat … sudah tercatat pada riwayat pegawai
   ini". Pegawai baru yang sudah terbentuk ditolak sebagai NIP ganda.
3. **13.52–14.01**: Admin UPT menghapus 26 usulan untuk mengulang. Penghapusan usulan menghapus baris dan berkasnya, jadi
   isinya tidak dapat dipulihkan sistem; pegawai yang sudah masuk data induk tetap ada.

Bersamaan dengan itu, di formulir usulan dan Usul KGB Kolektif, menjawab *Ada* pada SK sesudah SK KGB terakhir mengganti
bagian atas dengan data tercatat lalu menguncinya (ADR-078 keputusan 5). Data tercatat beberapa pegawai berasal dari
hitungan mundur lama (contoh Alpiati Noor: II/b 7 tahun pada SK KGB terakhir tampil sebagai III/a 5 tahun 10 bulan), jadi
UPT tidak dapat membetulkannya, padahal SK sesudahnya seharusnya dihitung dari II/b. Golongan dan TMT pada bagian SK KGB
terakhir tidak dapat diubah.

Pilihan pengguna dari opsi yang diajukan: *Setujui ulang melanjutkan*, *Boleh, sekaligus koreksi*, dan kolom papan
tersendiri untuk SK yang menunggu review UPT.

## Keputusan

1. **Setujui ulang melanjutkan penerapan yang terputus** (`lib/setujuiUsulan.ts`, `rencanaSkUsulan` di
   `lib/dasarSkUsulan.ts`). SK yang dilaporkan dicari di riwayat pegawai menurut nomornya (`cariSkTercatat`).
   - Belum tercatat: dicatat seperti biasa.
   - Tercatat dan sudah diterapkan (golongan pegawai sudah setinggi golongan baru SK kenaikan pangkat, atau masa kerja PMK
     sudah bergeser): SK tidak dicatat ulang dan kolom yang ditentukan SK tidak ditimpa; isian lain usulan tetap diterapkan.
   - Tercatat tetapi belum diterapkan (terputus): riwayat yang ada dilengkapi (`riwayatAda` pada `catatKenaikanPangkat` dan
     `catatPmk`), data pegawai diperbarui, tanpa baris kedua.
   - Pegawai baru yang sudah terbentuk oleh persetujuan yang terputus (satker sama, dibuat sezaman dengan konfirmasi UPT,
     belum punya usulan disetujui) ditautkan ke usulannya dan dilengkapi. Pegawai yang dicatat Kanwil sendiri tetap ditolak
     sebagai NIP ganda.
2. **Keadaan pada SK KGB terakhir boleh dibetulkan bersama SK sesudahnya.** Formulir dan Kolektif tidak lagi mengunci atau
   mengganti golongan, masa kerja, TMT golongan, dan TMT KGB terakhir saat menjawab *Ada*. Bila isian itu berbeda dari data
   tercatat, formulir menyebut koreksinya (`koreksiAtas`), dan Kanwil menghitung SK dari keadaan yang dibetulkan
   (`dasarSebelumSk`); jadwal KGB dihitung ulang dari situ. SK yang sudah tercatat dihitung ulang dari keadaan yang
   dibetulkan, bukan dicatat dua kali. Formulir memperingatkan bila SK yang dilaporkan sudah tercatat.
3. **Pengiriman bertahap.**
   - UPT (`app/dashboard/components/upt/ajukanBertahap.ts`): lebih dari 5 pegawai diperiksa sekaligus tanpa menyimpan
     (`periksaSaja`), lalu dikirim per 5. Salinan surat diunggah pada kiriman pertama dan kiriman berikutnya memakai jalurnya
     (`pathBerkas`, hanya `usulan/<kode satker>_berkas_…`). Kiriman yang gagal dicoba sekali lagi; usulan yang sudah
     menunggu dengan surat yang sama dihitung terkirim, jadi mengulang aman. Rute hanya membaca pegawai dan usulan disetujui
     milik draf yang dikirim, dan keadaan pernah KGB dibaca dari keadaan pada SK KGB terakhir.
   - Kanwil (menu Usulan UPT): *Setujui semua* pada satu surat dikirim per 3 usulan dengan keterangan kemajuan. Bila satu
     kiriman gagal, yang sudah disetujui tetap disetujui dan menekan Setujui lagi melanjutkan sisanya (keputusan 1).
4. **Kolom Periksa SK** di papan Alur KGB UPT, di antara Di Kanwil dan SK terbit: SK KGB buatan Kanwil yang menunggu review
   UPT (ADR-077), dengan jumlahnya di kepala kolom. Sebelumnya kartu ini bercampur dengan draf di Perlu dikerjakan.
5. **Penelusuran data produksi** (`docs/sql/telusur-usulan-terputus.sql`): kueri baca saja untuk SQL Editor Supabase yang
   menemukan SK tercatat dengan data pegawai belum ikut, pegawai baru tanpa usulan disetujui, penghapusan hari itu, dan
   usulan yang belum selesai.

## Akibat

- Persetujuan yang terputus diselesaikan dengan menekan Setujui lagi, tanpa menyunting data pegawai secara manual.
- UPT dapat membetulkan keadaan pada SK KGB terakhir tanpa mengajukan koreksi terpisah lebih dulu; Kanwil melihat
  koreksinya di catatan usulan.
- Usulan yang dihapus tidak dapat dipulihkan; isinya diunggah ulang oleh UPT.
- Tidak ada migrasi basis data.
