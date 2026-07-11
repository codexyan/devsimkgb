import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canProcessKGB } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as any;

  try {
  // Toggle flagRapelan manual
  if (body.flagRapelan !== undefined) {
    const kgb = await prisma.riwayatKGB.update({
      where: { id },
      data: { flagRapelan: body.flagRapelan },
    });
    return NextResponse.json(kgb);
  }

  // Update data SK (dari halaman generate)
  if (body.nomorSK !== undefined) {
    const kgb = await prisma.riwayatKGB.update({
      where: { id },
      data: {
        nomorSK: body.nomorSK,
        tanggalSK: body.tanggalSK ? new Date(body.tanggalSK) : undefined,
        tmtSK: body.tmtSK ? new Date(body.tmtSK) : undefined,
      },
    });
    return NextResponse.json(kgb);
  }

  // Update status
  const validStatus = ["belum_diproses", "sedang_diproses", "selesai", "ditolak"];
  if (!validStatus.includes(body.status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const kgb = await prisma.riwayatKGB.update({
    where: { id },
    data: { status: body.status },
    include: {
      pegawai: { select: { nama: true, nip: true } },
    },
  });

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });

  // Jika ditolak, catat alasan di SerahTerima
  if (body.status === "ditolak" && body.alasanTolak) {
    if (userLogin) {
      await prisma.serahTerima.create({
        data: {
          kgbId: id,
          namaAdmin: session.user.nama || userLogin.nama,
          keterangan: `DITOLAK: ${body.alasanTolak}`,
          createdBy: userLogin.id,
        },
      });
    }
  }

  if (userLogin) {
    const statusLabel: Record<string, string> = {
      belum_diproses: "Belum Diproses",
      sedang_diproses: "Sedang Diproses",
      selesai: "Selesai",
      ditolak: "Ditolak",
    };
    const aksi = body.status === "ditolak" ? "reject_kgb" : "approve_kgb";
    logAudit({
      userId: userLogin.id,
      aksi,
      detail: `Status KGB ${kgb.pegawai.nama} (${kgb.pegawai.nip}) diubah menjadi "${statusLabel[body.status] ?? body.status}"${body.alasanTolak ? `, Alasan: ${body.alasanTolak}` : ""}`,
      targetNama: kgb.pegawai.nama,
    });
  }

  return NextResponse.json(kgb);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.riwayatKGB.delete({ where: { id } });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
    throw e;
  }

  return NextResponse.json({ message: "Data KGB berhasil dihapus" });
}
