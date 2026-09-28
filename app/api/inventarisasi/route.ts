import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canProcessKGB, isSuperAdmin } from "@/lib/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { bacaKonfigurasi, daftarKiriman, simpanKonfigurasi } from "@/lib/inventarisServer";

export const runtime = "nodejs";

/** Daftar kiriman inventarisasi dan konfigurasi formulir; kode akses hanya dikirim ke Super Admin. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role ?? "";
  if (!canProcessKGB(role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const [konfigurasi, kiriman] = await Promise.all([bacaKonfigurasi(), daftarKiriman()]);
  return NextResponse.json(
    { konfigurasi: isSuperAdmin(role) ? konfigurasi : { ...konfigurasi, kode: "" }, kiriman },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Buka atau tutup formulir, ganti kode akses dan teks batas waktu (Super Admin). */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { terbuka?: unknown; kode?: unknown; batas?: unknown };
  const kode = typeof body.kode === "string" ? body.kode.trim().toUpperCase() : "";
  const batas = typeof body.batas === "string" ? body.batas.trim().slice(0, 80) : "";
  const terbuka = body.terbuka === true;
  if (terbuka && !/^[A-Z0-9-]{4,30}$/.test(kode))
    return NextResponse.json({ error: "Kode akses 4 sampai 30 huruf atau angka, tanpa spasi." }, { status: 400 });

  await simpanKonfigurasi({ terbuka, kode, batas, diubahOleh: pengguna.nama, diubahAt: new Date().toISOString() });
  logAudit({
    userId: pengguna.id,
    aksi: "atur_inventarisasi_kgb",
    detail: `Formulir inventarisasi KGB ${terbuka ? "dibuka" : "ditutup"}${batas ? `, batas ${batas}` : ""}`,
    targetNama: "Inventarisasi KGB",
  });
  return NextResponse.json({ ok: true });
}
