/**
 * Seed: Data dummy testing skenario rapelan bertingkat
 *
 * Skenario:
 *   - Pegawai baru (golongan III/a)
 *   - TMT KGB Terakhir = Januari 2022 (sudah diproses, pegawai menerima gaji MKG 6 tahun)
 *   - TMT KGB Berikutnya = Januari 2024 â†’ SUDAH TERLAMBAT ~27 bulan (sekarang April 2026)
 *   - Satu record belum_diproses untuk Jan 2024 dengan flagRapelan = true
 *
 * Jalankan:
 *   npx tsx scripts/seed-dummy-rapelan.ts
 *
 * Hapus data dummy:
 *   npx tsx scripts/seed-dummy-rapelan.ts --cleanup
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";

// â”€â”€ Identitas dummy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DUMMY_NIP = "199001012024011001";
const DUMMY_NAMA = "AHMAD RAPELAN [TEST]";

// â”€â”€ Nilai gaji (PP No.5 Tahun 2024, golongan III/a) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MKG 6/0  â†’ gaji 3.057.300  (kondisi pegawai setelah KGB Jan 2022)
// MKG 8/0  â†’ gaji 3.153.600  (hasil KGB Jan 2024 â€” yang belum diproses)
// MKG 10/0 â†’ gaji 3.252.900  (hasil KGB Jan 2026 â€” periode berikutnya)
const GAJI_MKG6 = 3_057_300;
const GAJI_MKG8 = 3_153_600;

// â”€â”€ Tanggal-tanggal kunci â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TMT_KGB_TERAKHIR = new Date("2022-01-01"); // KGB Jan 2022 sudah selesai
const TMT_KGB_JAN2024 = new Date("2024-01-01"); // periode yang BELUM diproses (terlambat)
const TMT_KGB_JAN2026 = new Date("2026-01-01"); // periode berikutnya setelah Jan 2024

async function seed() {
  // Cari user SDM pertama sebagai createdBy
  const userSDM = await prisma.user.findFirst();
  if (!userSDM) {
    console.error("âŒ  Tidak ada user sama sekali di database. Buat user dulu.");
    process.exit(1);
  }
  console.log(`âœ”  Menggunakan user: ${userSDM.nama} (${userSDM.nip}) sebagai createdBy`);

  // Cek jika sudah ada data dummy
  const existing = await prisma.pegawai.findUnique({ where: { nip: DUMMY_NIP } });
  if (existing) {
    console.warn(`âš    Pegawai dummy sudah ada (id: ${existing.id}). Jalankan --cleanup dulu jika ingin ulang.`);
    process.exit(0);
  }

  // â”€â”€ 1. Buat Pegawai â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pegawai = await prisma.pegawai.create({
    data: {
      nip: DUMMY_NIP,
      nama: DUMMY_NAMA,
      tempatLahir: "Banjarmasin",
      tanggalLahir: new Date("1990-01-01"),
      jenisKelamin: "L",
      pendidikanTerakhir: "S1",
      jabatan: "Penjaga Tahanan",
      pangkat: "Penata Muda",
      golonganRuang: "III/a",
      unitKerja: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
      eselon: null,
      jenisJabatan: "Fungsional Umum",
      tmtGolongan: new Date("2018-04-01"),
      // Kondisi saat ini: sudah menerima KGB Jan 2022 â†’ MKG 6 tahun
      mkgTahun: 6,
      mkgBulan: 0,
      gajiPokok: GAJI_MKG6,
      tmtKgbTerakhir: TMT_KGB_TERAKHIR,
      tmtKgbBerikutnya: TMT_KGB_JAN2024, // sudah lewat â†’ rapelan
      statusHukdis: false,
      aktif: true,
    },
  });
  console.log(`âœ”  Pegawai dibuat: ${pegawai.nama} (${pegawai.nip}) â†’ id: ${pegawai.id}`);

  // â”€â”€ 2. Buat RiwayatKGB belum_diproses untuk Jan 2024 (rapelan) â”€
  //    Deadline SDM = akhir Nov 2023 â†’ sekarang Apr 2026 sudah jauh lewat â†’ flagRapelan = true
  const kgbJan2024 = await prisma.riwayatKGB.create({
    data: {
      pegawaiId: pegawai.id,
      nomorSK: "",                       // belum diproses, kosong
      tanggalSK: TMT_KGB_JAN2024,
      tmtSK: TMT_KGB_JAN2024,
      golonganLama: "III/a",
      gajiPokokLama: GAJI_MKG6,         // gaji sebelum KGB Jan 2024
      mkgTahunLama: 6,
      mkgBulanLama: 0,
      golonganBaru: "III/a",            // KGB tidak naik golongan
      gajiPokokBaru: GAJI_MKG8,         // gaji setelah KGB Jan 2024 (MKG 8/0)
      mkgTahunBaru: 8,
      mkgBulanBaru: 0,
      tmtKgbBaru: TMT_KGB_JAN2024,
      tmtKgbBerikutnya: TMT_KGB_JAN2026,
      status: "belum_diproses",
      flagRapelan: true,                 // sudah melewati deadline SDM (Nov 2023)
      isArsip: false,
      createdBy: userSDM.id,
    },
  });
  console.log(`âœ”  RiwayatKGB Jan 2024 dibuat (belum_diproses, rapelan) â†’ id: ${kgbJan2024.id}`);

  console.log(`
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Data dummy berhasil dibuat. Skenario testing:

  1. Buka pipeline â†’ cari "${DUMMY_NAMA}"
     â†’ Muncul di kolom Belum Diproses (urutan paling atas)
     â†’ Tombol "Input Arsip KGB dulu" aktif (merah)
     â†’ Tombol "Input KGB (terlambat)" disabled

  2. Klik "Input Arsip KGB dulu"
     â†’ Isi data SK periode Jan 2024 (arsip lama)
     â†’ Upload file PDF (scan SK lama)
     â†’ Klik "Simpan Arsip"
     â†’ Dashboard refresh â†’ prevNomorSK terisi

  3. Tombol "Input KGB (terlambat)" sekarang aktif
     â†’ Klik â†’ field "Atas Dasar SK Terakhir" terisi otomatis
     â†’ Input data KGB Jan 2024 â†’ Simpan

  4. Pipeline pindah ke "Sedang Diproses"
     â†’ Generate surat â†’ Upload TTD â†’ Selesai

  5. Setelah selesai â†’ auto-generate record Jan 2026 (rapelan kedua)
     â†’ Siklus terulang untuk Jan 2026

  NIP dummy  : ${DUMMY_NIP}
  Pegawai id : ${pegawai.id}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
`);
}

async function cleanup() {
  const pegawai = await prisma.pegawai.findUnique({ where: { nip: DUMMY_NIP } });
  if (!pegawai) {
    console.log("â„¹  Data dummy tidak ditemukan, tidak ada yang dihapus.");
    return;
  }

  // Hapus cascade: RiwayatKGB â†’ SuratKGB, SerahTerima dihapus otomatis via onDelete: Cascade
  await prisma.pegawai.delete({ where: { nip: DUMMY_NIP } });
  console.log(`âœ”  Data dummy "${DUMMY_NAMA}" (${DUMMY_NIP}) berhasil dihapus.`);
}

async function main() {
  const isCleanup = process.argv.includes("--cleanup");
  try {
    if (isCleanup) await cleanup();
    else await seed();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
