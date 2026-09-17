import type { Metadata } from "next";
import { requireRole } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Impor Pegawai" };

// Impor menulis data pegawai, jadi hanya peran yang boleh mengubah pegawai (canEditPegawai).
// SDM Hukdis yang membuka URL ini diarahkan kembali ke Data Pegawai.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(["superAdminCore", "sdm_kgb"], "/dashboard/pegawai?impor=ditolak");
  return <>{children}</>;
}
