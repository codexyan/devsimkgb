# ADR-094: Batas kirim surat UPT tanggal 20 diatur di Pengaturan; input SIM-KGB sampai akhir bulan

Tanggal: 10 Oktober 2026
Status: berlaku. Mengubah jadwal ADR-029 (surat 1–10) dan nilai batas input Tim SDM (sebelumnya tanggal 20).

## Konteks

Di banyak UPT, orang yang sama membuat surat usulan KGB, mengurus SDM, dan merekonsiliasi gaji. Batas surat tanggal 10
pada bulan kedua sebelum TMT terlalu sempit. Pengguna meminta:
- surat UPT sampai tanggal **20**;
- input SIM-KGB oleh Kanwil sampai **akhir bulan**.

Sebelumnya batas surat adalah konstanta `KIRIM_SURAT_BATAS = 10`. Batas input sudah diatur di Pengaturan, dengan nilai
produksi 20.

## Keputusan

Pilihan pengguna: batas surat menjadi isian Pengaturan dengan bawaan 20, dan peringatan rapelan mengikuti batas baru.

1. **Kolom baru `batasKirimSurat`** di KonfigurasiKanwil (D1 `0004_batas_kirim_surat.sql`, Supabase
   `20261010090000_batas_kirim_surat.sql`):
   - kosong berarti bawaan 20;
   - diisi di Pengaturan → Jadwal proses KGB, di atas Batas input Tim SDM;
   - tidak boleh melewati batas input, sebab surat yang tiba sesudah input ditutup tidak sempat diinput. Server menolak
     simpanan seperti itu, dan `batasKirimSurat()` menjepitnya;
   - dijepit ke hari terakhir bulan.
2. **Migrasi D1 yang sama** menetapkan `batas_input_sdm = 31` (hari terakhir bulan) dan `batas_kirim_surat = 20`. Contoh
   untuk TMT 1 Desember 2026:

   | Tahap | Tanggal |
   | --- | --- |
   | Surat UPT | 1–20 Oktober |
   | Input SIM-KGB | 1–31 Oktober |
   | Rekon Gaji Web | 1–15 November |

3. **Nilai berlaku dimuat** lewat jalur yang sama dengan batas input: `muatBatasInputSdm()` di server dan
   `DashboardShell` di peramban. Pemakainya mengikuti nilai itu:
   - pita jadwal dasbor UPT;
   - jendela pengingat masa kirim;
   - jadwal di /kgb;
   - Panduan;
   - contoh jadwal di Pengaturan.
4. **Penanda "berpotensi rapelan" / "lewat batas"** mengikuti batas input baru, jadi baru muncul sesudah akhir bulan. Tidak
   ada tanda tambahan.

## Akibat

- Tidak ada jeda lagi antara batas input (akhir bulan M-2) dan rekon gaji (1–15 bulan M-1). Buat SK, review UPT, TTE, dan
  unggah harus selesai bersamaan dengan rekon. KGB yang diinput di akhir bulan berisiko dibayar sebagai kekurangan gaji.
- Pengingat H-14 dan H-7 sebelum batas input ikut bergeser ke akhir bulan.
- Video motion seri pertama (jadwal kirim surat 1–10) perlu diperbarui.
- Migrasi D1 harus diterapkan sebelum kode dirilis. Tanpa kolom itu, menyimpan Pengaturan gagal.
