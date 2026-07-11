import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Seeding...");

  const pwSDM    = process.env.SEED_PASSWORD_SDM;
  const pwAdmin  = process.env.SEED_PASSWORD_ADMIN;
  const pwHukdis = process.env.SEED_PASSWORD_HUKDIS ?? pwSDM;

  if (!pwSDM || !pwAdmin) {
    throw new Error(
      "Set SEED_PASSWORD_SDM dan SEED_PASSWORD_ADMIN di file .env sebelum menjalankan seed",
    );
  }

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where:  { nip: "196001011980011001" },
    update: {},
    create: {
      nip:      "196001011980011001",
      password: await bcrypt.hash(pwAdmin, 12),
      nama:     "Super Admin",
      role:     "superAdminCore",
    },
  });

  // SDM KGB (memproses Kenaikan Gaji Berkala)
  const userSdmKgb = await prisma.user.upsert({
    where:  { nip: "197001011990031001" },
    update: {},
    create: {
      nip:      "197001011990031001",
      password: await bcrypt.hash(pwSDM, 12),
      nama:     "Admin SDM KGB",
      role:     "sdm_kgb",
    },
  });

  // SDM Hukdis (input hukuman disiplin, data rahasia)
  const userSdmHukdis = await prisma.user.upsert({
    where:  { nip: "197001011990031002" },
    update: {},
    create: {
      nip:      "197001011990031002",
      password: await bcrypt.hash(pwHukdis!, 12),
      nama:     "Admin SDM Hukdis",
      role:     "sdm_hukdis",
    },
  });

  // Konfigurasi Kanwil
  await prisma.konfigurasiKanwil.upsert({
    where:  { id: "default" },
    update: {},
    create: {
      id:         "default",
      namaKepala: "MULYADI",
      nipKepala:  "196801101990031002",
      nomorPP:    "Nomor 5 Tahun 2024",
      tahunPP:    "2024",
    },
  });

  // Seed jenis hukdis dari PP 53/2010
  // durasiHukdis = masa berlaku default (bulan); 0 = tidak ada masa berlaku / input manual
  const jenisHukdisList = [
    { kode: "teguran_lisan",               label: "Teguran Lisan",                                             kategori: "ringan", dasarHukum: "PP 53/2010 Pasal 7 ayat (1) huruf a", durasiHukdis:  0, berdampakKGB: false, durasiTunda: null, urutan: 1 },
    { kode: "teguran_tertulis",            label: "Teguran Tertulis",                                          kategori: "ringan", dasarHukum: "PP 53/2010 Pasal 7 ayat (1) huruf b", durasiHukdis:  0, berdampakKGB: false, durasiTunda: null, urutan: 2 },
    { kode: "pernyataan_tidak_puas",       label: "Pernyataan Tidak Puas Secara Tertulis",                     kategori: "ringan", dasarHukum: "PP 53/2010 Pasal 7 ayat (1) huruf c", durasiHukdis:  0, berdampakKGB: false, durasiTunda: null, urutan: 3 },
    { kode: "penundaan_kgb",               label: "Penundaan KGB Selama 1 Tahun",                              kategori: "sedang", dasarHukum: "PP 53/2010 Pasal 7 ayat (2) huruf a", durasiHukdis: 12, berdampakKGB: true,  durasiTunda: 12,   urutan: 4 },
    { kode: "penurunan_gaji_pokok",        label: "Penurunan Gaji Pokok Selama 1 Tahun",                       kategori: "sedang", dasarHukum: "PP 53/2010 Pasal 7 ayat (2) huruf b", durasiHukdis: 12, berdampakKGB: false, durasiTunda: null, urutan: 5 },
    { kode: "penundaan_kenaikan_pangkat",  label: "Penundaan Kenaikan Pangkat Selama 1 Tahun",                 kategori: "sedang", dasarHukum: "PP 53/2010 Pasal 7 ayat (2) huruf c", durasiHukdis: 12, berdampakKGB: false, durasiTunda: null, urutan: 6 },
    { kode: "penurunan_pangkat",           label: "Penurunan Pangkat Setingkat Lebih Rendah Selama 1 Tahun",   kategori: "berat",  dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf a", durasiHukdis: 12, berdampakKGB: false, durasiTunda: null, urutan: 7 },
    { kode: "pembebasan_jabatan",          label: "Pembebasan dari Jabatan",                                   kategori: "berat",  dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf b", durasiHukdis:  0, berdampakKGB: false, durasiTunda: null, urutan: 8 },
    { kode: "pemberhentian_dengan_hormat", label: "Pemberhentian dengan Hormat Tidak atas Permintaan Sendiri", kategori: "berat",  dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf c", durasiHukdis:  0, berdampakKGB: false, durasiTunda: null, urutan: 9 },
    { kode: "pemberhentian_tidak_hormat",  label: "Pemberhentian Tidak dengan Hormat",                         kategori: "berat",  dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf d", durasiHukdis:  0, berdampakKGB: false, durasiTunda: null, urutan: 10 },
  ];

  for (const j of jenisHukdisList) {
    await prisma.hukdisJenis.upsert({
      where: { kode: j.kode },
      update: { label: j.label, kategori: j.kategori, dasarHukum: j.dasarHukum, durasiHukdis: j.durasiHukdis, berdampakKGB: j.berdampakKGB, durasiTunda: j.durasiTunda, urutan: j.urutan },
      create: { ...j, aktif: true },
    });
  }

  // Seed konfigurasi hukdis default
  const konfTotal = await prisma.hukdisKonfigurasi.count();
  if (konfTotal === 0) {
    await prisma.hukdisKonfigurasi.create({ data: { notifHariH1: 30, notifHariH2: 14 } });
  }

  console.log("Seeding selesai!");
  console.log("Super Admin   :", superAdmin.nama,    "| NIP:", superAdmin.nip,    "| Password:", pwAdmin);
  console.log("SDM KGB       :", userSdmKgb.nama,    "| NIP:", userSdmKgb.nip,    "| Password:", pwSDM);
  console.log("SDM Hukdis    :", userSdmHukdis.nama, "| NIP:", userSdmHukdis.nip, "| Password:", pwHukdis);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
