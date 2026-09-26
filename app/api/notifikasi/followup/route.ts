import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dipegangKeuanganKanwil } from "@/lib/aksesUpt";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { canKonfirmasiKeuangan } from "@/lib/auth";
import { formatTanggalId } from "@/lib/waktu";
import { TIPE_NOTIFIKASI } from "@/lib/generateNotifikasi";

export const runtime = "nodejs";

// Keuangan meminta Tim SDM memproses KGB. Entri Belum Diproses virtual belum punya record KGB,
// sehingga permintaan dapat memakai pegawaiId. Satu permintaan yang belum dibaca per pegawai.
export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canKonfirmasiKeuangan(session.user.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { kgbId?: unknown; pegawaiId?: unknown };
  try {
    body = (await req.json()) as { kgbId?: unknown; pegawaiId?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  const kgbId = typeof body.kgbId === "string" ? body.kgbId : "";
  let pegawaiId = typeof body.pegawaiId === "string" ? body.pegawaiId : "";
  if (!kgbId && !pegawaiId)
    return NextResponse.json({ error: "kgbId atau pegawaiId wajib diisi" }, { status: 400 });

  let tmt: Date | null = null;
  if (kgbId) {
    const kgb = await db.riwayatKGB.findUnique({ id: kgbId });
    if (!kgb)
      return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });
    if (kgb.status !== "belum_diproses" && kgb.status !== "sedang_diproses")
      return NextResponse.json({ error: "Follow up hanya untuk KGB yang belum dikirim ke keuangan" }, { status: 409 });
    pegawaiId = kgb.pegawaiId;
    tmt = kgb.tmtKgbBaru;
  }

  const pegawai = await db.pegawai.findUnique({ id: pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  // Keuangan Kanwil hanya menindaklanjuti pegawai Kanwil; KGB pegawai UPT diikuti keuangan satkernya (ADR-009).
  if (!dipegangKeuanganKanwil(pegawai.unitKerja))
    return NextResponse.json(
      { error: `${pegawai.nama} pegawai UPT, jadi KGB-nya ditindaklanjuti keuangan satkernya sendiri.` },
      { status: 409 },
    );
  tmt = tmt ?? pegawai.tmtKgbBerikutnya;

  const sudahAda = await db.notifikasi.findMany({
    where: { tipe: TIPE_NOTIFIKASI.FOLLOWUP_KEUANGAN, referenceId: pegawaiId, dibaca: false },
  });
  if (sudahAda.length > 0) return NextResponse.json({ ok: true, sudahAda: true });

  await db.notifikasi.create({
    id: newId(),
    judul: "Follow Up dari Keuangan",
    pesan: `Keuangan meminta agar KGB atas nama ${pegawai.nama} (${pegawai.nip}) TMT ${formatTanggalId(tmt, { month: "long", year: "numeric" })} segera diproses dan dikirimkan SK-nya.`,
    tipe: TIPE_NOTIFIKASI.FOLLOWUP_KEUANGAN,
    referenceId: pegawaiId,
    dibaca: false,
    createdAt: new Date(),
    prioritas: "warning",
    kategori: "kgb",
    linkHref: "/dashboard/kgb",
  });

  return NextResponse.json({ ok: true, sudahAda: false });
}
