# ADR-082: Papan Alur KGB UPT tanpa bolak-balik

Tanggal: 7 Oktober 2026
Status: berlaku. Melengkapi ADR-077 (review SK oleh UPT) dan ADR-079 (kolom Periksa SK).

## Konteks

Pengguna bertanya apakah papan Alur KGB Admin UPT terlalu bolak-balik. Jalur satu KGB (tanpa revisi) ternyata:
Perlu dikerjakan → Di Kanwil (usulan ditinjau) → **Perlu dikerjakan lagi** → Di Kanwil (SK dibuat) → Periksa SK →
Di Kanwil (menunggu TTE) → SK terbit → Selesai: tujuh perpindahan, tiga di antaranya mundur, dengan empat tindakan UPT.

1. **Bug**: "Perlu diperiksa" (`perluDiperiksa`, `app/api/upt/route.ts`) tidak melihat konfirmasi UPT. Setelah usulan
   disetujui (yang mencatat konfirmasi siklus itu), kartu kembali ke Perlu dikerjakan sampai Kanwil menginput KGB-nya,
   sehingga UPT bisa mengusulkan ulang tanpa perlu (kasus Hendra Irawan, 7 Oktober). Pegawai yang terlambat diinput
   Kanwil malah hilang dari papan.
2. **SK diperiksa dua kali**: UPT melihat hitungan SK saat mengajukan (Pratinjau SK, ADR-078), lalu diminta memeriksa SK
   yang sama lagi setelah Kanwil membuatnya (ADR-077).
3. **Kartu tampak mundur**: Periksa SK berada di antara dua tahap Kanwil.

Pilihan pengguna: review hanya bila SK berbeda dari usulan; penanda tahap pada kartu.

## Keputusan

1. **Perlu diperiksa** tidak muncul bila konfirmasi UPT siklus itu berlaku. Pegawai yang usulannya sudah disetujui dan
   KGB-nya belum diinput Kanwil tampil di **Di Kanwil** sebagai *Data disetujui, menunggu Kanwil memproses KGB* (atau
   *Lewat batas input Kanwil*).
2. **Review SK hanya bila berbeda** (`lib/sesuaiUsulan.ts`, `lib/sesuaiUsulanServer.ts`): saat Kanwil membuat SK pegawai
   UPT, isinya dibandingkan dengan hitungan dari usulan yang disetujui untuk siklus itu (konfirmasi berasal dari usulan,
   TMT sama): golongan, masa kerja, gaji pokok lama dan baru, TMT, dan nomor Atas dasar SK. Bila sama, review tercatat
   berstatus baru **`sesuai`** ("Sesuai usulan UPT, siap cetak"; boleh dicetak dan diunggah TTE seperti `disetujui`),
   tanpa lonceng ke UPT. Bila berbeda, atau hitungan usulan tidak dapat disusun ulang, review diminta seperti biasa dan
   jendela Periksa SK menyebut perbedaannya. SK yang dibuat ulang dinilai ulang.
3. **Garis tahap pada kartu** (`TAHAP_KGB_UPT`, `indeksTahap`, `lib/papanUpt.ts`): Usulan · Disetujui · SK dibuat ·
   Diperiksa · TTE · Direkam. Kolom papan tetap; kartu yang kembali ke Di Kanwil sesudah Periksa SK terbaca berada di
   tahap TTE.

## Akibat

- Jalur normal menjadi Perlu dikerjakan → Di Kanwil → SK terbit → Selesai: tiga perpindahan tanpa mundur, tiga tindakan
  UPT. Periksa SK hanya untuk SK yang berbeda dari usulan.
- Super Admin tetap dapat melewati review (`dilewati`); Kanwil tetap melihat status review di Proses KGB.
- Tidak ada migrasi: kolom `status` review berupa teks bebas.
