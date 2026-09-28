import type { Metadata } from "next";
import { auth } from "@/auth";
import { requireRole } from "@/lib/authGuard";
import { ROLES } from "@/lib/auth/roles";
import IsiInventarisasi from "./IsiInventarisasi";

export const metadata: Metadata = { title: "Inventarisasi KGB" };

/**
 * Kiriman formulir publik /inventarisasi-kgb dari pegawai Kanwil. Tim SDM KGB dan Super Admin melihat dan
 * mengunduhnya (ZIP berstruktur folder untuk Google Drive); membuka, menutup, dan mengganti kode akses
 * formulir hanya Super Admin.
 */
export default async function HalamanInventarisasi() {
  await requireRole([ROLES.SUPER_ADMIN, ROLES.SDM_KGB]);
  const session = await auth();
  return <IsiInventarisasi superAdmin={session?.user.role === ROLES.SUPER_ADMIN} />;
}
