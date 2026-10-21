# ADR-119: Tampilkan masa kerja pada SK dasar di kartu KGB dan riwayat KP

Tanggal: 21 Oktober 2026
Status: berlaku

## Konteks

Sistem menyimpan masa kerja golongan (MKG) **pada TMT KGB terakhir**: pada Data Pegawai, pada riwayat kenaikan pangkat,
dan sebagai "masa kerja lama" pada KGB. SK kenaikan pangkat menulis MKG **pada TMT pangkatnya**, dan SK KGB mencetaknya
pada baris "Masa kerja golongan pada tanggal tersebut" (`mkgPadaSkDasar`, ADR-020).

Pada Naily Wardani keduanya berbeda: tersimpan 18 thn 0 bln (pada 1 Des 2024), SK KP menulis 18 thn 6 bln (pada 1 Jun
2025), dan KGB 1 Des 2026 menjadi 20 thn 0 bln. Kartu KGB hanya menampilkan 18/0, sehingga tampak tidak cocok dengan SK
dan membingungkan.

## Keputusan

1. **Kartu KGB di papan:** bila SK dasarnya KP atau PMK di tengah siklus, ditambah baris "Masa kerja pada SK dasar"
   (angka yang tercetak di SK KGB, dengan TMT SK-nya), dan "Masa kerja lama" diberi keterangan "(pada TMT KGB terakhir)".
   Tanpa SK dasar di tengah siklus, tampilannya tidak berubah.
2. **Tab Pangkat & PMK, baris kenaikan pangkat:** masa kerja diberi keterangan "pada TMT KGB terakhir pegawai". Bila TMT
   KGB terakhir pegawai lebih awal dari TMT pangkat, ditambah baris "menurut SK, pada TMT pangkat".
3. Tidak ada perubahan data, hitungan, maupun SK yang dicetak.

## Akibat

- Angka di kartu dan SK dapat dicocokkan langsung dengan SK kenaikan pangkat.
