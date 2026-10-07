import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB, isSuperAdmin } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { suratSudahDibuat, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import { PESAN_REVIEW_BELUM_AKTIF, infoReviewSk, pegawaiPerluReviewSk } from "@/lib/reviewSkUpt";
import { lewatiReviewSk, mintaReviewSk } from "@/lib/reviewSkUptServer";
import { SATKER } from "@/lib/satker";
import { kodeSatkerPegawai } from "@/lib/rekapSatker";
import type { PegawaiRow, RiwayatKGBRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/*
 * Review SK KGB pegawai UPT dari sisi Kanwil (ADR-077).
 *
 * - `minta`: minta review ke Admin UPT untuk SK yang sudah dibuat. Buat SK dan Perbaiki SK sudah memintanya sendiri;
 *   aksi ini untuk SK yang dibuat sebelum review aktif. Super Admin dan Tim SDM KGB.
 * - `lewati`: lanjutkan tanpa menunggu UPT, untuk keadaan mendesak. Hanya Super Admin, alasan wajib, tercatat di Log
 *   Aktivitas. Sesudahnya SK dapat dicetak tanpa tanda air dan diunggah TTE.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role ?? "";
  if (!canProcessKGB(role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  let aksi = "";
  let alasan = "";
  try {
    const body = (await req.json()) as { aksi?: unknown; alasan?: unknown };
    if (typeof body.aksi === "string") aksi = body.aksi;
    if (typeof body.alasan === "string") alasan = body.alasan.trim();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  if (aksi !== "minta" && aksi !== "lewati") return NextResponse.json({ error: "Aksi harus minta atau lewati" }, { status: 400 });
  if (aksi === "lewati" && !isSuperAdmin(role))
    return NextResponse.json({ error: "Hanya Super Admin yang dapat melewati review UPT." }, { status: 403 });

  const { id } = await params;
  const kgb = (await db.riwayatKGB.findUnique({ id })) as RiwayatKGBRow | null;
  if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
  if (kgb.status !== "sedang_diproses")
    return NextResponse.json({ error: "Review hanya berlaku selama KGB Sedang Diproses, sebelum SK TTE diunggah." }, { status: 409 });
  const pegawai = (await db.pegawai.findUnique({ id: kgb.pegawaiId })) as PegawaiRow | null;
  if (!pegawai) return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });
  if (!pegawaiPerluReviewSk(pegawai.unitKerja))
    return NextResponse.json({ error: "SK pegawai Kanwil tidak melalui review UPT." }, { status: 409 });

  const oleh = `${pengguna.nama} (${pengguna.nip})`;
  const sekarang = new Date();
  const namaSatker = SATKER.find((s) => s.kode === kodeSatkerPegawai(pegawai.unitKerja))?.nama ?? pegawai.unitKerja ?? "-";

  if (aksi === "minta") {
    const surat = (await db.suratKGB.findUnique({ kgbId: id })) as SuratKgbTersimpan | null;
    if (!suratSudahDibuat(surat))
      return NextResponse.json({ error: "Buat SK lebih dulu; review diminta otomatis saat SK dibuat." }, { status: 409 });
    const hasil = await mintaReviewSk({
      kgb,
      pegawai,
      nomorSurat: surat!.nomorSurat,
      tanggalSurat: surat!.tanggalSurat ? new Date(surat!.tanggalSurat) : null,
      oleh,
      sekarang,
    });
    if (!hasil.aktif) return NextResponse.json({ error: PESAN_REVIEW_BELUM_AKTIF }, { status: 409 });
    logAudit({
      userId: pengguna.id,
      aksi: "minta_review_sk",
      detail: `Minta review SK KGB ${pegawai.nama} (${pegawai.nip}) nomor ${surat!.nomorSurat} ke ${namaSatker}`,
      targetNama: pegawai.nama,
    });
    return NextResponse.json({ ok: true, reviewSk: infoReviewSk(hasil.review, { aktif: true, unitKerja: pegawai.unitKerja }) });
  }

  const hasil = await lewatiReviewSk({ kgbId: id, alasan, oleh, sekarang });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
  logAudit({
    userId: pengguna.id,
    aksi: "lewati_review_sk",
    detail: `Lewati review UPT untuk SK KGB ${pegawai.nama} (${pegawai.nip}) nomor ${hasil.review.nomorSurat ?? "-"} (${namaSatker}): ${alasan}`,
    targetNama: pegawai.nama,
  });
  return NextResponse.json({ ok: true, reviewSk: infoReviewSk(hasil.review, { aktif: true, unitKerja: pegawai.unitKerja }) });
}
