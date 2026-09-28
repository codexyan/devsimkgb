# ADR-022: Formulir pengumpulan data sebagai kegiatan berbasis template

Tanggal: 28 September 2026
Status: berlaku

## Konteks

Formulir inventarisasi KGB (`/inventarisasi-kgb`) dibangun untuk satu keperluan: pegawai Kanwil. Pengaturannya
satu (kode akses dan waktu tutup), kirimannya satu tempat di R2, dan isiannya khusus Kanwil. Pemilik ingin Super
Admin dapat membuat formulir lain, misalnya meminta data yang sama atau berbeda kepada pegawai UPT, tanpa
pembangunan ulang setiap kali.

## Keputusan (pemilik, 28 September 2026)

1. **Kegiatan berbasis template**, bukan pembuat formulir bebas. Super Admin membuat kegiatan dengan nama,
   template, sasaran satker, kode akses, dan waktu tutup. Isian tiap template ditulis di kode, sehingga
   pemeriksaan KGB (NIP dan tanggal lahir, kenaikan pangkat/PI, PMK) tetap berlaku dan datanya rapi.
2. **Template pertama**: *Inventarisasi KGB pegawai Kanwil* (formulir yang berjalan) dan *Inventarisasi KGB
   pegawai UPT* (isian sama, ditambah satker yang wajib dipilih dari sasaran kegiatan). Template lain, misalnya
   data pegawai di luar KGB, ditambahkan di `lib/kegiatanInventaris.ts` setelah daftar isiannya disepakati.
3. **Pengisi UPT adalah pegawai UPT sendiri lewat tautan publik** dengan kode akses kegiatan, sama dengan Kanwil.
   Kiriman, rekap, dan ZIP dikelompokkan per satker.
4. **Kelanjutan formulir yang berjalan.** Kegiatan "kanwil" memakai tautan `/inventarisasi-kgb` dan letak kiriman
   lama di R2 (`inventaris/<NIP>/`). Selama `inventaris/_kegiatan.json` belum ada, kegiatan itu dibentuk dari
   pengaturan lama (`inventaris/_konfigurasi.json`). Kegiatan lain memakai `/inventarisasi-kgb/<id>` dan
   `inventaris/k/<id>/<NIP>/`.
5. Kiriman publik membawa kegiatannya pada `?kegiatan=`, sehingga formulir yang ditutup ditolak sebelum isinya
   dibaca. Pembatas percobaan kode salah di `worker-entry.js` tetap berlaku karena path-nya tidak berubah.

## Akibat

- Tidak ada migrasi basis data; pengaturan dan kiriman tetap di R2.
- Kiriman ulang dari NIP yang sama menggantikan kiriman sebelumnya **di kegiatan yang sama**; di kegiatan lain
  kirimannya terpisah.
- Menu Inventarisasi di dashboard memilih kegiatan; Tim SDM KGB melihat dan mengunduh, Super Admin juga
  mengatur dan membuat kegiatan.
