# ADR-007: UPT menginventarisir data pegawainya dan mengusulkannya ke Kanwil

**Status:** Diterima
**Tanggal:** 23 September 2026
**Penentu:** Pemilik SIM-KGB bersama tim keuangan Kanwil
**Cakupan:** tabel `usulan_pegawai`, `lib/usulanPegawai.ts`, `lib/konfirmasiUpt.ts`,
`lib/pemeriksaanUlangKgb.ts`, API `/api/upt/usulan`, `/api/upt/konfirmasi`, `/api/usulan`,
halaman `/dashboard/usulan`, dashboard Admin UPT, dan bagian panduan untuk UPT

## Konteks

Tim keuangan mengingatkan satu hal yang tidak tertangani: UPT harus benar-benar memastikan masa kerja
golongan dan status hukuman disiplin pegawainya, karena salah data berujung pada kekurangan gaji atau,
yang lebih berat, kelebihan gaji yang harus disetor kembali ke kas negara. Asimetrinya nyata: rapel
diselesaikan dengan SPM-LS kekurangan gaji, sedangkan kelebihan bayar menjadi temuan pemeriksaan.

Dua celah ditemukan saat menelusuri kode:

1. **Hukuman disiplin hanya diperiksa sekali**, yaitu saat Input KGB (`app/api/kgb/route.ts`). Jarak input
   ke TMT sekitar dua bulan, dan hukuman disiplin yang terbit di sela itu lolos tanpa peringatan sampai
   SK terbit. Status aktif pegawai juga tidak diperiksa ulang.
2. **Dokumen aslinya dipegang UPT, tetapi yang mengetik datanya Kanwil.** Pengetikan ganda inilah sumber
   salah masa kerja golongan yang dikhawatirkan tim keuangan.

ADR-004 menetapkan Admin UPT sebagai peran lihat-saja. Keputusan ini mengubahnya secara terbatas.

## Keputusan

### 1. Pemeriksaan ulang pada dua pintu terakhir

`lib/pemeriksaanUlangKgb.ts` memeriksa hukuman disiplin yang menunda KGB dan status aktif pegawai saat
**Buat SK** dan saat **Konfirmasi keuangan**, bukan hanya saat Input KGB. Bila tidak lolos, permintaan
ditolak dengan 409 beserta langkah perbaikannya. Ditambah notifikasi **KGB perlu ditinjau** untuk KGB
berjalan yang keadaan pegawainya berubah, agar Tim SDM tahu sebelum menabrak penolakan itu.

### 2. Konfirmasi data per siklus oleh UPT

Admin UPT menyatakan bahwa masa kerja golongan, gaji pokok dasar, dan status hukuman disiplin sudah benar
untuk satu siklus KGB. Yang disimpan adalah TMT yang dikonfirmasi (`konfirmasi_upt_tmt`), bukan sekadar
penanda, sehingga konfirmasi kedaluwarsa sendiri saat pegawai masuk siklus berikutnya. Statusnya terlihat
Tim SDM pada kartu antrian KGB.

Konfirmasi ini **tidak menghalangi** pembuatan SK. Dari 18 UPT belum semuanya punya akun, dan memblokir
proses karena alasan administratif akan membuat KGB terlambat, yang justru menimbulkan rapel.

### 3. Usulan data pegawai dari UPT

UPT mengisi data pegawainya sendiri dan mengirimkannya sebagai **usulan**; Kanwil yang menerapkannya.
Polanya mengikuti `ProfileChangeRequest` yang sudah ada di aplikasi ini.

- **Cakupan:** biodata lengkap, data KGB (golongan, masa kerja golongan, gaji pokok, TMT), nomor dan
  tanggal SK terakhir sebagai dasarnya, serta laporan hukuman disiplin. Mengusulkan pegawai baru semula
  tidak termasuk; ini berubah pada hari yang sama, lihat perluasan di bawah.
- **Peninjau:** Super Admin dan Tim SDM KGB (`canProcessKGB`), karena merekalah yang memakai datanya.
- **Surat Srikandi:** nomor dan tanggalnya wajib, salinan PDF-nya diunggah (paling besar 1 MB, disimpan di
  R2 dengan awalan `usulan/`). Berkas hanya dapat dibuka peninjau Kanwil dan UPT pengusulnya.
