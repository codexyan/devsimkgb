# ADR-008: Mutasi dan pemberhentian pegawai dicatat, bukan ditimpa

Tanggal: 24 September 2026
Status: berlaku

## Konteks

Sampai kini SIM-KGB hanya mengenal pegawai yang ada dan pegawai yang dihapus. Perpindahan dicatat
dengan mengubah Unit Kerja begitu saja: tanpa tanggal berlaku, tanpa nomor SK, dan tanpa jejak bahwa
perpindahan itu pernah terjadi. Pegawai yang berhenti hanya dapat dihapus, dan penghapusan membuang
riwayat KGB-nya sekaligus.

Dua keadaan nyata memperlihatkan bahwa itu tidak cukup.

**BKO berbeda dari mutasi definitif pada hal yang menentukan uang.** Pegawai BKO bekerja di satker
lain, tetapi gajinya tetap dibayar satker asal. Karena SK kenaikan gaji berkala ditujukan ke KPPN mitra
satker yang membayar, memperlakukan BKO seperti mutasi definitif berarti SK dikirim ke kantor bayar
yang keliru.

**Pemberhentian punya tanggal berlaku.** Pegawai yang pensiun 1 November 2026 tetap berhak atas KGB
yang TMT-nya 1 Oktober 2026. Menghapus pegawainya, atau menandainya tidak aktif begitu saja, menghapus
hak yang sudah timbul.

## Keputusan

### 1. Peristiwanya yang dicatat, bukan keadaannya saja

Tabel `riwayat_mutasi` menyimpan tiap perpindahan dan pemberhentian beserta jenis, satker asal dan
tujuan, TMT, nomor dan tanggal SK, serta alasannya. Data pegawai hanya menyimpan keadaan yang berlaku
sekarang: `satker_tugas` untuk penugasan BKO, `berhenti_tmt` dan `berhenti_alasan` untuk pemberhentian.
Pegawai tidak pernah dihapus.

### 2. BKO tidak mengubah unit kerja

Mutasi definitif memindahkan `unit_kerja`, sehingga KGB berikutnya, SK, dan KPPN tujuannya ikut
berpindah. BKO hanya menulis `satker_tugas` sebagai keterangan; unit kerja, KGB, dan KPPN tetap di
satker asal, sesuai kenyataan siapa yang membayar gajinya. Satker tempat bertugas tampil sebagai
keterangan pada daftar dan kartu papan.

### 3. Hak KGB ditentukan tanggal, bukan status

`berhakKgb()` membandingkan TMT KGB dengan tanggal berhenti: KGB yang TMT-nya jatuh sebelum pegawai
berhenti tetap sah diproses, KGB sesudahnya tidak. Antrian kerja dan dasbor UPT memakai aturan yang
sama, dan hitungan "pegawai aktif" tidak lagi menghitung pegawai yang sudah berhenti.

### 4. Kanwil yang mencatat

Hanya Super Admin dan Tim SDM KGB yang boleh mencatat mutasi dan pemberhentian, lewat
`POST /api/pegawai/[id]/mutasi`. UPT tidak diberi kewenangan ini: perpindahan dan pemberhentian selalu
berdasar SK yang diterbitkan di luar UPT, dan data induk tetap satu pintu.

## Akibat

- Pertanyaan "sejak kapan dan dengan SK apa" kini terjawab dari aplikasi, bukan dari ingatan.
- Pegawai yang berhenti hilang dari antrian KGB tanpa kehilangan riwayatnya, dan KGB yang menjadi
  haknya tetap dapat diproses.
- Menghapus pegawai tetap ada sebagai tindakan terpisah, tetapi tidak lagi menjadi satu-satunya cara
  menyatakan seseorang berhenti.
