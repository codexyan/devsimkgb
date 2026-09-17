import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { ROLES } from "@/lib/auth";
import {
  cariBentrok,
  LABEL_JENIS_PENANDATANGAN,
  pesanBentrok,
  rentangBerlaku,
  validasiPenandatangan,
} from "@/lib/penandatangan";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Satu-satunya pemanggil adalah Pengaturan (Super Admin); surat membaca penandatangan langsung dari db.
  if (session.user.role !== ROLES.SUPER_ADMIN)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const daftar = await db.penandatangan.findMany({ orderBy: { field: "berlakuMulai", dir: "desc" } });
  return NextResponse.json(daftar);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== ROLES.SUPER_ADMIN)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const userLogin = await penggunaLogin(session);
  if (!userLogin) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const hasil = validasiPenandatangan(body);
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 400 });

  const bentrok = cariBentrok(await db.penandatangan.findMany(), hasil.data);
  if (bentrok) return NextResponse.json({ error: pesanBentrok(bentrok) }, { status: 409 });

  const baris = { id: newId(), ...hasil.data, updatedAt: new Date(), updatedBy: session.user.nip ?? null };
  await db.penandatangan.create(baris);

  logAudit({
    userId: userLogin.id,
    aksi: "tambah_penandatangan",
    detail: `Tambah penandatangan ${LABEL_JENIS_PENANDATANGAN[baris.jenis]}: ${baris.nama} (${baris.nip}), berlaku ${rentangBerlaku(baris)}`,
    targetNama: baris.nama,
  });

  return NextResponse.json(baris, { status: 201 });
}
