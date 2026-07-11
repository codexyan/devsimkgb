import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
  const cfg = await prisma.konfigurasiKanwil
    .findUnique({ where: { id: "default" }, select: { sesiTimeoutMenit: true } })
    .catch(() => null);

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