- **Kolom kosong berarti tidak diusulkan berubah.** Angka nol tetap nilai yang sah, karena masa kerja
  golongan 0 tahun 0 bulan adalah keadaan nyata pegawai yang belum pernah KGB.
- **Satu usulan menunggu per pegawai**, agar antrian tinjauan tidak berisi dua versi yang saling menimpa.
- **Laporan hukuman disiplin tidak otomatis menjadi catatan hukdis.** Penetapannya tetap pada SDM Hukdis
  lewat modul Hukuman Disiplin, karena butuh nomor SK dan penilaian dampaknya pada KGB. Halaman tinjauan
  menyatakan ini secara terbuka kepada peninjau.

### 4. Jadwal surat usulan digeser ke bulan kedua sebelum TMT

Sebelumnya surat dikirim pada bulan ketiga sebelum TMT. Yang mengikat sebenarnya bukan bulan suratnya,
melainkan kunci gaji induk: SPM gaji bulan M paling lambat tanggal 15 bulan M-1 (PMK 62/2023 Pasal 225).
Surat kini dikirim tanggal 1 sampai 10 bulan kedua sebelum TMT, bulan yang sama dengan dibukanya input di
SIM-KGB, sehingga tetap selesai sebelum rekon gaji, tanpa memaksa UPT berpikir tiga bulan ke depan.

Memindahkan seluruh proses ke bulan TMT, seperti sempat diusulkan, ditolak: SK yang diteken akhir bulan TMT
melewatkan gaji induk bulan itu dan bulan berikutnya, sehingga setiap KGB menjadi rapel dua bulan.

### 5. Admin UPT mengganti passwordnya sendiri

Sudah didukung `/api/profile` sejak awal, tetapi tidak ada jalan masuknya karena menu Admin UPT hanya
berisi Dashboard. Menu **Profil Saya** ditambahkan.

## Akibat

- Peran Admin UPT tidak lagi murni lihat-saja: ada tiga penulisan yang diizinkan: konfirmasi data,
  usulan data, dan ganti password sendiri. Ketiganya tidak mengubah data induk secara langsung, kecuali
  password akunnya sendiri.
- Data induk berubah lewat dua jalur: Tim SDM langsung, dan persetujuan usulan UPT. Keduanya tercatat di
  log aktivitas dengan rincian kolom yang berubah.
- Hukuman disiplin tetap tidak terbaca UPT. Yang dikirim ke UPT hanya penanda "KGB ditunda", sesuai
  ADR-004; laporan yang mereka kirim sendiri boleh mereka lihat kembali di daftar usulan.

## Perluasan 23 September 2026: pegawai baru, berkas dasar, dan Gaji Web satker

Setelah alur di atas dipakai untuk kasus nyata (CPNS Rutan Rantau yang baru dilantik), pemilik
menunjukkan tiga hal yang belum tertangani.

### 1. UPT mengusulkan pegawai yang belum tercatat

Usulan semula hanya dapat mengoreksi pegawai yang sudah ada, padahal kasus yang paling butuh jalur ini
justru pegawai yang belum masuk SIM-KGB sama sekali. `usulan_pegawai` kini punya kolom `jenis`
("perubahan" atau "baru"), `pegawai_id` boleh kosong, dan `nip` serta `unit_kerja` diisi pada usulan
baru. Menyetujui usulan "baru" membuat data pegawainya, dengan gaji pokok dihitung dari tabel PP 5/2024
bila UPT tidak mengisinya, sama dengan impor CSV. NIP diperiksa ulang saat persetujuan, karena Kanwil
bisa saja sudah menambahkan pegawai itu sendiri sejak usulan dikirim.

Mengusulkan pegawai baru tidak berarti UPT menulis ke data induk: yang membuat tetap Kanwil, lewat
persetujuan.

### 2. Empat berkas dasar, bukan satu

Tim keuangan meminta dokumen dasarnya ikut, agar masa kerja golongan dapat dicocokkan dengan sumbernya:
surat usulan Srikandi, SK KGB terakhir, syarat pengangkatan PNS (untuk kasus CPNS yang baru dilantik),
dan SK kenaikan pangkat terakhir (karena memotong masa kerja golongan). Keempatnya disimpan di R2 dengan
awalan `usulan/` dan hanya dapat dibuka peninjau Kanwil serta UPT pengusulnya.

