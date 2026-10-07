import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { pegawaiSatker } from "@/lib/aksesUpt";
import { muatKppnSatker } from "@/lib/muatKppnSatker";
import { dataSuratTersimpan } from "@/lib/dataSuratKgbServer";
import { infoReviewSk } from "@/lib/reviewSkUpt";
import { muatReviewSk, tanggapiReviewSk } from "@/lib/reviewSkUptServer";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";
import type { PegawaiRow, RiwayatKGBRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Review SK hanya untuk akun Admin UPT yang tertaut ke satker.";

/*
 * Review tampilan SK KGB oleh Admin UPT (ADR-077).
 *
 * GET mengirim isi SK yang sudah dibuat Kanwil, sama persis dengan yang kelak dicetak; PDF-nya disusun di peramban dengan
 * tanda air DRAF. POST menyimpan tanggapan: SK sudah benar, atau minta perbaikan dengan catatan. Hanya SK pegawai
 * satker akun ini yang sedang menunggu review, dan selama KGB-nya Sedang Diproses.
 */

/** Review, KGB, pegawai, dan surat milik satker akun; jawaban galat bila tidak ada atau bukan miliknya. */
async function muatMilikSatker(kgbId: string, kode: string) {
  const tidakAda = { galat: NextResponse.json({ error: "Permintaan review SK tidak ditemukan." }, { status: 404 }) };
  const { aktif, review } = await muatReviewSk(kgbId);
  if (!aktif) return { galat: NextResponse.json({ error: "Review SK belum aktif." }, { status: 409 }) };
  if (!review || review.satker !== kode) return tidakAda;
  const kgb = (await db.riwayatKGB.findUnique({ id: kgbId })) as RiwayatKGBRow | null;
  const pegawai = kgb ? ((await db.pegawai.findUnique({ id: kgb.pegawaiId })) as PegawaiRow | null) : null;
  // Pegawai yang sudah pindah satker tidak lagi direview satker lamanya.
  if (!kgb || !pegawai || pegawaiSatker([pegawai], kode).length === 0) return tidakAda;
  return { review, kgb, pegawai };
}

export async function GET(_req: Request, { params }: { params: Promise<{ kgbId: string }> }) {
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { kgbId } = await params;
  const milik = await muatMilikSatker(kgbId, akun.kode);
  if ("galat" in milik) return milik.galat;
  const { review, kgb, pegawai } = milik;
  if (kgb.status !== "sedang_diproses")
    return NextResponse.json({ error: "SK ini sudah tidak menunggu review: KGB-nya sudah diunggah TTE, selesai, atau dibatalkan." }, { status: 409 });

  const surat = (await db.suratKGB.findUnique({ kgbId })) as SuratKgbTersimpan | null;
  if (!surat) return NextResponse.json({ error: "SK belum dibuat Kanwil." }, { status: 404 });
  // KPPN tujuan SK mengikuti Pengaturan, sama dengan route PDF Kanwil.
  await muatKppnSatker();
  const isi = await dataSuratTersimpan({ kgb, pegawai, surat });
  if (!isi.ok) return NextResponse.json({ error: isi.pesan }, { status: isi.status });
  return NextResponse.json({
    surat: isi.surat,
    reviewSk: infoReviewSk(review, { aktif: true, unitKerja: pegawai.unitKerja }),
    pegawai: { nama: pegawai.nama, nip: pegawai.nip, jabatan: pegawai.jabatan },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ kgbId: string }> }) {
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { kgbId } = await params;

  let keputusan = "";
  let catatan = "";
  try {
    const body = (await req.json()) as { keputusan?: unknown; catatan?: unknown };
    if (typeof body.keputusan === "string") keputusan = body.keputusan;
    if (typeof body.catatan === "string") catatan = body.catatan;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  if (keputusan !== "setuju" && keputusan !== "perbaikan")
    return NextResponse.json({ error: "Keputusan harus setuju atau perbaikan" }, { status: 400 });

  const milik = await muatMilikSatker(kgbId, akun.kode);
  if ("galat" in milik) return milik.galat;

  const hasil = await tanggapiReviewSk({
    kgbId,
    satker: akun.kode,
    keputusan,
    catatan,
    oleh: `${akun.pengguna.nama} (${akun.pengguna.nip})`,
    sekarang: new Date(),
  });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });

  logAudit({
    userId: akun.pengguna.id,
    aksi: keputusan === "setuju" ? "review_sk_setuju" : "review_sk_perbaikan",
    detail:
      keputusan === "setuju"
        ? `Admin UPT menyatakan SK KGB ${milik.pegawai.nama} (${milik.pegawai.nip}) nomor ${hasil.review.nomorSurat ?? "-"} sudah benar`
        : `Admin UPT meminta perbaikan SK KGB ${milik.pegawai.nama} (${milik.pegawai.nip}) nomor ${hasil.review.nomorSurat ?? "-"}: ${hasil.review.catatan}`,
    targetNama: milik.pegawai.nama,
  });
  return NextResponse.json({ ok: true, reviewSk: infoReviewSk(hasil.review, { aktif: true, unitKerja: milik.pegawai.unitKerja }) });
}
