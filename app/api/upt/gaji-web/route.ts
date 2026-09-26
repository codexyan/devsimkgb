import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { pegawaiSatker, satkerAkunUpt } from "@/lib/aksesUpt";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { formatTanggalId } from "@/lib/waktu";
import { selesaikanKgb } from "@/lib/selesaikanKgb";

export const runtime = "nodejs";

/**
 * Konfirmasi keuangan UPT: KGB pegawai satker ini sudah direkam di Gaji Web satker.
 *
 * Tiap UPT adalah satker tersendiri dengan DIPA, keuangan, dan akun Gaji Web sendiri. Keuangan Kanwil
 * hanya memegang pegawai Kanwil (ADR-009), jadi begitu Tim SDM Kanwil mengunggah SK bertanda tangan,
 * keuangan UPT yang menetapkan rapelan dan merekamnya. Langkah ini menjalankan penyelesaian yang sama
 * dengan konfirmasi keuangan Kanwil (lib/selesaikanKgb.ts) sekaligus mencatat inputGajiWebAt/By.
 *
 * SK yang telanjur dikonfirmasi keuangan Kanwil sebelum aturan ini berlaku (status selesai, belum
 * direkam) cukup ditandai rekam Gaji Web-nya saja.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const kode = satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker });
  if (!kode)
    return NextResponse.json(
      { error: "Penandaan Gaji Web hanya dapat dilakukan akun Admin UPT yang tertaut ke satker." },
      { status: 403 },
    );

  let kgbId = "";
  let isRapelan: boolean | null = null;
  try {
    const body = (await req.json()) as { kgbId?: unknown; isRapelan?: unknown };
    if (typeof body.kgbId === "string") kgbId = body.kgbId.trim();
    if (typeof body.isRapelan === "boolean") isRapelan = body.isRapelan;
  } catch {
    // body tidak valid diperlakukan sebagai id kosong
  }
  if (!kgbId) return NextResponse.json({ error: "kgbId wajib diisi" }, { status: 400 });

  const kgb = await db.riwayatKGB.findUnique({ id: kgbId });
  if (!kgb) return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  const pegawai = await db.pegawai.findUnique({ id: kgb.pegawaiId });
  // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!pegawai || pegawaiSatker([pegawai], kode).length === 0)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.inputGajiWebAt)
    return NextResponse.json({ error: "KGB ini sudah ditandai direkam di Gaji Web." }, { status: 409 });
  if (kgb.status !== "menunggu_keuangan" && kgb.status !== "selesai")
    return NextResponse.json(
      { error: "SK bertanda tangan untuk KGB ini belum diunggah Tim SDM Kanwil, jadi belum dapat direkam di Gaji Web." },
      { status: 409 },
    );

  const sekarang = new Date();
  const oleh = `${pengguna.nama} (${pengguna.nip})`;
  const menungguKeuangan = kgb.status === "menunggu_keuangan";

  if (menungguKeuangan) {
    if (isRapelan === null)
      return NextResponse.json({ error: "Pilih dulu apakah KGB ini dibayar sebagai rapelan." }, { status: 400 });
    const hasil = await selesaikanKgb({ kgb, userId: pengguna.id, isRapelan, gajiWeb: { at: sekarang, oleh } });
    if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
  } else {
    await db.riwayatKGB.update({ id: kgbId }, { inputGajiWebAt: sekarang, inputGajiWebBy: oleh });
  }

  logAudit({
    userId: pengguna.id,
    aksi: "rekam_gaji_web_upt",
    detail: `KGB ${pegawai.nama} (${pegawai.nip}) TMT ${formatTanggalId(kgb.tmtKgbBaru)} dikonfirmasi dan direkam di Gaji Web satker oleh ${oleh}${menungguKeuangan ? `, Rapelan: ${isRapelan ? "Ya" : "Tidak"}` : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true, inputGajiWebAt: sekarang.toISOString(), inputGajiWebBy: oleh });
}
