import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

/**
 * PATCH /api/kgb/[id]/fix-arsip
 * Reset flagRapelan = false pada KGB selesai (arsip historis) + placeholder-nya.
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
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "selesai")
    return NextResponse.json({ error: "Hanya KGB berstatus Selesai yang bisa dikoreksi sebagai arsip" }, { status: 400 });

  const pegawai = await db.pegawai.findUnique({ id: kgb.pegawaiId });

  await db.riwayatKGB.update({ id }, { flagRapelan: false });

  // Reset placeholder belum_diproses yang merupakan kelanjutan (tmtKgbBaru = tmtKgbBerikutnya KGB ini).
  await db.riwayatKGB.updateMany(
    { pegawaiId: kgb.pegawaiId, status: "belum_diproses", tmtKgbBaru: kgb.tmtKgbBerikutnya },
    { flagRapelan: false },
  );

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "fix_arsip",
      detail: `Koreksi arsip KGB ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}), flagRapelan direset ke false`,
      targetNama: pegawai?.nama ?? "-",
    });
  }

  return NextResponse.json({ success: true });
}
