import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis } from "@/lib/auth";

const VALID_STATUS = ["berlaku", "dicabut_sebagian", "dicabut"];

// GET /api/hukdis/regulasi — daftar semua regulasi (master data)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const list = await prisma.regulasi.findMany({
      orderBy: [{ status: "asc" }, { tahun: "desc" }, { urutan: "asc" }],
      include: { digantikanOleh: { select: { id: true, nomor: true, tahun: true } } },
    });
    return NextResponse.json(list);
  } catch (e) {
    console.error("GET /api/hukdis/regulasi:", e);
    return NextResponse.json({ error: "Gagal memuat regulasi" }, { status: 500 });
  }
}

// POST /api/hukdis/regulasi — tambah regulasi
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = await req.json() as any;
  const nomor = String(body.nomor ?? "").trim();
  const tahun = String(body.tahun ?? "").trim();
  const tentang = String(body.tentang ?? "").trim();
  if (!nomor || !tahun || !tentang)
    return NextResponse.json({ error: "Nomor, tahun, dan tentang wajib diisi" }, { status: 400 });

  const status = VALID_STATUS.includes(body.status) ? body.status : "berlaku";
  const reg = await prisma.regulasi.create({
    data: {
      nomor, tahun, tentang, status,
      pasalBerlaku: status === "dicabut_sebagian" ? (body.pasalBerlaku?.trim() || null) : null,
      digantikanOlehId: status !== "berlaku" ? (body.digantikanOlehId || null) : null,
      catatan: body.catatan?.trim() || null,
      updatedBy: session.user.nip,
    },
  });

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (userLogin) logAudit({ userId: userLogin.id, aksi: "edit_konfigurasi", detail: `Tambah regulasi: ${nomor} Tahun ${tahun}` });

  return NextResponse.json(reg, { status: 201 });
}
