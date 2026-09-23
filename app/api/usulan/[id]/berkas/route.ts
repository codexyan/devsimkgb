import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { penggunaLogin } from "@/lib/auth/penggunaLogin";
import { satkerAkunUpt } from "@/lib/aksesUpt";
import { kunciUsulan, responsBerkasSk } from "@/lib/berkasSk";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Berkas surat usulan UPT. Boleh dibuka peninjau Kanwil (Super Admin dan Tim SDM KGB) serta akun
 * Admin UPT satker pengusulnya sendiri. Key objek dibatasi folder "usulan/" (lib/berkasSk.ts).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const usulan = (await db.usulanPegawai.findUnique({ id })) as UsulanPegawaiRow | null;
  if (!usulan?.pathBerkas)
    return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });

  const peninjau = canProcessKGB(session.user.role ?? "");
  if (!peninjau) {
    const pengguna = await penggunaLogin(session);
    const kode = pengguna ? satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker }) : null;
    // Satker lain dijawab sama dengan berkas yang tidak ada, agar keberadaannya tidak terbaca dari luar.
    if (!kode || kode !== usulan.satker)
      return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  }

  const key = kunciUsulan(usulan.pathBerkas);
  if (!key) return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  return responsBerkasSk(key, `Surat_usulan_${usulan.nomorSurat.replace(/[^A-Za-z0-9._-]+/g, "_")}.pdf`);
}
