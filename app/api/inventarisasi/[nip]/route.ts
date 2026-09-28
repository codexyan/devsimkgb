import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { bacaKegiatan, hapusKiriman } from "@/lib/inventarisServer";
import { ID_KEGIATAN_KANWIL } from "@/lib/kegiatanInventaris";

export const runtime = "nodejs";

/**
 * Hapus kiriman satu pegawai beserta berkasnya pada satu kegiatan (?kegiatan=, bawaan "kanwil"), mis. kiriman uji
 * atau yang salah orang (Super Admin).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ nip: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  const { nip } = await params;
  if (!/^\d{18}$/.test(nip)) return NextResponse.json({ error: "NIP tidak valid" }, { status: 400 });
  const kegiatan = await bacaKegiatan(new URL(req.url).searchParams.get("kegiatan") ?? ID_KEGIATAN_KANWIL);
  if (!kegiatan) return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
  await hapusKiriman(kegiatan.id, nip);
  logAudit({
    userId: pengguna.id,
    aksi: "hapus_inventarisasi_kgb",
    detail: `Kiriman NIP ${nip} pada kegiatan "${kegiatan.nama}" dihapus`,
    targetNama: nip,
  });
  return NextResponse.json({ ok: true });
}
