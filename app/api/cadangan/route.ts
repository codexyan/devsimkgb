import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { LABEL_JENIS_CADANGAN, cakupanPeran, statusCadangan } from "@/lib/cadangan";
import { daftarSkCadangan } from "@/lib/cadanganServer";

export const runtime = "nodejs";

/**
 * Keadaan cadangan akun yang login (ADR-018). `?lengkap=1` menambahkan isi cadangannya: jenis data
 * menurut peran dan daftar PDF SK. Tanpa itu jawabannya ringan, untuk pengingat di setiap halaman.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const status = statusCadangan(pengguna.cadanganTerakhirAt, pengguna.createdAt, new Date());
  const ringkas = {
    role: pengguna.role,
    nip: pengguna.nip,
    keadaan: status.keadaan,
    hariSejak: status.hariSejak,
    jatuhTempo: status.jatuhTempo.toISOString(),
    terakhir: status.terakhir?.toISOString() ?? null,
  };
  if (new URL(req.url).searchParams.get("lengkap") !== "1") return NextResponse.json(ringkas);

  return NextResponse.json({
    ...ringkas,
    jenis: cakupanPeran(pengguna.role).map((id) => ({ id, label: LABEL_JENIS_CADANGAN[id] })),
    sk: await daftarSkCadangan(pengguna),
  });
}

/** Catat bahwa akun ini baru saja mengunduh cadangan. */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const sekarang = new Date();
  await db.user.update({ id: pengguna.id }, { cadanganTerakhirAt: sekarang });
  logAudit({
    userId: pengguna.id,
    aksi: "cadangan_data",
    detail: `${pengguna.nama} mengunduh cadangan data bulanan`,
    targetNama: pengguna.nama,
  });
  return NextResponse.json({ ok: true, waktu: sekarang.toISOString() });
}
