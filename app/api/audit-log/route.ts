import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { CI } from "@/lib/searchMode";

export async function GET(req: NextRequest) {
  // Jejak audit hanya untuk Super Admin — data sensitif lintas pengguna.
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("perPage") || "15")),
  );
  const aksi = searchParams.get("aksi") || "";
  const user = searchParams.get("user") || "";
  const dari = searchParams.get("dari") || "";
  const sampai = searchParams.get("sampai") || "";
  const q = searchParams.get("q") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (aksi) {
    where.aksi = aksi;
  }

  if (user) {
    // Pencarian sebagian, bukan exact match — "budi" cocok dengan "Budi Santoso"
    where.user = { nama: { contains: user, ...CI } };
  }

  if (dari || sampai) {
    where.waktu = {};
    if (dari) {
      where.waktu.gte = new Date(dari);
    }
    if (sampai) {
      const sampaiDate = new Date(sampai);
      sampaiDate.setHours(23, 59, 59, 999);
      where.waktu.lte = sampaiDate;
    }
  }

  if (q) {
    where.OR = [
      { detail: { contains: q, ...CI } },
      { targetNama: { contains: q, ...CI } },
      { user: { nama: { contains: q, ...CI } } },
    ];
  }

  try {
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { waktu: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: { select: { nama: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return NextResponse.json({
      data: data.map((item) => ({
        id: item.id,
        waktu: item.waktu.toISOString(),
        user: item.user?.nama || "Sistem",
        aksi: item.aksi,
        detail: item.detail,
        ipAddress: item.ipAddress || null,
        targetNama: item.targetNama || null,
      })),
      total,
      page,
      perPage,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Gagal memuat riwayat aktivitas" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });

  const body = await req.json().catch(() => ({})) as any;
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Tidak ada ID yang dipilih" }, { status: 400 });
  }

  const deleted = await prisma.auditLog.deleteMany({ where: { id: { in: ids } } });

  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "hapus_riwayat",
      detail: `Super Admin menghapus ${deleted.count} entri riwayat aktivitas`,
    });
  }

  return NextResponse.json({ deleted: deleted.count });
}
