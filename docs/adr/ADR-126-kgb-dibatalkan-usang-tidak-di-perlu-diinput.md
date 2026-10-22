# ADR-126: KGB dibatalkan yang jadwalnya sudah maju tidak lagi menampilkan pegawai di Perlu diinput

## Konteks
Aris Noviansyah (TMT KGB berikutnya 1 Des 2027) tampil di papan Perlu diinput. Riwayatnya memuat arsip KGB Des 2025 dan
KGB Des 2026 berstatus Dibatalkan, yang dibatalkan sesudah arsip memajukan jadwal. `pilihKgbSiklus` memilih record dengan
TMT di tahun berjalan bila jendela TMT pegawai belum dibuka, sehingga record batal itu menjadi siklus berjalan. Karena
record ada, kartu tidak terkunci dan jatuh ke "lewat" atau "siap".

## Keputusan
Pada cabang jendela belum dibuka, record `ditolak` hanya dipilih bila TMT-nya sama dengan TMT KGB berikutnya pegawai.
Record batal yang jadwalnya sudah maju diabaikan, sehingga pegawai masuk Belum dibuka. Record `selesai` tahun ini tetap
tampil (ADR-052).

## Dampak
Hanya tampilan papan dan rekap pipeline; data, hitungan, dan riwayat tidak berubah. Dibatalkan yang masih menjadi jadwal
pegawai tetap tampil seperti sebelumnya. Diuji di `lib/rekapKgb.test.ts`.
