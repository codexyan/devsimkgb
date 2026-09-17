import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const PANJANG_ALASAN_MAKS = 500;

/**
 * PATCH /api/kgb/[id]/fix-arsip
 * Koreksi sebagai arsip historis: menghapus status rapelan pada satu KGB Selesai, yaitu penanda
 * Berpotensi rapelan (flagRapelan) dan rapelan yang ditetapkan keuangan (rapelanDitetapkan). Rekap,
 * laporan, dan dashboard menghitung rapelan KGB Selesai dari rapelanDitetapkan, jadi keduanya dihapus
 * agar koreksi benar-benar berlaku. Hanya Super Admin, dengan alasan wajib; nilai lama kedua penanda
 * dicatat di log aktivitas. Placeholder KGB berikutnya tidak diubah, karena penanda rapelannya dihitung
 * dari batas input SDM periode itu sendiri.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(session.user.role ?? ""))
    return NextResponse.json({ error: "Koreksi arsip hanya dapat dilakukan Super Admin" }, { status: 403 });

  let alasan = "";
  try {
    const body: unknown = await req.json();
    const nilai = body && typeof body === "object" ? (body as { alasan?: unknown }).alasan : undefined;
    alasan = typeof nilai === "string" ? nilai.trim() : "";
  } catch {
    // badan kosong atau bukan JSON: alasan dianggap kosong
  }
  if (!alasan)
    return NextResponse.json({ error: "Alasan koreksi wajib diisi" }, { status: 400 });
  if (alasan.length > PANJANG_ALASAN_MAKS)
    return NextResponse.json({ error: `Alasan koreksi paling banyak ${PANJANG_ALASAN_MAKS} karakter` }, { status: 400 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "selesai")
    return NextResponse.json({ error: "Hanya KGB berstatus Selesai yang bisa dikoreksi sebagai arsip" }, { status: 400 });

  const rapelanDitetapkan = kgb.rapelanDitetapkan === true;
  if (!kgb.flagRapelan && !rapelanDitetapkan)
    return NextResponse.json({ error: "KGB ini tidak bertanda rapelan, sehingga tidak perlu dikoreksi" }, { status: 409 });

  const pegawai = await db.pegawai.findUnique({ id: kgb.pegawaiId });

  await db.riwayatKGB.update(
    { id },
    rapelanDitetapkan ? { flagRapelan: false, rapelanDitetapkan: false } : { flagRapelan: false },
  );

  const yaTidak = (nilai: boolean) => (nilai ? "Ya" : "Tidak");
  logAudit({
    userId: userLogin.id,
    aksi: "fix_arsip",
    detail: `Koreksi arsip KGB ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}), penanda rapelan dihapus (sebelumnya Berpotensi rapelan: ${yaTidak(kgb.flagRapelan)}, Rapelan ditetapkan keuangan: ${yaTidak(rapelanDitetapkan)}), Alasan: ${alasan}`,
    targetNama: pegawai?.nama ?? "-",
  });

  return NextResponse.json({ success: true });
}
