import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";

export const runtime = "nodejs";

// GET, semua pending requests (super admin only)
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const requests = await sheets.profileChangeRequest.findMany({
      where: { status: "pending" },
      orderBy: { field: "createdAt", dir: "asc" },
    });
    const users = await sheets.user.findMany();
    const userById = new Map(users.map((u) => [u.id, u]));

    // Emulasi `include: user` — gabungkan data user terkait.
    const withUser = requests.map((r) => {
      const u = userById.get((r as any).userId);
      return {
        ...r,
        user: u
          ? { id: u.id, nip: u.nip, nama: u.nama, jabatan: u.jabatan, email: u.email, role: u.role }
          : null,
      };
    });
    return NextResponse.json(withUser);
  } catch {
    return NextResponse.json([]);
  }
}
