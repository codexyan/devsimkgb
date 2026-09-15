import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [logs, users] = await Promise.all([
      db.auditLog.findMany(),
      db.user.findMany(),
    ]);
    const namaById = new Map(users.map((u) => [u.id, u.nama]));

    // distinct nama user yang pernah muncul di audit log.
    const namaSet = new Set<string>();
    for (const l of logs) {
      if (!l.userId) continue;
      const n = namaById.get(l.userId);
      if (n) namaSet.add(n);
    }

    return NextResponse.json([...namaSet].sort());
  } catch (error) {
    console.error("Error fetching audit log users:", error);
    return NextResponse.json([], { status: 500 });
  }
}
