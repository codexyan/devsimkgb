import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { bandingkanUsulan, perubahanPegawai, ringkasHukdisUsulan } from "@/lib/usulanPegawai";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Tinjauan satu usulan data pegawai: setujui atau tolak.
 *
 * Menyetujui menyalin kolom yang diusulkan ke data pegawai. Laporan hukuman disiplin tidak ikut
 * membuat catatan hukdis secara otomatis: penetapannya ada pada SDM Hukdis lewat modul Hukuman
 * Disiplin, karena butuh nomor SK dan penilaian dampaknya pada KGB. Usulan yang disetujui tetap
 * menyimpan laporan itu sebagai rujukan.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const peninjau = await penggunaLogin(session);
  if (!peninjau) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  const usulan = (await db.usulanPegawai.findUnique({ id })) as UsulanPegawaiRow | null;
  if (!usulan) return NextResponse.json({ error: "Usulan tidak ditemukan" }, { status: 404 });
  if (usulan.status !== "menunggu")
    return NextResponse.json({ error: "Usulan ini sudah ditinjau" }, { status: 409 });

  let aksi = "";
  let alasanTolak = "";
  try {
    const body = (await req.json()) as { aksi?: unknown; alasanTolak?: unknown };
    if (typeof body.aksi === "string") aksi = body.aksi;
    if (typeof body.alasanTolak === "string") alasanTolak = body.alasanTolak.trim();
  } catch {
    // body tidak valid diperlakukan sebagai aksi kosong
  }
  if (aksi !== "setujui" && aksi !== "tolak")
    return NextResponse.json({ error: "Aksi harus setujui atau tolak" }, { status: 400 });

  const pegawai = await db.pegawai.findUnique({ id: usulan.pegawaiId });
  if (!pegawai) return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });

  const oleh = `${peninjau.nama} (${peninjau.nip})`;
  const sekarang = new Date();

  if (aksi === "tolak") {
    if (!alasanTolak)
      return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
    await db.usulanPegawai.update({ id }, { status: "ditolak", ditinjauOleh: oleh, ditinjauAt: sekarang, alasanTolak });
    logAudit({
      userId: peninjau.id,
      aksi: "tolak_usulan_pegawai",
      detail: `Tolak usulan data ${pegawai.nama} (${pegawai.nip}) dari ${usulan.satker}, surat ${usulan.nomorSurat}: ${alasanTolak}`,
      targetNama: pegawai.nama,
    });
    return NextResponse.json({ ok: true, status: "ditolak" });
  }

  const perubahan = bandingkanUsulan(pegawai, usulan);
  const nilaiBaru = perubahanPegawai(usulan);
  if (Object.keys(nilaiBaru).length > 0) {
    await db.pegawai.update({ id: pegawai.id }, { ...nilaiBaru, updatedAt: sekarang });
  }
  await db.usulanPegawai.update({ id }, { status: "disetujui", ditinjauOleh: oleh, ditinjauAt: sekarang });

  const hukdis = ringkasHukdisUsulan(usulan);
  const ringkasPerubahan = perubahan.length > 0
    ? perubahan.map((p) => `${p.label} ${p.sekarang} → ${p.diusulkan}`).join("; ")
    : "tanpa perubahan kolom";
  logAudit({
    userId: peninjau.id,
    aksi: "setujui_usulan_pegawai",
    detail: `Setujui usulan data ${pegawai.nama} (${pegawai.nip}) dari ${usulan.satker}, surat ${usulan.nomorSurat}: ${ringkasPerubahan}${hukdis ? `. Laporan hukuman disiplin: ${hukdis}` : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({
    ok: true,
    status: "disetujui",
    jumlahPerubahan: perubahan.length,
    // Pengingat untuk peninjau: hukdis tetap dicatat manual di modul Hukuman Disiplin.
    perluCatatHukdis: !!usulan.hukdisAda,
  });
}
