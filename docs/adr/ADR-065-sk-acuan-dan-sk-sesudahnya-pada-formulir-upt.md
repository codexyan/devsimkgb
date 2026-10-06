# ADR-065: SK acuan dan SK sesudahnya pada formulir UPT

Tanggal: 6 Oktober 2026
Status: berlaku

## Konteks

ADR-062 menetapkan bahwa Atas dasar SK KGB adalah SK penetap gaji yang paling baru: SK KGB, SK kenaikan pangkat
(termasuk penyesuaian ijazah), atau SK PMK. Formulir Admin UPT belum mengikuti aturan itu:

- Isian "Nomor SK dasar gaji pokok" di formulir perorangan meminta "SK KGB terakhir, atau SK kenaikan pangkat bila
  itu yang terakhir". Nomor SK KP lalu tercatat sebagai SK KGB terakhir, lengkap dengan TMT KGB-nya, sehingga
  linimasa dan Atas dasar keliru.
- Usulan pegawai baru yang menyebut SK kenaikan pangkat atau PMK mengabaikan SK itu tanpa pemberitahuan saat disetujui.
  Dasar KGB pertamanya di SIM-KGB tetap SK KGB lama.
- Templat Excel meminta UPT memotong sendiri masa kerja pegawai baru yang naik dari golongan II ke III (5 tahun) atau
  dari I ke II (6 tahun). Untuk PMK, UPT harus menghitung mundur masa kerjanya ke TMT KGB terakhir. Keduanya rawan salah.
- Laporan SK baru diminta bila golongan atau masa kerja berubah. UPT yang lupa melaporkan SK kenaikan pangkat tidak
  ditanya apa pun, dan Atas dasarnya keliru tanpa ada yang tahu.
- Tombol "Simpan data" memberi kesan Data Pegawai langsung berubah, padahal yang tersimpan adalah draf usulan.

Pengguna memilih keempat keputusan di bawah dari pilihan logika yang diajukan.

## Keputusan

1. **SK KGB terakhir tetap acuan, SK sesudahnya dilaporkan terpisah.**
   - Isian nomor, tanggal, dan TMT di kedua formulir UPT selalu SK KGB terakhir, atau SK CPNS bila belum pernah KGB.
     SK inilah acuan jadwal KGB.
   - SK kenaikan pangkat, penyesuaian ijazah, atau PMK yang terbit sesudahnya dilaporkan di bagian tersendiri.
2. **Pertanyaan wajib untuk tiap pegawai:** "Sesudah SK KGB terakhir, ada SK kenaikan pangkat, penyesuaian ijazah,
   atau PMK yang belum tercatat?"
   - Jawabannya disimpan di `dasarBaruJenis` tanpa kolom baru:
     - `tidak`: tidak ada SK;
     - `kp` atau `pmk`: ada SK;
     - `koreksi`: tidak ada SK, tetapi data tercatat salah ketik.
   - Kosong berarti belum dijawab. Usulan yang belum dijawab tetap boleh disimpan sebagai draf, tetapi tidak dapat
     diajukan (`kekuranganUsulan`). Ini juga berlaku untuk draf lama dan baris unggahan Excel.
   - Templat Excel menerima `tidak` pada kolom itu, dan contoh serta panduannya diisi demikian.
3. **Pratinjau Atas dasar.** Kedua formulir menampilkan SK yang akan menjadi Atas dasar SK KGB berikutnya
   (`pratinjauAtasDasarUsulan`). Calonnya ada tiga:
   - SK acuan pada isian;
   - SK yang dilaporkan;
   - dasar yang sudah tercatat (`dasarKgbBerikutnya`).

   Pratinjau memilih SK dengan TMT paling baru. Bila TMT-nya sama, urutannya:
   - SK kenaikan pangkat atau PMK didahulukan atas SK KGB;
   - di antara jenis yang sama, isian usulan didahulukan atas catatan, sebab persetujuannya akan menggantikan catatan
     itu.
4. **Pegawai baru menyalin dari SK terbaru, lalu sistem menghitung** (`hitungSkPegawaiBaru`).
   - Golongan dan masa kerja golongan disalin apa adanya dari SK yang dilaporkan, yaitu masa kerja pada TMT SK itu,
     termasuk potongan yang sudah tertulis di SK.
   - Sistem menghitung mundur masa kerja itu ke TMT KGB terakhir, dikurangi selang antara keduanya.
   - Gaji pokok dan jadwal mengikuti hitungan pegawai lama: kenaikan pangkat tidak menggeser jadwal, sedangkan PMK
     menghitung KGB berikutnya dari TMT PMK.
   - Saat disetujui, pegawai dibuat dengan hasil hitungan itu, dan SK-nya dicatat sebagai riwayat kenaikan pangkat atau
     PMK. Sisi lama riwayat sama dengan sisi barunya, karena keadaan sebelum SK tidak dilaporkan.
   - Hitungan yang sama dipakai di formulir, saat draf disimpan (`isiHitungan`), di tinjauan Kanwil, dan saat persetujuan.
5. **Isian yang belum cocok ditahan**, di formulir maupun di server. Draf tetap tersimpan, tetapi belum dapat
   diajukan bila:
   - laporan kenaikan pangkat pada pegawai tercatat tidak disertai golongan baru;
   - laporan PMK tidak disertai masa kerja menurut SK;
   - pada pegawai baru, TMT SK yang dilaporkan lebih awal dari TMT KGB terakhir;
   - pada pegawai baru, masa kerja pada SK lebih kecil dari selang sejak TMT KGB terakhir.

   Pindaian SK PMK kini juga ditagih di Usulan kolektif.
6. **Tombol "Simpan draf usulan"** di kedua formulir, dengan catatan bahwa Data Pegawai baru berubah setelah usulannya
   disetujui Kanwil.

## Akibat

- Pegawai yang sudah tercatat tidak berubah perlakuannya: kenaikan pangkat dan PMK tetap dihitung dari data tercatat
  (ADR-030).
- Draf yang sudah ada di produksi perlu dijawab satu klik per pegawai sebelum diajukan. Usulan yang sudah menunggu
  tinjauan tidak terpengaruh.
- Kartu "Laporkan kenaikan pangkat/PMK" menggantikan jawaban `tidak` pada draf tanpa peringatan.
- Peninjau Kanwil melihat masa kerja pada SK pegawai baru beserta hasil hitung mundurnya.
- Batas yang diketahui: pegawai yang belum pernah KGB tetapi sudah menerima SK kenaikan pangkat atau PMK diarahkan
  memilih "Sudah pernah KGB", karena keadaan KGB masih diturunkan dari masa kerja (`pernahKgb`).