### 3. Yang merekam di Gaji Web berbeda antara Kanwil dan UPT

Ini koreksi domain yang paling menentukan. Aplikasi semula memodelkan satu langkah keuangan: keuangan
Kanwil mengonfirmasi SK lalu merekamnya di Gaji Web. Itu benar untuk pegawai Kanwil, tetapi **tiap UPT
adalah satker tersendiri dengan DIPA dan operator gajinya sendiri**.

| | Pegawai Kanwil | Pegawai UPT |
| --- | --- | --- |
| Pemeriksa SK | Keuangan Kanwil | Keuangan Kanwil (kroscek) |
| Perekam di Gaji Web | Keuangan Kanwil | Operator gaji UPT |
| Arti status "selesai" | Sudah direkam di Gaji Web | SK sudah dikirim kembali ke UPT |

Tanggalnya tidak berbeda: kunci SPM gaji induk tanggal 15 bulan M-1 (PMK 62/2023 Pasal 225) berlaku sama
untuk semua satker. Yang berbeda hanya pelakunya.

Kolom `input_gaji_web_at` dan `input_gaji_web_by` pada `riwayat_kgb` sudah ada sejak awal dan dipakai apa
adanya: untuk pegawai UPT diisi lewat `POST /api/upt/gaji-web` oleh akun Admin UPT satker itu, setelah
KGB berstatus selesai. Ini penulisan keempat yang diizinkan peran admin_upt.

## Akibat tambahan

- Peran Admin UPT punya empat penulisan: konfirmasi data, usulan data (termasuk pegawai baru),
  penandaan Gaji Web, dan ganti password sendiri.
- Akun Admin UPT untuk ke-18 UPT dibuat 23 September 2026 dengan identitas sementara: nama
  "Admin <nama satker>" dan NIP penanda berawalan 9 yang tidak mungkin menjadi NIP asli. Identitas
  operator sebenarnya menggantikannya setelah tersedia; sampai saat itu jejak audit menunjuk nama generik.

## Perluasan 23 September 2026 (lanjutan): draf, pembatalan, dan notifikasi seketika

Dipakai langsung oleh operator UPT pertama, tiga hal terasa kurang.

### 1. Isian yang belum lengkap dapat disimpan sebagai draf

Formulir usulan panjang dan datanya disalin dari SK yang tidak selalu ada di meja. Isiannya kini disimpan
otomatis sambil diketik, dan ada tombol **Simpan dulu** yang menutup formulir tanpa mengirim. Draf
disimpan di peramban operator (`lib/drafUsulan.ts`), bukan di server: isian setengah jadi belum menjadi
dokumen usulan, dan menyimpannya di Kanwil akan membuat antrian tinjauan berisi usulan yang tidak jelas
boleh diproses atau tidak.

Konsekuensinya disebutkan di layar: draf hanya ada di peramban dan perangkat yang dipakai mengetik, dan
berkas PDF tidak ikut tersimpan karena peramban tidak mengizinkan berkas dibaca ulang tanpa dipilih
pengguna. Draf yang lebih tua dari 30 hari dibuang karena datanya kemungkinan sudah berubah di Kanwil.

### 2. Usulan yang telanjur salah dibatalkan, bukan disunting

`DELETE /api/upt/usulan/[id]` menghapus usulan yang **belum ditinjau**, beserta berkas yang sudah
diunggah dan notifikasinya di Kanwil. UPT lalu mengirim ulang setelah datanya benar. Penyuntingan di
tempat sengaja tidak disediakan: antrian tinjauan Kanwil tidak boleh berisi dua versi usulan untuk
pegawai yang sama, dan peninjau harus melihat persis apa yang dikirim UPT. Usulan yang sudah ditinjau
tidak dapat ditarik kembali, karena hasilnya sudah menjadi riwayat dan, bila disetujui, sudah menempel
pada data pegawai.

### 3. Notifikasi dibuat saat usulan masuk

