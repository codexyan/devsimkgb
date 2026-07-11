import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET, semua pending requests (super admin only)
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const requests = await prisma.profileChangeRequest.findMany({
      where: { status: "pending" },
      include: {
        user: { select: { id: true, nip: true, nama: true, jabatan: true, email: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(requests);
  } catch {
    return NextResponse.json([]);
  }
}
