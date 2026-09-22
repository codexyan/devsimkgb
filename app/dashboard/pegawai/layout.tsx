import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole, NON_KEUANGAN } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Data Pegawai" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(NON_KEUANGAN, "/dashboard/keuangan");
  return <Suspense>{children}</Suspense>;
}
