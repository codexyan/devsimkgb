import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { kgbId } = await req.json() as any;
  if (!kgbId)
    return NextResponse.json({ error: "kgbId wajib" }, { status: 400 });

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id: kgbId },
    include: { pegawai: true },
  });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  const tmt = new Date(kgb.tmtKgbBaru).toLocaleDateString("id-ID", {
    month: "long", year: "numeric",
  });

  await prisma.notifikasi.create({
    data: {
      judul:       "Follow Up dari Keuangan",
      pesan:       `Keuangan meminta agar KGB atas nama ${kgb.pegawai.nama} (${kgb.pegawai.nip}) TMT ${tmt} segera diproses dan dikirimkan SK-nya.`,
      tipe:        "followup_keuangan",
      referenceId: kgb.pegawaiId,
      prioritas:   "warning",
      kategori:    "kgb",
      linkHref:    "/dashboard/kgb",
    },
  });

  return NextResponse.json({ ok: true });
}
