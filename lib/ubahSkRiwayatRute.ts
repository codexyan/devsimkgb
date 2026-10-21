// PATCH /api/pegawai/[id]/pangkat dan /pmk: pembetulan data SK satu riwayat (ADR-068). Dipisah dari kedua rute supaya
// pemeriksaan hak, pembacaan isian, dan jawabannya persis sama untuk kenaikan pangkat dan PMK.

import { NextResponse } from "next/server";
import { db } from "./db";
import { auth } from "@/auth";
import { canEditPegawai, isSuperAdmin } from "./auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "./auth/penggunaLogin";
import { hapusRiwayatKembar, ubahSkRiwayat, type IsianUbahSkRiwayat } from "./ubahSkRiwayat";
import { hapusRiwayatKpBebas } from "./hapusRiwayatKp";
import { tanggalKalender } from "./waktu";

/** Isian lanjutan Super Admin (ADR-118): keterangan untuk kedua jenis; TMT dan masa kerja hanya kenaikan pangkat. */
function bacaIsianLuas(body: Record<string, unknown>, jenis: "kp" | "pmk"): IsianUbahSkRiwayat["luas"] {
  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const angka = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
  const tmtTeks = teks(body.tmtPangkat);
  return {
    keterangan: teks(body.keterangan) || null,
    tmt: jenis === "kp" && tmtTeks ? tanggalKalender(tmtTeks) : null,
    mkgTahun: jenis === "kp" ? angka(body.mkgTahunBaru) : null,
    mkgBulan: jenis === "kp" ? angka(body.mkgBulanBaru) : null,
  };
}

export async function tanganiUbahSkRiwayat(
  req: Request,
  params: Promise<{ id: string }>,
  jenis: "kp" | "pmk",
): Promise<NextResponse> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Hak yang sama dengan Catat KP/PMK.
  if (!canEditPegawai(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const riwayatId = teks(body.riwayatId);
  if (!riwayatId) return NextResponse.json({ error: "Riwayat tidak dipilih" }, { status: 400 });
  const tanggalTeks = teks(body.tanggalSK);
  const tanggalSK = tanggalTeks ? tanggalKalender(tanggalTeks) : null;
  if (tanggalTeks && !tanggalSK) return NextResponse.json({ error: "Tanggal SK tidak valid" }, { status: 400 });

  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const hasil = await ubahSkRiwayat({
    jenis,
    pegawai,
    riwayatId,
    isian: {
      nomorSK: teks(body.nomorSK),
      tanggalSK,
      penetapSK: teks(body.penetapSK) || null,
      jenisKp: teks(body.jenisKp),
      // Isian lanjutan hanya dilayani untuk Super Admin (ADR-118); dari peran lain diabaikan.
      luas: isSuperAdmin(session.user.role ?? "") && "keterangan" in body ? bacaIsianLuas(body, jenis) : undefined,
    },
    userId: pengguna.id,
    oleh: pengguna.nama,
  });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
  return NextResponse.json(hasil);
}

/** DELETE ?riwayatId=: hapus satu riwayat yang tercatat dua kali (ADR-069). */
export async function tanganiHapusRiwayatKembar(
  req: Request,
  params: Promise<{ id: string }>,
  jenis: "kp" | "pmk",
): Promise<NextResponse> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  const riwayatId = new URL(req.url).searchParams.get("riwayatId")?.trim() ?? "";
  if (!riwayatId) return NextResponse.json({ error: "Riwayat tidak dipilih" }, { status: 400 });
  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const hasil = await hapusRiwayatKembar({ jenis, pegawai, riwayatId, userId: pengguna.id });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
  return NextResponse.json(hasil);
}

/** DELETE ?riwayatId=&mode=bebas: hapus riwayat kenaikan pangkat mana pun yang tidak menopang data pegawai (ADR-118). */
export async function tanganiHapusRiwayatKpBebas(req: Request, params: Promise<{ id: string }>): Promise<NextResponse> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  const riwayatId = new URL(req.url).searchParams.get("riwayatId")?.trim() ?? "";
  if (!riwayatId) return NextResponse.json({ error: "Riwayat tidak dipilih" }, { status: 400 });
  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const hasil = await hapusRiwayatKpBebas({ pegawai, riwayatId, userId: pengguna.id });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
  return NextResponse.json(hasil);
}
