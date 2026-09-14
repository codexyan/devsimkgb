import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
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

  const daftar = await sheets.penandatangan.findMany({ orderBy: { field: "berlakuMulai", dir: "desc" } });
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

  const hasil = validasiPenandatangan(body);
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 400 });

  const bentrok = cariBentrok(await sheets.penandatangan.findMany(), hasil.data);
  if (bentrok) return NextResponse.json({ error: pesanBentrok(bentrok) }, { status: 409 });

  const baris = { id: newId(), ...hasil.data, updatedAt: new Date(), updatedBy: session.user.nip ?? null };
  await sheets.penandatangan.create(baris);

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "tambah_penandatangan",
      detail: `Tambah penandatangan ${LABEL_JENIS_PENANDATANGAN[baris.jenis]}: ${baris.nama} (${baris.nip}), berlaku ${rentangBerlaku(baris)}`,
      targetNama: baris.nama,
    });
  }

  return NextResponse.json(baris, { status: 201 });
}
