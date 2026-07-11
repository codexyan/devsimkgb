import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/* ─────────────────────────────────────────────────────────────────────────
   Reset akun: sisakan HANYA satu Super Admin, hapus semua akun login lainnya.

   Cara jalan (dari apps/kgb, setelah DATABASE_URL di .env terisi benar):
     npx tsx scripts/reset-superadmin.ts

   Yang dilakukan:
   1. Buat / perbarui akun Super Admin dengan NIP di bawah (password = NIP).
   2. Alihkan seluruh data yang pernah dibuat akun lain (SK, riwayat KGB,
      serah terima, hukdis, rekon, audit log, reviewer permintaan profil)
      ke Super Admin — supaya tidak melanggar foreign key.
   3. Hapus semua akun login selain Super Admin.
   ───────────────────────────────────────────────────────────────────────── */

const SUPER_ADMIN_NIP = "200007082025061017";
const SUPER_ADMIN_NAMA = "Super Admin";
const SUPER_ADMIN_ROLE = "superAdminCore";

async function main() {
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_NIP, 12);

  // 1) Buat / perbarui Super Admin.
  const superAdmin = await prisma.user.upsert({
    where: { nip: SUPER_ADMIN_NIP },
    update: { password: passwordHash, nama: SUPER_ADMIN_NAMA, role: SUPER_ADMIN_ROLE },
    create: { nip: SUPER_ADMIN_NIP, password: passwordHash, nama: SUPER_ADMIN_NAMA, role: SUPER_ADMIN_ROLE },
  });
  console.log(`✓ Super Admin siap: ${superAdmin.nama} (NIP ${superAdmin.nip})`);

  // 2) Kumpulkan akun lain.
  const others = await prisma.user.findMany({
    where: { id: { not: superAdmin.id } },
    select: { id: true, nip: true, nama: true },
  });

  if (others.length === 0) {
    console.log("✓ Tidak ada akun lain. Selesai — hanya Super Admin yang tersisa.");
    return;
  }

  const otherIds = others.map((u) => u.id);
  console.log(`• Ditemukan ${others.length} akun lain untuk dihapus:`);
  others.forEach((u) => console.log(`    - ${u.nama} (NIP ${u.nip})`));

  // 3) Alihkan kepemilikan data + hapus akun, dalam satu transaksi.
  await prisma.$transaction(async (tx) => {
    // Reviewer permintaan profil (opsional) → Super Admin.
    await tx.profileChangeRequest.updateMany({
      where: { reviewedBy: { in: otherIds } },
      data: { reviewedBy: superAdmin.id },
    });
    // Permintaan profil milik akun lain akan ikut terhapus otomatis
    // (relasi RequestOwner memakai onDelete: Cascade).

    // Relasi wajib tanpa cascade — WAJIB dialihkan agar user bisa dihapus.
    await tx.suratKGB.updateMany({
      where: { generatedBy: { in: otherIds } },
      data: { generatedBy: superAdmin.id },
    });
    await tx.riwayatKGB.updateMany({
      where: { createdBy: { in: otherIds } },
      data: { createdBy: superAdmin.id },
    });
    await tx.serahTerima.updateMany({
      where: { createdBy: { in: otherIds } },
      data: { createdBy: superAdmin.id },
    });
    await tx.riwayatHukdis.updateMany({
      where: { createdBy: { in: otherIds } },
      data: { createdBy: superAdmin.id },
    });
    await tx.rekonBulanan.updateMany({
      where: { inputBy: { in: otherIds } },
      data: { inputBy: superAdmin.id },
    });

    // Audit log (userId opsional) → Super Admin, agar jejak tetap ada.
    await tx.auditLog.updateMany({
      where: { userId: { in: otherIds } },
      data: { userId: superAdmin.id },
    });

    // Hapus akun lain.
    const del = await tx.user.deleteMany({ where: { id: { in: otherIds } } });
    console.log(`✓ ${del.count} akun lain dihapus.`);
  });

  console.log("\n✓ Selesai. Login memakai:");
  console.log(`   NIP      : ${SUPER_ADMIN_NIP}`);
  console.log(`   Password : ${SUPER_ADMIN_NIP}  (sama dengan NIP — ganti setelah login)`);
}

main()
  .catch((e) => {
    console.error("✗ Gagal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
