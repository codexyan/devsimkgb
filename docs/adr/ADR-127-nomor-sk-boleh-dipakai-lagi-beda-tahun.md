# ADR-127: Nomor SK yang sama boleh dipakai lagi pada tahun SK yang berbeda

## Konteks
Nomor SK dari arsiparis dimulai lagi dari awal setiap tahun. Buat SK menolak nomor `WP.19-SA.04.04-2158` karena sudah
dipakai SK KGB Aris Noviansyah, padahal SK itu bertanggal 20 Oktober 2025 dan SK yang dibuat bertanggal 22 Oktober 2026.

## Keputusan
`nomorSkBentrok` menerima tanggal SK baru. Nomor yang dipegang SK atau draf lain dengan tahun tanggal berbeda tidak lagi
dianggap bentrok. Bila tanggal baru atau tanggal pemegang nomor tidak diketahui, nomor tetap dianggap bentrok (perilaku
lama). Pemanggil: Buat SK (pratinjau dan buat) dan Simpan draf.

## Dampak
Hanya penjaga nomor ganda saat Buat SK. Data, hitungan, dan SK yang sudah ada tidak berubah. Diuji di
`lib/nomorSkBentrok.test.ts`.
