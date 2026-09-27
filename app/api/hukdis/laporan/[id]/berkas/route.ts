import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";
import { penggunaLogin } from "@/lib/auth/penggunaLogin";
import { satkerAkunUpt } from "@/lib/aksesUpt";
import { kunciUsulan, responsBerkasSk } from "@/lib/berkasSk";
import { tabelBelumAda } from "@/lib/laporanHukdisServer";
import type { LaporanHukdisRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Pindaian SK pada laporan hukuman disiplin UPT. Boleh dibuka peninjaunya (SDM Hukdis dan Super Admin)
 * serta akun Admin UPT satker pelapornya sendiri. Tim SDM KGB tidak: isi SK hukuman bukan urusannya.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let laporan: LaporanHukdisRow | null;
  try {
    laporan = (await db.laporanHukdis.findUnique({ id })) as LaporanHukdisRow | null;
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
    throw e;
  }
  if (!laporan?.pathBerkas) return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });

  if (!canManageHukdis(session.user.role ?? "")) {
    const pengguna = await penggunaLogin(session);
    const kode = pengguna ? satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker }) : null;
    // Satker lain dijawab sama dengan berkas yang tidak ada, agar keberadaannya tidak terbaca dari luar.
    if (!kode || kode !== laporan.satker) return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  }

  const key = kunciUsulan(laporan.pathBerkas);
  if (!key) return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  const penanda = (laporan.nomorSK ?? "laporan").replace(/[^A-Za-z0-9._-]+/g, "_");
  return responsBerkasSk(key, `SK_hukuman_disiplin_${penanda}.pdf`);
}
