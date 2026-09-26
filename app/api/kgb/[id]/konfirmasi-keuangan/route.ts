import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canKonfirmasiKeuangan } from "@/lib/auth";
import { dipegangKeuanganKanwil } from "@/lib/aksesUpt";
import { selesaikanKgb } from "@/lib/selesaikanKgb";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Hanya petugas Keuangan; Super Admin melihat saja agar verifikasi tetap oleh dua orang.
  if (!canKonfirmasiKeuangan(session.user.role!))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  let isRapelan = false;
  // cepat: dikirim oleh Konfirmasi cepat (beberapa SK sekaligus, semuanya tidak rapelan).
  let cepat = false;
  try {
    const body: unknown = await req.json();
    const isi = body && typeof body === "object" ? (body as { isRapelan?: unknown; cepat?: unknown }) : null;
    isRapelan = isi?.isRapelan === true;
    cepat = isi?.cepat === true;
  } catch {
    // body kosong → tidak rapelan
  }

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "menunggu_keuangan")
    return NextResponse.json({ error: "KGB ini tidak sedang menunggu konfirmasi keuangan." }, { status: 409 });

  // Konfirmasi cepat hanya untuk SK yang tidak berpotensi rapelan dan TMT-nya (tanggal WITA) masih
  // sesudah hari ini. SK lain harus ditinjau satu per satu agar keputusan rapelan tidak terlewat.
  if (cepat) {
    const tmt = tanggalKalender(kgb.tmtKgbBaru);
    if (!tmt || tmt.getTime() <= hariIniWita().getTime())
      return NextResponse.json({ error: "TMT sudah lewat, tinjau satu per satu" }, { status: 409 });
    if (kgb.flagRapelan || isRapelan)
      return NextResponse.json({ error: "SK berpotensi rapelan, tinjau satu per satu" }, { status: 409 });
  }

  // Keuangan Kanwil hanya menindaklanjuti pegawai Kanwil. Pegawai UPT dikonfirmasi dan direkam di Gaji Web
  // oleh keuangan satkernya sendiri lewat akun Admin UPT (ADR-009).
  const pegawaiKgb = await db.pegawai.findUnique({ id: kgb.pegawaiId });
  if (pegawaiKgb && !dipegangKeuanganKanwil(pegawaiKgb.unitKerja))
    return NextResponse.json(
      { error: `${pegawaiKgb.nama} pegawai UPT, jadi KGB-nya dikonfirmasi keuangan satkernya sendiri, bukan keuangan Kanwil.` },
      { status: 409 },
    );

  const hasil = await selesaikanKgb({ kgb, userId: userLogin.id, isRapelan });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
  const { pegawai } = hasil;

  logAudit({
    userId: userLogin.id,
    aksi: "konfirmasi_keuangan",
    detail: `Konfirmasi KGB ${pegawai.nama} (${pegawai.nip}), Gol. ${kgb.golonganBaru}, Gaji Rp ${kgb.gajiPokokBaru.toLocaleString("id-ID")}, Rapelan: ${isRapelan ? "Ya" : "Tidak"}${cepat ? ", melalui Konfirmasi cepat" : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
