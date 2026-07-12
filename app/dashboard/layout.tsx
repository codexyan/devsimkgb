import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sheets } from "@/lib/sheets/tables";
import DashboardShell from "./components/DashboardShell";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");

  // Durasi auto-logout dari Pengaturan (fallback 60 mnt bila belum diatur)
  const cfg = (await sheets.konfigurasiKanwil
    .findUnique({ id: "default" })
    .catch(() => null)) as { sesiTimeoutMenit?: number } | null;

  return (
    <DashboardShell
      nama={session.user.nama ?? ""}
      nip={session.user.nip ?? ""}
      role={session.user.role ?? ""}
      sesiTimeoutMenit={cfg?.sesiTimeoutMenit ?? 60}
    >
      {children}
    </DashboardShell>
  );
}
