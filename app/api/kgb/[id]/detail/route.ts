import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const kgb = await sheets.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const [pegawai, suratList] = await Promise.all([
    sheets.pegawai.findUnique({ id: kgb.pegawaiId }),
    sheets.suratKGB.findMany({ where: { kgbId: id } }) as Promise<any[]>,
  ]);

  return NextResponse.json({ ...kgb, pegawai, surat: suratList[0] ?? null });
}