Semula notifikasi usulan hanya lahir dari pemeriksaan berkala, sehingga Tim SDM tidak melihat apa pun
sampai pemeriksaan itu berjalan. Sejak perbaikan CPU halaman publik, pemeriksaan itu tidak lagi ikut
pada setiap pembacaan notifikasi, jadi jeda tersebut menjadi nyata. `POST /api/upt/usulan` kini membuat
notifikasinya sendiri lewat `notifikasiUsulanUpt()`. Pemeriksaan berkala tetap ada sebagai jaring
pengaman dan memakai pembentuk yang sama, sehingga tidak ada notifikasi ganda dan isinya seragam.
Notifikasi untuk usulan pegawai baru berbunyi berbeda, karena pegawainya memang belum ada di data induk.

## Perluasan 23 September 2026 (lanjutan kedua): data dulu, ajukan kemudian

Pemakaian pertama menunjukkan formulir usulan mengerjakan tiga hal sekaligus (data pegawai, surat
usulan, dan berkas pendukung), padahal ketiganya berbeda sifat. Akibatnya terlihat pada surat Rutan
Rantau 8 September 2026 yang memuat lima pegawai: operator harus mengetik nomor surat yang sama lima
kali dan mengunggah surat yang sama lima kali, dan datanya tidak bisa disicil.

### 1. Draf disimpan di server, bukan di peramban

Draf yang sempat disimpan di peramban diganti draf berstatus `draf` pada tabel `usulan_pegawai`.
Alasannya dua. Draf peramban hilang begitu operator berpindah perangkat, padahal pendataan berlangsung
berhari-hari. Dan dua macam draf, satu di peramban dan satu di server, justru menambah kebingungan yang
hendak dihilangkan. Status `draf` tidak pernah masuk antrian tinjauan Kanwil maupun notifikasinya, dan
boleh disunting (`PATCH /api/upt/usulan/[id]`) atau dihapus sesuka UPT.

### 2. Satu surat usulan untuk beberapa pegawai

`POST /api/upt/usulan/ajukan` menerima beberapa id draf beserta satu nomor surat, tanggal, dan satu
salinan PDF, lalu mengubah semuanya menjadi `menunggu`. Kelengkapan tiap draf diperiksa lebih dulu
lewat `kekuranganUsulan()`, dan yang kurang disebutkan satu per satu sebelum apa pun disimpan, supaya
tidak ada pengajuan yang separuh terkirim.

### 3. Gaji pokok dan jatuh tempo tidak lagi diketik operator

Pangkat, gaji pokok, dan TMT KGB berikutnya dihitung `hitungUsulan()` dari golongan, masa kerja
golongan, dan TMT KGB terakhir, lalu ditampilkan sebagai hasil hitungan beserta kalimat yang
menerangkan asalnya. Rute API menghitung ulang nilai itu sendiri (`isiHitungan()`), jadi angka yang
tersimpan tidak pernah bergantung pada apa yang dikirim peramban.

Dua jebakan yang dulu diam kini bersuara. Golongan II/a naik ke MKG 1 setelah **12 bulan**, bukan 24
seperti golongan lain, sehingga KGB pertama CPNS II/a jatuh setahun setelah TMT CPNS. Dan kombinasi
yang tidak ada barisnya di tabel, misalnya II/c dengan masa kerja 0 tahun, dulu menghasilkan gaji
pokok nol tanpa peringatan; sekarang ditahan sebagai kekurangan yang harus diperbaiki sebelum diajukan.

Formulirnya juga menanyakan keadaan pegawai lebih dulu: belum pernah KGB, atau sudah. Yang belum cukup
mengisi TMT CPNS dengan masa kerja 0, disertai peringatan agar tidak menyalin masa kerja dari SK
pengangkatan PNS yang terbit terlambat: SK semacam itu sudah memuat KGB yang justru sedang diusulkan,
dan menyalinnya berarti menghapus rapelan yang menjadi hak pegawai.

### 4. Batas berkas 1 MB

Batas per berkas diturunkan dari 5 MB menjadi 1 MB. Satu lembar SK yang dipindai sebagai dokumen
berukuran ratusan kilobyte; yang melampaui satu megabyte hampir selalu foto kamera beresolusi penuh.
Operator UPT mengunggah lewat data seluler, dan unggahan besar yang putus di tengah jalan lebih
menyakitkan daripada ditolak sejak awal, karena itu pesan penolakannya menyebutkan cara memperkecil.

