import "dotenv/config";
import bcrypt from "bcryptjs";
import { getValues } from "../lib/sheets/client";
import { sheets, TAB_HEADERS } from "../lib/sheets/tables";
import { newId } from "../lib/sheets/id";

/* ───────────────────────────────────────────────────────────────────────────
   Seed 1 akun Super Admin ke tab "User" di Google Sheets.

   Jalankan: npx tsx scripts/seed-sheets-admin.ts
   Butuh env GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID.

   Aman diulang (idempotent): jika NIP sudah ada, tidak menimpa, cukup lapor.
   ─────────────────────────────────────────────────────────────────────────── */

const NIP = "200007082025061017";
const NAMA = "Super Admin";
const ROLE = "superAdminCore"; // ROLES.SUPER_ADMIN
const PASSWORD = NIP; // password awal = NIP; ganti setelah login.

async function main() {
  // 1) Validasi header tab User cocok urutannya (write bersifat posisional).
  const header = (await getValues("User!1:1"))[0] ?? [];
  const expected = TAB_HEADERS["User"];
  const headerOk =
    header.length >= expected.length &&
    expected.every((name, i) => header[i] === name);
  if (!headerOk) {
    console.error("✗ Header tab 'User' tidak sesuai. Harus URUT persis:");
    console.error("   " + expected.join(", "));
    console.error("   Ditemukan: " + (header.join(", ") || "(kosong)"));
    process.exit(1);
  }

  // 2) Idempotent: cek apakah NIP sudah ada.
  const existing = await sheets.user.findUnique({ nip: NIP });
  if (existing) {
    console.log(`• Akun sudah ada: ${existing.nama} (NIP ${existing.nip}). Tidak diubah.`);
    return;
  }

  // 3) Tulis akun baru.
  await sheets.user.create({
    id: newId(),
    nip: NIP,
    password: await bcrypt.hash(PASSWORD, 12),
    nama: NAMA,
    jabatan: null,
    email: null,
    role: ROLE,
    createdAt: new Date(),
    satker: null,
  });

  console.log("✓ Super Admin dibuat di Google Sheets (tab User):");
  console.log(`   NIP      : ${NIP}`);
  console.log(`   Password : ${PASSWORD}  (sama dengan NIP, ganti setelah login)`);
  console.log(`   Role     : ${ROLE}`);
}

main().catch((e) => {
  console.error("✗ Gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
