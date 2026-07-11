import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/* GET, riwayat aktivitas khusus keuangan (audit log) */
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const logs = await prisma.auditLog.findMany({
    where: {
      aksi: { in: ["konfirmasi_keuangan", "rekon_keuangan"] },
    },
    orderBy: { waktu: "desc" },
    take: 100,
    include: {
      user: { select: { nama: true, nip: true } },
    },
  });

  return NextResponse.json(logs);
}