### 5. Aturan hitungan yang sama berlaku di sisi Kanwil

Setelah formulir UPT berhenti meminta gaji pokok dan jatuh tempo diketik, sisi Kanwil menjadi ganjil:
formulir Data Pegawai dan impor CSV masih menuntut TMT KGB berikutnya diketik tangan. Justru di situ
kekeliruan yang menimpa lima pegawai Rutan Rantau bisa terulang, sebab selang KGB tidak selalu dua
tahun dan yang mengetik biasanya mengingat "dua tahun".

Sekarang `bacaIsianPegawai()` menghitung TMT KGB berikutnya dari golongan, masa kerja golongan, dan TMT
KGB terakhir bila kolomnya dikosongkan; formulir Data Pegawai mengisikannya sendiri begitu ketiganya
berubah; dan impor CSV memperlakukan kolom itu sebagai opsional, headernya tetap ada demi bentuk
template yang sama. Nilai yang memang diisi tetap dihormati, karena ada kasus yang bergeser: penundaan
KGB akibat hukuman disiplin.

Formulir Google untuk inventarisasi pegawai Kanwil ikut disesuaikan: pertanyaan TMT KGB berikutnya
dihapus, sebab jawabannya lebih dipercaya dihitung daripada diingat.

### 6. Tanda pisah panjang tidak dipakai lagi

Seluruh teks antarmuka, dokumen, dan komentar tidak lagi memakai tanda pisah panjang. Penggantinya
tanda baca biasa: titik dua untuk keterangan, koma atau titik koma untuk sisipan, titik tengah untuk
pemisah pada satu baris pilihan, dan tanda hubung tunggal untuk nilai yang kosong.

### 7. Kanwil mengembalikan usulan, tidak lagi menolaknya

Peninjau semula punya dua vonis: setujui atau tolak. Praktiknya, hampir setiap penolakan berpangkal
pada hal yang kecil, misalnya gaji pokok yang tidak cocok dengan SK yang dilampirkan. Tetapi usulan
yang ditolak menjadi riwayat mati: UPT harus menyusun ulang dari nol, mengetik seluruh isian sekali
lagi, dan mengunggah ulang setiap pindaian SK. Hukuman yang tidak sepadan dengan satu salah ketik.

Sejak sekarang vonisnya tetap dua, tetapi yang kedua diganti: **Kembalikan untuk revisi**. Statusnya
menjadi `revisi`, isian dan berkasnya tidak disentuh, dan yang berpindah hanya siapa yang memegangnya.
Catatan peninjau wajib diisi dan itulah yang dibaca UPT, karena "belum sesuai" tidak memberi tahu apa
pun. Usulan yang dikembalikan tetap menutup pintu usulan baru untuk pegawai yang sama, sehingga antrian
tinjauan tidak pernah memuat dua versi orang yang sama.

Penolakan dihapus sama sekali, termasuk untuk usulan yang memang tidak boleh lanjut, misalnya
pegawainya sudah pindah satker atau usulannya kembar. Perkara itu pun dikembalikan, dengan catatan agar
UPT menghapusnya sendiri: UPT yang tahu duduk perkaranya, dan pegawainya baru bebas diusulkan lagi
setelah usulan yang menggantung ditutup. Status `ditolak` tetap dikenali agar usulan lama terbaca.

Pengiriman ulang memakai nomor surat yang lama, yang sudah terisi di dialog pengajuan dan masih boleh
diubah. Ralat kecil tidak sepatutnya menuntut nomor surat baru dari arsiparis.

Dua akibat sampingan ikut dibereskan. Pertama, tombol "Usulkan perbaikan data" dulu tetap hidup pada
pegawai yang usulannya sedang ditinjau; operator mengisi seluruh formulir dan baru ditolak pada langkah
terakhir. Tombol itu kini tidak ditawarkan selama usulannya di meja Kanwil. Kedua, notifikasi "usulan
menunggu tinjauan" tidak pernah ditutup setelah usulannya disetujui; sekarang ditutup pada saat
ditinjau, sebagaimana pada pembatalan oleh UPT.
