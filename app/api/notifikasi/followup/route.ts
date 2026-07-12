import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { kgbId } = (await req.json()) as any;
  if (!kgbId)
    return NextResponse.json({ error: "kgbId wajib" }, { status: 400 });

  const kgb = await sheets.riwayatKGB.findUnique({ id: kgbId });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });
  const pegawai = await sheets.pegawai.findUnique({ id: kgb.pegawaiId });

  const tmt = new Date(kgb.tmtKgbBaru as Date).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  await sheets.notifikasi.create({
    id: newId(),
    judul: "Follow Up dari Keuangan",
    pesan: `Keuangan meminta agar KGB atas nama ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}) TMT ${tmt} segera diproses dan dikirimkan SK-nya.`,
    tipe: "followup_keuangan",
    referenceId: kgb.pegawaiId,
    dibaca: false,
    createdAt: new Date(),
    prioritas: "warning",
    kategori: "kgb",
    linkHref: "/dashboard/kgb",
  });

  return NextResponse.json({ ok: true });
}
