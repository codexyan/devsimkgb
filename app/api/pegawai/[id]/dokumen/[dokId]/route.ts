import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { responsBerkasSk } from "@/lib/berkasSk";
import { daftarDokumenArsip, hapusDokumenArsip } from "@/lib/dokumenPegawaiServer";
import { JENIS_DOKUMEN, idAman, kunciBerkasDokumen } from "@/lib/dokumenPegawai";

export const runtime = "nodejs";

/** Isi satu dokumen arsip pegawai, untuk pratinjau (Super Admin dan Tim SDM KGB). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; dokId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const { id, dokId } = await params;
  if (!idAman(id) || !idAman(dokId)) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  const dokumen = (await daftarDokumenArsip(id)).find((d) => d.id === dokId);
  if (!dokumen) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  return responsBerkasSk(kunciBerkasDokumen(id, dokId), dokumen.namaBerkas);
}

/** Hapus satu dokumen arsip pegawai. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; dokId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  const { id, dokId } = await params;
  if (!idAman(id) || !idAman(dokId)) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  const dokumen = await hapusDokumenArsip(id, dokId);
  if (!dokumen) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  const pegawai = await db.pegawai.findUnique({ id });
  logAudit({
    userId: pengguna.id,
    aksi: "hapus_dokumen_pegawai",
    targetNama: pegawai?.nama ?? id,
    detail: `Hapus ${JENIS_DOKUMEN[dokumen.jenis]}${dokumen.nomorSK ? ` ${dokumen.nomorSK}` : ""} (${dokumen.namaBerkas}) dari arsip ${pegawai?.nama ?? id}`,
  });
  return NextResponse.json({ ok: true });
}
