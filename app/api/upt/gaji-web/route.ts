import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { pegawaiSatker, satkerAkunUpt } from "@/lib/aksesUpt";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { formatTanggalId } from "@/lib/waktu";

export const runtime = "nodejs";

/**
 * Penanda bahwa KGB sudah direkam di aplikasi Gaji Web oleh operator gaji UPT.
 *
 * Tiap UPT adalah satker tersendiri dengan DIPA dan operator gajinya sendiri, sehingga yang merekam
 * KGB pegawai UPT di Gaji Web bukan keuangan Kanwil, melainkan UPT itu sendiri. Keuangan Kanwil
 * mengkroscek SK lalu mengirimkannya kembali ke UPT; langkah terakhirnya dicatat di sini, memakai
 * kolom inputGajiWebAt dan inputGajiWebBy pada riwayat KGB.
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
  try {
    const body = (await req.json()) as { kgbId?: unknown };
    if (typeof body.kgbId === "string") kgbId = body.kgbId.trim();
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

  // SK baru dapat direkam di Gaji Web setelah dikonfirmasi keuangan Kanwil.
  if (kgb.status !== "selesai")
    return NextResponse.json(
      { error: "SK ini belum dikonfirmasi keuangan Kanwil, jadi belum dapat direkam di Gaji Web." },
      { status: 409 },
    );
  if (kgb.inputGajiWebAt)
    return NextResponse.json({ error: "KGB ini sudah ditandai direkam di Gaji Web." }, { status: 409 });

  const sekarang = new Date();
  const oleh = `${pengguna.nama} (${pengguna.nip})`;
  await db.riwayatKGB.update({ id: kgbId }, { inputGajiWebAt: sekarang, inputGajiWebBy: oleh });

  logAudit({
    userId: pengguna.id,
    aksi: "rekam_gaji_web_upt",
    detail: `KGB ${pegawai.nama} (${pegawai.nip}) TMT ${formatTanggalId(kgb.tmtKgbBaru)} ditandai sudah direkam di Gaji Web satker oleh ${oleh}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true, inputGajiWebAt: sekarang.toISOString(), inputGajiWebBy: oleh });
}
