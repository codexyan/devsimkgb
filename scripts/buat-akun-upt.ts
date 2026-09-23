// Membuat akun Admin UPT untuk banyak satker sekaligus, dengan aturan yang sama dengan
// POST /api/users: NIP 18 digit dan unik, peran admin_upt wajib bertaut satker, password di-hash
// bcrypt cost 12. Password dibuat acak dan ditulis ke berkas CSV, tidak ditampilkan di layar.
//
// Pakai:
//   npx tsx scripts/buat-akun-upt.ts <daftar.csv> [--terapkan]
//
// Berkas daftar berisi tiga kolom tanpa judul, satu akun per baris:
//   kode_satker,nip,nama
// Contoh:
//   rutan-rantau,199505052019051005,Hendra Saputra
//
// Tanpa --terapkan skrip hanya memeriksa dan melaporkan rencananya (uji kering). Dengan --terapkan
// akun dibuat, lalu berkas kredensial ditulis di sebelah berkas daftar.
//
// Backend mengikuti DATA_BACKEND seperti aplikasi: lokal untuk uji coba, supabase untuk produksi.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { newId } from "../lib/sheets/id";
import { SATKER_UPT, nilaiSatkerUntukPeran } from "../lib/aksesUpt";
import { ROLES } from "../lib/auth/roles";
import { logAudit } from "../lib/auditLog";

interface BarisDaftar {
  kodeSatker: string;
  nip: string;
  nama: string;
}

/** Password acak yang mudah dibacakan lewat telepon: tanpa huruf dan angka yang mirip. */
const ABJAD = "abcdefghjkmnpqrstuvwxyz23456789";
function passwordAcak(panjang = 12): string {
  const byte = randomBytes(panjang);
  let hasil = "";
  for (let i = 0; i < panjang; i++) hasil += ABJAD[byte[i] % ABJAD.length];
  return hasil;
}

function bacaDaftar(berkas: string): BarisDaftar[] {
  const isi = readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");
  const baris: BarisDaftar[] = [];
  for (const [nomor, teks] of isi.split("\n").entries()) {
    const bersih = teks.trim();
    if (!bersih || bersih.startsWith("#")) continue;
    const kolom = bersih.split(",").map((k) => k.trim());
    if (kolom.length < 3) throw new Error(`Baris ${nomor + 1}: perlu tiga kolom kode_satker,nip,nama`);
    baris.push({ kodeSatker: kolom[0], nip: kolom[1], nama: kolom.slice(2).join(",").trim() });
  }
  return baris;
}

async function utama() {
  const [berkasDaftar, ...bendera] = process.argv.slice(2);
  const terapkan = bendera.includes("--terapkan");
  if (!berkasDaftar) {
    console.error("Pakai: npx tsx scripts/buat-akun-upt.ts <daftar.csv> [--terapkan]");
    console.error("Isi daftar: kode_satker,nip,nama  (satu akun per baris)");
    console.error("\nKode satker yang tersedia:");
    for (const s of SATKER_UPT) console.error(`  ${s.kode.padEnd(30)} ${s.nama}`);
    process.exitCode = 1;
    return;
  }

  const daftar = bacaDaftar(berkasDaftar);
  const penggunaAda = await db.user.findMany();
  const nipTerpakai = new Set(penggunaAda.map((u) => u.nip));
  const satkerTerpakai = new Map(
    penggunaAda.filter((u) => u.role === ROLES.ADMIN_UPT && u.satker).map((u) => [u.satker as string, u.nama]),
  );

  const rencana: (BarisDaftar & { password: string; namaSatker: string })[] = [];
  const dilewati: string[] = [];

  for (const b of daftar) {
    const satker = nilaiSatkerUntukPeran(ROLES.ADMIN_UPT, b.kodeSatker);
    if (!satker.ok) {
      dilewati.push(`${b.kodeSatker}: ${satker.pesan}`);
      continue;
    }
    if (!/^\d{18}$/.test(b.nip)) {
      dilewati.push(`${b.kodeSatker}: NIP "${b.nip}" harus 18 digit angka`);
      continue;
    }
    if (!b.nama) {
      dilewati.push(`${b.kodeSatker}: nama wajib diisi`);
      continue;
    }
    if (nipTerpakai.has(b.nip)) {
      dilewati.push(`${b.kodeSatker}: NIP ${b.nip} sudah terdaftar, dilewati`);
      continue;
    }
    const sudahAda = satkerTerpakai.get(b.kodeSatker);
    if (sudahAda) {
      dilewati.push(`${b.kodeSatker}: sudah punya akun Admin UPT atas nama ${sudahAda}, dilewati`);
      continue;
    }
    nipTerpakai.add(b.nip);
    satkerTerpakai.set(b.kodeSatker, b.nama);
    rencana.push({
      ...b,
      password: passwordAcak(),
      namaSatker: SATKER_UPT.find((s) => s.kode === b.kodeSatker)?.nama ?? b.kodeSatker,
    });
  }

  console.log(`Akan dibuat: ${rencana.length} akun`);
  for (const r of rencana) console.log(`  ${r.nama} (${r.nip}) · ${r.namaSatker}`);
  if (dilewati.length > 0) {
    console.log(`\nDilewati: ${dilewati.length}`);
    for (const d of dilewati) console.log(`  ${d}`);
  }

  const tanpaAkun = SATKER_UPT.filter((s) => !satkerTerpakai.has(s.kode));
  if (tanpaAkun.length > 0) {
    console.log(`\nSatker yang masih tanpa akun Admin UPT: ${tanpaAkun.length}`);
    for (const s of tanpaAkun) console.log(`  ${s.kode.padEnd(30)} ${s.nama}`);
  }

  if (!terapkan) {
    console.log("\nUji kering. Tambahkan --terapkan untuk benar-benar membuat akunnya.");
    return;
  }
  if (rencana.length === 0) {
    console.log("\nTidak ada akun yang perlu dibuat.");
    return;
  }

  for (const r of rencana) {
    await db.user.create({
      id: newId(),
      nip: r.nip,
      password: await bcrypt.hash(r.password, 12),
      nama: r.nama,
      jabatan: null,
      email: null,
      role: ROLES.ADMIN_UPT,
      createdAt: new Date(),
      satker: r.kodeSatker,
    });
    // Pelakunya skrip, bukan pengguna yang login, jadi userId dikosongkan seperti entri Sistem.
    logAudit({
      userId: null,
      aksi: "tambah_pengguna",
      detail: `Tambah pengguna ${r.nama} (${r.nip}) dengan peran Admin UPT, satker ${r.namaSatker}, lewat scripts/buat-akun-upt.ts`,
    });
  }

  const berkasKredensial = path.join(
    path.dirname(path.resolve(berkasDaftar)),
    `akun-upt-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  const isi = [
    "satker,nama,nip,password",
    ...rencana.map((r) => `"${r.namaSatker}","${r.nama}",${r.nip},${r.password}`),
  ].join("\n");
  writeFileSync(berkasKredensial, isi + "\n");

  console.log(`\n${rencana.length} akun dibuat.`);
  console.log(`Kredensial ditulis ke: ${berkasKredensial}`);
  console.log("Bagikan lewat jalur tertutup, lalu minta tiap operator menggantinya di menu Profil Saya.");
}

utama().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
