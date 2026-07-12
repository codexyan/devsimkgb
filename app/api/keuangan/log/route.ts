import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";

export const runtime = "nodejs";

/* GET, riwayat aktivitas khusus keuangan (audit log) */
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [all, users] = await Promise.all([
    sheets.auditLog.findMany({ orderBy: { field: "waktu", dir: "desc" } }),
    sheets.user.findMany(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  const logs = all
    .filter((l) => ["konfirmasi_keuangan", "rekon_keuangan"].includes(l.aksi))
    .slice(0, 100)
    .map((l) => {
      const u = l.userId ? userById.get(l.userId) : null;
      return { ...l, user: u ? { nama: u.nama, nip: u.nip } : null };
    });

  return NextResponse.json(logs);
}
