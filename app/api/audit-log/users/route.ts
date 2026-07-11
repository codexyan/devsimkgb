import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.auditLog.findMany({
      select: {
        user: { select: { nama: true } },
      },
      distinct: ["userId"],
      where: {
        userId: { not: null },
      },
    });

    const namaList = users
      .map((u) => u.user?.nama)
      .filter(Boolean)
      .sort() as string[];

    return NextResponse.json(namaList);
  } catch (error) {
    console.error("Error fetching audit log users:", error);
    return NextResponse.json([], { status: 500 });
  }
}
