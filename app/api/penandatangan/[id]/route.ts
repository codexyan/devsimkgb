import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== ROLES.SUPER_ADMIN)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const lama = await db.penandatangan.findUnique({ id });
  if (!lama) return NextResponse.json({ error: "Penandatangan tidak ditemukan" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const hasil = validasiPenandatangan({
    jenis: lama.jenis,
    nama: lama.nama,
    nip: lama.nip,
    jabatan: lama.jabatan,
    dasarPenunjukan: lama.dasarPenunjukan ?? "",
    berlakuMulai: lama.berlakuMulai?.toISOString() ?? "",
    berlakuSampai: lama.berlakuSampai?.toISOString() ?? "",
    ...body,
  });
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 400 });

  const bentrok = cariBentrok(await db.penandatangan.findMany(), hasil.data, id);
  if (bentrok) return NextResponse.json({ error: pesanBentrok(bentrok) }, { status: 409 });

  const baru = await db.penandatangan.update(
    { id },
    { ...hasil.data, updatedAt: new Date(), updatedBy: session.user.nip ?? null },
  );

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (userLogin && baru) {
    logAudit({
      userId: userLogin.id,
      aksi: "ubah_penandatangan",
      detail: `Ubah penandatangan ${LABEL_JENIS_PENANDATANGAN[baru.jenis]}: ${baru.nama} (${baru.nip}), berlaku ${rentangBerlaku(baru)}`,
      targetNama: baru.nama,
    });
  }

  return NextResponse.json(baru);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== ROLES.SUPER_ADMIN)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const lama = await db.penandatangan.findUnique({ id });
  if (!lama) return NextResponse.json({ error: "Penandatangan tidak ditemukan" }, { status: 404 });

  const dipakai = await db.suratKGB.count({ penandatanganId: id });
  if (dipakai > 0) {
    return NextResponse.json(
      { error: `Sudah tercetak pada ${dipakai} surat KGB. Isi tanggal akhir berlaku alih-alih menghapus.` },
      { status: 409 },
    );
  }

  await db.penandatangan.delete({ id });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "hapus_penandatangan",
      detail: `Hapus penandatangan ${LABEL_JENIS_PENANDATANGAN[lama.jenis]}: ${lama.nama} (${lama.nip})`,
      targetNama: lama.nama,
    });
  }

  return NextResponse.json({ ok: true });
}
