import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { hapusKiriman } from "@/lib/inventarisServer";

export const runtime = "nodejs";

/** Hapus kiriman satu pegawai beserta berkasnya (Super Admin), mis. kiriman uji atau yang salah orang. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ nip: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  const { nip } = await params;
  if (!/^\d{18}$/.test(nip)) return NextResponse.json({ error: "NIP tidak valid" }, { status: 400 });
  await hapusKiriman(nip);
  logAudit({ userId: pengguna.id, aksi: "hapus_inventarisasi_kgb", detail: `Kiriman inventarisasi NIP ${nip} dihapus`, targetNama: nip });
  return NextResponse.json({ ok: true });
}
