import type { Metadata } from "next";
import { requireRole } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Manajemen User" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(["superAdminCore"]);
  return <>{children}</>;
}
