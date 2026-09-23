import type { Metadata } from "next";
import { requireRole } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Usulan Data UPT" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Peninjau usulan: Super Admin dan Tim SDM KGB, sama dengan yang memproses KGB.
  await requireRole(["superAdminCore", "sdm_kgb"]);
  return <>{children}</>;
}
