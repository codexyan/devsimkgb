import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";
import { muatVersiTemplate } from "@/lib/templateSuratServer";

export const runtime = "nodejs";

/**
 * Hapus versi template yang belum mulai berlaku (ADR-019). Versi yang sudah berlaku adalah riwayat: SK yang
 * terbit selama masa berlakunya dicetak ulang dengan versi itu, jadi tidak boleh hilang.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role ?? ""))
    return NextResponse.json({ error: "Hanya Super Admin yang dapat mengubah template surat" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  const { versi } = await muatVersiTemplate();
  const target = versi.find((v) => v.id === id);
  if (!target) return NextResponse.json({ error: "Versi template tidak ditemukan" }, { status: 404 });
  if (tanggalKalender(target.berlakuMulai)! <= tanggalKalender(hariIniWita())!)
    return NextResponse.json(
      { error: "Versi ini sudah mulai berlaku, jadi menjadi riwayat dan tidak dapat dihapus. Simpan versi baru untuk menggantinya." },
      { status: 409 },
    );

  await db.templateSurat.delete({ id });
  logAudit({
    userId: pengguna.id,
    aksi: "hapus_template_surat",
    detail: `Template surat KGB versi ${target.versi} yang terjadwal dihapus sebelum berlaku`,
    targetNama: `Template surat v${target.versi}`,
  });
  return NextResponse.json({ ok: true });
}
