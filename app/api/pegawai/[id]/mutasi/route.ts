import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canEditPegawai } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { newId } from "@/lib/sheets/id";
import { LABEL_JENIS_MUTASI, kekuranganMutasi, perubahanPegawaiMutasi, type JenisMutasi } from "@/lib/mutasiPegawai";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { SATKER, cariSatker } from "@/lib/satker";
import { muatKppnSatker } from "@/lib/muatKppnSatker";
import { formatTanggalId } from "@/lib/waktu";
import type { PegawaiRow, RiwayatMutasiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const JENIS_SAH: JenisMutasi[] = ["definitif", "bko", "selesai_bko", "pemberhentian"];

/** Riwayat mutasi dan pemberhentian seorang pegawai, terbaru lebih dulu. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const riwayat = (await db.riwayatMutasi.findMany({ where: { pegawaiId: id } })) as RiwayatMutasiRow[];
  const daftar = riwayat
    .map((r) => ({
      id: r.id,
      jenis: r.jenis,
      label: LABEL_JENIS_MUTASI[r.jenis as JenisMutasi] ?? r.jenis,
      satkerAsal: r.satkerAsal,
      satkerTujuan: r.satkerTujuan,
      tmt: r.tmt ? new Date(r.tmt).toISOString() : null,
      nomorSK: r.nomorSK,
      tanggalSK: r.tanggalSK ? new Date(r.tanggalSK).toISOString() : null,
      alasan: r.alasan,
      keterangan: r.keterangan,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      createdBy: r.createdBy,
    }))
    .sort((a, b) => (b.tmt ?? "").localeCompare(a.tmt ?? ""));

  return NextResponse.json(daftar);
}

/**
 * Catat satu mutasi atau pemberhentian.
 *
 * Pencatatannya selalu berpasangan: satu baris riwayat sebagai bukti, dan perubahan seperlunya pada
 * data pegawai. Pegawai tidak pernah dihapus, sehingga riwayat KGB-nya tetap utuh, dan KGB yang TMT-nya
 * jatuh sebelum tanggal berhenti tetap sah diproses (lib/mutasiPegawai.ts).
 *
 * BKO sengaja tidak mengubah unit kerja: gaji pegawai BKO tetap dibayar satker asal, jadi KGB, SK, dan
 * KPPN tujuannya juga tetap di sana. Yang dicatat hanya satker tempat bertugas.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  const pegawai = (await db.pegawai.findUnique({ id })) as PegawaiRow | null;
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teks = (kunci: string) => (typeof body[kunci] === "string" ? (body[kunci] as string).trim() : "");
  const jenis = teks("jenis") as JenisMutasi;
  if (!JENIS_SAH.includes(jenis)) return NextResponse.json({ error: "Jenis mutasi tidak dikenal" }, { status: 400 });

  const tmt = teks("tmt") ? bacaTanggalInput(teks("tmt")) : null;
  if (teks("tmt") && !tmt) return NextResponse.json({ error: "TMT berlaku tidak valid" }, { status: 400 });
  const tanggalSK = teks("tanggalSk") ? bacaTanggalInput(teks("tanggalSk")) : null;
  if (teks("tanggalSk") && !tanggalSK) return NextResponse.json({ error: "Tanggal SK tidak valid" }, { status: 400 });

  const isian = {
    jenis,
    satkerTujuan: teks("satkerTujuan") || null,
    tmt,
    nomorSk: teks("nomorSk") || null,
    alasan: teks("alasan") || null,
  };
  const kurang = kekuranganMutasi(isian);
  if (kurang.length > 0) return NextResponse.json({ error: `Belum lengkap: ${kurang.join(", ")}.` }, { status: 400 });

  const tujuan = isian.satkerTujuan ? SATKER.find((s) => s.kode === isian.satkerTujuan) : null;
  if (isian.satkerTujuan && !tujuan) return NextResponse.json({ error: "Satker tujuan tidak dikenal" }, { status: 400 });
  if (tujuan && jenis === "definitif" && cariSatker(pegawai.unitKerja)?.kode === tujuan.kode)
    return NextResponse.json({ error: "Satker tujuan sama dengan satker sekarang" }, { status: 400 });

  await muatKppnSatker();
  const asal = cariSatker(pegawai.unitKerja);
  const perubahan = perubahanPegawaiMutasi(isian, tujuan?.nama ?? null);

  const baris: RiwayatMutasiRow = {
    id: newId(),
    pegawaiId: id,
    jenis,
    satkerAsal: asal?.nama ?? pegawai.unitKerja ?? null,
    satkerTujuan: tujuan?.nama ?? null,
    tmt,
    nomorSK: isian.nomorSk,
    tanggalSK,
    alasan: isian.alasan,
    keterangan: teks("keterangan") || null,
    createdAt: new Date(),
    createdBy: `${pengguna.nama} (${pengguna.nip})`,
  };
  await db.riwayatMutasi.create(baris);
  if (Object.keys(perubahan).length > 0) await db.pegawai.update({ id }, perubahan);

  const label = LABEL_JENIS_MUTASI[jenis];
  logAudit({
    userId: pengguna.id,
    aksi: "mutasi_pegawai",
    detail:
      `${label} ${pegawai.nama} (${pegawai.nip})` +
      (tujuan ? `, tujuan ${tujuan.nama}` : "") +
      (isian.alasan ? `, alasan ${isian.alasan}` : "") +
      `, TMT ${formatTanggalId(tmt)}, SK ${isian.nomorSk}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true, id: baris.id, label }, { status: 201 });
}
