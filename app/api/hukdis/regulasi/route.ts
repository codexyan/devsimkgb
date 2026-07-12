import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis } from "@/lib/auth";

export const runtime = "nodejs";

const VALID_STATUS = ["berlaku", "dicabut_sebagian", "dicabut"];

// GET /api/hukdis/regulasi — daftar semua regulasi (master data)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const all = (await sheets.regulasi.findMany()) as any[];
    // orderBy [status asc, tahun desc, urutan asc]
    all.sort(
      (a, b) =>
        String(a.status).localeCompare(String(b.status)) ||
        String(b.tahun).localeCompare(String(a.tahun)) ||
        (Number(a.urutan) || 0) - (Number(b.urutan) || 0),
    );
    const byId = new Map(all.map((r) => [r.id, r]));
    const list = all.map((r) => {
      const g = r.digantikanOlehId ? byId.get(r.digantikanOlehId) : null;
      return { ...r, digantikanOleh: g ? { id: g.id, nomor: g.nomor, tahun: g.tahun } : null };
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

  const body = (await req.json()) as any;
  const nomor = String(body.nomor ?? "").trim();
  const tahun = String(body.tahun ?? "").trim();
  const tentang = String(body.tentang ?? "").trim();
  if (!nomor || !tahun || !tentang)
    return NextResponse.json({ error: "Nomor, tahun, dan tentang wajib diisi" }, { status: 400 });

  const status = VALID_STATUS.includes(body.status) ? body.status : "berlaku";
  const now = new Date();
  const reg = {
    id: newId(),
    nomor, tahun, tentang, status,
    pasalBerlaku: status === "dicabut_sebagian" ? (body.pasalBerlaku?.trim() || null) : null,
    digantikanOlehId: status !== "berlaku" ? (body.digantikanOlehId || null) : null,
    catatan: body.catatan?.trim() || null,
    urutan: 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: session.user.nip,
  };
  await sheets.regulasi.create(reg);

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (userLogin) logAudit({ userId: userLogin.id, aksi: "edit_konfigurasi", detail: `Tambah regulasi: ${nomor} Tahun ${tahun}` });

  return NextResponse.json(reg, { status: 201 });
}
