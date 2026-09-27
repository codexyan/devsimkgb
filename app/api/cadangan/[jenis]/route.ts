import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { cakupanPeran, type JenisCadangan } from "@/lib/cadangan";
import { barisCadangan } from "@/lib/cadanganServer";

export const runtime = "nodejs";

/**
 * Baris satu jenis data untuk cadangan akun yang login (ADR-018). Tiap jenis diminta terpisah dan disusun
 * menjadi CSV serta ZIP di peramban, sehingga satu permintaan tidak pernah memikul seluruh basis data.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ jenis: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { jenis } = await params;
  if (!cakupanPeran(pengguna.role).includes(jenis as JenisCadangan))
    return NextResponse.json({ error: "Data ini bukan bagian cadangan akun Anda" }, { status: 403 });

  return NextResponse.json({ baris: await barisCadangan(jenis as JenisCadangan, pengguna) });
}
