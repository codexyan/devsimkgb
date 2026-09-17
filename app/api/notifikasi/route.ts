import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { bolehLihatNotifikasi, generateNotifikasi, tipeNotifikasiUntukRole } from "@/lib/generateNotifikasi";

export const runtime = "nodejs";

// Pembuatan notifikasi berjalan paling sering sekali tiap 15 menit per isolate; cron harian tetap
// menjalankannya tanpa batas ini.
const JEDA_PEMBUATAN_MS = 15 * 60 * 1000;
let terakhirDibuat = 0;

async function buatNotifikasiBilaPerlu() {
  const sekarang = Date.now();
  if (sekarang - terakhirDibuat < JEDA_PEMBUATAN_MS) return;
  terakhirDibuat = sekarang;
  try {
    await generateNotifikasi();
  } catch (err) {
    console.error("[notifikasi] gagal membuat notifikasi:", err);
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tipeRole = tipeNotifikasiUntukRole(session.user.role);
  if (tipeRole !== null && tipeRole.length === 0) return NextResponse.json([]);

  await buatNotifikasiBilaPerlu();

  const { searchParams } = new URL(req.url);
  const tipeFilter = searchParams.get("tipe") || "";
  const dibacaFilter = searchParams.get("dibaca");
  const prioritasFilter = searchParams.get("prioritas") || "";
  const limitParam = Number.parseInt(searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(200, Math.max(1, limitParam)) : 50;

  if (tipeFilter && !bolehLihatNotifikasi(session.user.role, tipeFilter)) return NextResponse.json([]);

  const where: Record<string, unknown> = {};
  if (tipeFilter) where.tipe = tipeFilter;
  else if (tipeRole !== null) where.tipe = { in: [...tipeRole] };
  if (dibacaFilter !== null && dibacaFilter !== "") where.dibaca = dibacaFilter === "true";
  if (prioritasFilter) where.prioritas = prioritasFilter;

  const all = await db.notifikasi.findMany({ where, orderBy: { field: "createdAt", dir: "desc" } });
  return NextResponse.json(all.slice(0, limit));
}

// Tandai dibaca. Status dibaca berlaku untuk semua pengguna, jadi hanya notifikasi yang boleh dilihat
// role ini yang dapat ditandai.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: unknown; dibacaSemua?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; dibacaSemua?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const role = session.user.role;
  if (body.dibacaSemua === true) {
    const tipeRole = tipeNotifikasiUntukRole(role);
    if (tipeRole !== null && tipeRole.length === 0) return NextResponse.json({ success: true });
    const where = tipeRole === null ? { dibaca: false } : { dibaca: false, tipe: { in: [...tipeRole] } };
    await db.notifikasi.updateMany(where, { dibaca: true });
    return NextResponse.json({ success: true });
  }

  if (typeof body.id === "string" && body.id) {
    const notif = await db.notifikasi.findUnique({ id: body.id });
    if (!notif || !bolehLihatNotifikasi(role, notif.tipe))
      return NextResponse.json({ error: "Notifikasi tidak ditemukan" }, { status: 404 });
    await db.notifikasi.update({ id: body.id }, { dibaca: true });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id atau dibacaSemua wajib diisi" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Penghapusan notifikasi hanya untuk Super Admin, satu per satu atau seluruhnya.
  if (session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (!(await penggunaLogin(session)))
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (searchParams.get("all") === "true") {
    const count = await db.notifikasi.deleteMany({});
    return NextResponse.json({ success: true, deleted: count });
  }

  if (id) {
    await db.notifikasi.delete({ id });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id atau all=true wajib diisi" }, { status: 400 });
}
