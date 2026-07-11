import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

/**
 * PATCH /api/kgb/[id]/fix-arsip
 * Reset flagRapelan = false pada KGB selesai yang diinput sebagai arsip historis.
 * Sekaligus reset placeholder belum_diproses yang ter-generate dari KGB tersebut.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id },
    include: { pegawai: true },
  });

  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "selesai")
    return NextResponse.json(
      { error: "Hanya KGB berstatus Selesai yang bisa dikoreksi sebagai arsip" },
      { status: 400 },
    );

  // Reset flagRapelan pada KGB selesai ini
  await prisma.riwayatKGB.update({
    where: { id },
    data: { flagRapelan: false },
  });

  // Reset flagRapelan pada placeholder belum_diproses yang merupakan kelanjutan dari KGB ini
  // Placeholder tersebut memiliki tmtKgbBaru = tmtKgbBerikutnya dari KGB ini
  await prisma.riwayatKGB.updateMany({
    where: {
      pegawaiId: kgb.pegawaiId,
      status: "belum_diproses",
      tmtKgbBaru: kgb.tmtKgbBerikutnya,
    },
    data: { flagRapelan: false },
  });

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "fix_arsip",
      detail: `Koreksi arsip KGB ${kgb.pegawai.nama} (${kgb.pegawai.nip}), flagRapelan direset ke false`,
      targetNama: kgb.pegawai.nama,
    });
  }

  return NextResponse.json({ success: true });
}
