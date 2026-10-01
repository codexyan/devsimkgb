# ADR-046: Laporan SK kenaikan pangkat dan PMK berangkat tanpa surat usulan, dan selesai dalam satu jendela

Tanggal: 1 Oktober 2026
Status: berlaku; menuntaskan alur ADR-044 dan ADR-045

## Konteks

Pemilik bertanya mengapa sesudah kartu SK disimpan masih harus ada langkah "usul perbaikan". Jawabannya
dua hal, dan hanya satu di antaranya yang memang perlu.

**Pertama, suratnya.** `POST /api/upt/usulan/ajukan` menolak tanpa nomor dan tanggal surat usulan
Srikandi; aturan dari ADR-015 dan ADR-024, satu surat untuk beberapa pegawai, satu pintu ke Kanwil.
Padahal SK kenaikan pangkat dan SK PMK **sudah terbit**: yang disampaikan UPT adalah kejadian yang sudah
selesai, bukan permohonan. Watak itu sama persis dengan laporan mutasi dan laporan hukuman disiplin, yang
sejak ADR-016 memang berangkat tanpa surat sama sekali.

**Kedua, berkasnya.** Perubahan yang menyentuh golongan atau masa kerja golongan selalu menuntut **SK KGB
terakhir** dan **SK kenaikan pangkat terakhir**, bukan hanya SK yang baru dilaporkan (ADR-030). Kartu
ADR-045 hanya mengumpulkan satu dari ketiganya, sehingga ia selalu berakhir sebagai draf yang masih harus
dilengkapi di tempat lain:

```
Draf dari kartu KP  → kekurangan: SK KGB terakhir, SK kenaikan pangkat terakhir
Draf dari kartu PMK → kekurangan: SK KGB terakhir, SK kenaikan pangkat terakhir,
                                  SK peninjauan masa kerja
```

Yang kedua itu bukan birokrasi yang menempel tanpa guna, di situlah buktinya dikumpulkan. Yang memang
cacat adalah kartunya tidak pernah bisa menuntaskan pekerjaannya walau tidak ada lagi yang kurang.

## Keputusan (pemilik, 1 Oktober 2026)

1. **Laporan SK tidak menumpang surat usulan.** Usulan yang perubahannya semata-mata akibat SK kenaikan
   pangkat atau SK PMK boleh diajukan tanpa nomor surat; SK beserta pindaiannya yang menjadi buktinya.
   Aturannya satu tempat, `laporanSkDasar` di `lib/dasarBaruUsulan.ts`: sebabnya "kp" atau "pmk", dan
   setiap kolom yang berubah termasuk kolom yang memang ditetapkan SK itu beserta kolom hitungannya.
2. **Kartu mengumpulkan seluruh berkas yang akan ditagih, lalu mengirim sendiri.** Satu jendela, selesai,
   tanpa mampir ke Usulan kolektif.

## Akibat

- **Tanpa migrasi basis data.** Kolom `nomor_surat` dan `tanggal_surat` memang sudah nullable; yang
  berubah hanya kapan keduanya diwajibkan.
- Pemeriksaan surat di rute pengajuan dipindahkan ke **sesudah** draf dan data pegawainya dimuat, sebab
  baru di situ ketahuan apa isi yang diajukan. Satu pengajuan membawa satu surat untuk seluruh barisnya,
  jadi suratnya hanya boleh ditiadakan bila **tidak ada satu pun** baris yang meminta hal lain; begitu ada,
  pesan tolaknya menyebutkan pengecualiannya sendiri.
- **Kelengkapan berkas tidak dilonggarkan sedikit pun.** Yang hilang hanya suratnya. Diuji pada tiga draf:
  draf PMK tanpa pindaian ditolak karena berkasnya, draf KP tanpa pindaian ditolak karena berkasnya, dan
  draf pegawai baru tanpa surat ditolak karena suratnya.
- Tombol **Kirim ke Kanwil** pada kartu baru menyala setelah seluruh berkas wajib terlampir; selama belum,
  kartunya menyebutkan apa yang kurang dan tetap menyediakan **Simpan draf**; pemindai yang sedang antre
  tidak boleh membuat isian yang sudah diketik hilang. Bila pengirimannya ditolak, drafnya tetap tersimpan
  dan pesan tolaknya disampaikan apa adanya.
- **Panel tinjauan Kanwil tidak diubah.** Nomor surat memang sudah ditampilkan hanya bila ada
  (`u.nomorSurat ? ...` di `app/dashboard/usulan/page.tsx`), dan tombol "setujui satu surat" hanya
  mengelompokkan usulan yang bernomor surat, sehingga laporan tanpa surat ditinjau satu per satu, yang
  memang semestinya.
- Notifikasi untuk Kanwil tidak lagi berbunyi "lewat surat -", melainkan "sebagai laporan SK, tanpa surat
  usulan". Catatan audit pun begitu.
- Diperiksa dari ujung ke ujung pada data lokal dengan Chrome headless, sebagai Admin UPT Rutan Rantau:
  kartu KP diisi, tombol Kirim mati selama dua pindaian belum dilampirkan, menyala sesudahnya, dan sekali
  klik menghasilkan usulan berstatus `menunggu` dengan `nomorSurat` kosong, golongan II/c → II/d, kedua
  pindaian tersimpan, dan sebab `kp · W.17-KP.03.01-512 · TMT 1 April 2026`.
- 443 uji lolos, termasuk dua uji baru untuk `laporanSkDasar`. `tsc --noEmit` dan ESLint bersih pada berkas
  yang disentuh.
