import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { BATAS_INPUT_SDM_BAWAAN, BATAS_INPUT_SDM_MAKS, BATAS_INPUT_SDM_MIN } from "@/lib/batasInputSdm";
import { lupakanBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { lupakanKppnSatker, muatKppnSatker } from "@/lib/muatKppnSatker";
import { aturKppnSatker, kppnBerlaku, normalisasiKppnSatker, pilihanKppn } from "@/lib/kppnSatker";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Hanya dipanggil halaman Pengaturan (Super Admin); layout dashboard membaca durasi sesi langsung dari db.
  if (session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const config = await db.konfigurasiKanwil.findUnique({ id: "default" });
  // KPPN dikirim dalam bentuk yang berlaku beserta bawaannya, supaya halaman Pengaturan dapat
  // menandai satker mana yang sudah disesuaikan tanpa menghitungnya sendiri.
  await muatKppnSatker();
  return NextResponse.json({ ...config, satkerKppn: kppnBerlaku(), pilihanKppn: pilihanKppn() });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const userLogin = await penggunaLogin(session);
  if (!userLogin) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const body = (await req.json()) as {
    nomorPP?: string; tahunPP?: string; waAdmin?: unknown;
    notifKgbH1?: unknown; notifKgbH2?: unknown; sesiTimeoutMenit?: unknown; batasInputSdm?: unknown;
    kppnSatker?: unknown;
  };

  const clampInt = (v: unknown, def: number, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const waAdmin = typeof body.waAdmin === "string" ? body.waAdmin.replace(/[^\d]/g, "") : "";
  let notifKgbH1 = clampInt(body.notifKgbH1, 14, 1, 120);
  let notifKgbH2 = clampInt(body.notifKgbH2, 7, 1, 120);
  if (notifKgbH2 > notifKgbH1) [notifKgbH1, notifKgbH2] = [notifKgbH2, notifKgbH1];
  const sesiTimeoutMenit = clampInt(body.sesiTimeoutMenit, 60, 5, 480);
  const batasInputSdm = clampInt(body.batasInputSdm, BATAS_INPUT_SDM_BAWAAN, BATAS_INPUT_SDM_MIN, BATAS_INPUT_SDM_MAKS);
  // Hanya satker yang KPPN-nya berbeda dari bawaan yang disimpan; sisanya mengikuti lib/satker.ts.
  const kppnSatker = normalisasiKppnSatker(body.kppnSatker);
  const jumlahKppnDisesuaikan = Object.keys(kppnSatker).length;

  // Penandatangan surat KGB dikelola di /api/penandatangan, bukan di sini.
  const data = {
    nomorPP: body.nomorPP || "Nomor 5 Tahun 2024",
    tahunPP: body.tahunPP || "2024",
    waAdmin,
    notifKgbH1,
    notifKgbH2,
    sesiTimeoutMenit,
    batasInputSdm,
    kppnSatker: jumlahKppnDisesuaikan > 0 ? JSON.stringify(kppnSatker) : "",
    updatedAt: new Date(),
    updatedBy: session.user.nip,
  };

  // Upsert id "default": buat jika belum ada.
  const existing = await db.konfigurasiKanwil.findUnique({ id: "default" });
  let config;
  if (existing) {
    config = await db.konfigurasiKanwil.update({ id: "default" }, data);
  } else {
    config = { id: "default", namaKepala: "", nipKepala: "", ...data };
    await db.konfigurasiKanwil.create(config);
  }
  // Isolate ini langsung memakai batas baru; isolate lain menyusul saat cache 60 detiknya habis.
  lupakanBatasInputSdm();
  lupakanKppnSatker();
  aturKppnSatker(kppnSatker);

  logAudit({
    userId: userLogin.id,
    aksi: "edit_konfigurasi",
    detail:
      `Update konfigurasi kanwil: dasar hukum ${data.nomorPP}, notifikasi H-${notifKgbH1}/H-${notifKgbH2}, ` +
      `sesi ${sesiTimeoutMenit} menit, batas input SDM tanggal ${batasInputSdm}, ` +
      (jumlahKppnDisesuaikan > 0
        ? `KPPN mitra disesuaikan untuk ${jumlahKppnDisesuaikan} satker (${Object.entries(kppnSatker).map(([kode, kppn]) => `${kode}: ${kppn}`).join(", ")})`
        : "KPPN mitra seluruhnya bawaan"),
  });

  return NextResponse.json({ ...config, satkerKppn: kppnBerlaku(), pilihanKppn: pilihanKppn() });
}
