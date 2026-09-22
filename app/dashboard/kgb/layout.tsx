import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole, PERAN_KGB } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Proses KGB" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Keuangan dan SDM Hukdis diarahkan ke dashboard perannya.
  await requireRole(PERAN_KGB, "/dashboard");
  return <Suspense>{children}</Suspense>;
}
