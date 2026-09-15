import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getGajiPokok } from "@/lib/tabelGaji";

export const runtime = "nodejs";

/**
 * PATCH /api/kgb/[id]/recalculate
 * Rekalkukasi kolom Baru pada placeholder belum_diproses.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "belum_diproses")
    return NextResponse.json({ error: "Hanya placeholder belum_diproses yang bisa direkalkukasi" }, { status: 400 });

  const mkgTahunBaru = kgb.mkgTahunLama + 2;
  const mkgBulanBaru = kgb.mkgBulanLama;
  const gajiPokokBaru = getGajiPokok(kgb.golonganLama, mkgTahunBaru, mkgBulanBaru);

  const today = new Date();
  const tmt = new Date(kgb.tmtKgbBaru as Date);
  const deadlineSDM = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const flagRapelan = todayDate > deadlineSDM;

  const updated = await db.riwayatKGB.update(
    { id },
    { golonganBaru: kgb.golonganLama, gajiPokokBaru, mkgTahunBaru, mkgBulanBaru, flagRapelan },
  );

  return NextResponse.json(updated);
}
