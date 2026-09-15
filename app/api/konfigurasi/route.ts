import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await db.konfigurasiKanwil.findUnique({ id: "default" });
  return NextResponse.json(config);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const body = (await req.json()) as any;

  const clampInt = (v: unknown, def: number, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const waAdmin = typeof body.waAdmin === "string" ? body.waAdmin.replace(/[^\d]/g, "") : "";
  let notifKgbH1 = clampInt(body.notifKgbH1, 14, 1, 120);
  let notifKgbH2 = clampInt(body.notifKgbH2, 7, 1, 120);
  if (notifKgbH2 > notifKgbH1) [notifKgbH1, notifKgbH2] = [notifKgbH2, notifKgbH1];
  const sesiTimeoutMenit = clampInt(body.sesiTimeoutMenit, 60, 5, 480);

  // Penandatangan surat KGB dikelola di /api/penandatangan, bukan di sini.
  const data = {
    nomorPP: body.nomorPP || "Nomor 5 Tahun 2024",
    tahunPP: body.tahunPP || "2024",
    waAdmin,
    notifKgbH1,
    notifKgbH2,
    sesiTimeoutMenit,
    updatedAt: new Date(),
    updatedBy: session.user.nip,
  };

  // Upsert id "default": buat jika belum ada.
  const existing = await db.konfigurasiKanwil.findUnique({ id: "default" });
  let config;
  if (existing) {
    config = await db.konfigurasiKanwil.update({ id: "default" }, data as any);
  } else {
    config = { id: "default", namaKepala: "", nipKepala: "", ...data };
    await db.konfigurasiKanwil.create(config as any);
  }

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "edit_konfigurasi",
      detail: `Update konfigurasi kanwil: dasar hukum ${data.nomorPP}, notifikasi H-${notifKgbH1}/H-${notifKgbH2}, sesi ${sesiTimeoutMenit} menit`,
    });
  }

  return NextResponse.json(config);
}
