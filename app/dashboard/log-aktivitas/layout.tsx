import type { Metadata } from "next";
import { requireRole } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Log Aktivitas" };

export default async function LogAktivitasLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["superAdminCore"]);
  return <>{children}</>;
}
