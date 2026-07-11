import type { Metadata } from "next";
import { requireRole, NON_KEUANGAN } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Riwayat Aktivitas" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(NON_KEUANGAN, "/dashboard/keuangan");
  return <>{children}</>;
}
