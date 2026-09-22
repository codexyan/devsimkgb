import type { Metadata } from "next";
import { requireRole, PERAN_KGB } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Satker & UPT" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Super Admin dan SDM KGB; peran lain diarahkan ke dashboard perannya.
  await requireRole(PERAN_KGB, "/dashboard");
  return <>{children}</>;
}
