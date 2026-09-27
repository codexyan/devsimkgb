import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB, isSuperAdmin } from "@/lib/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { newId } from "@/lib/sheets/id";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { TEMPLATE_BAWAAN, keadaanVersi, normalisasiTemplate, periksaTemplate } from "@/lib/templateSurat";
import { PESAN_TEMPLATE_BELUM_AKTIF, muatVersiTemplate } from "@/lib/templateSuratServer";
import { tabelBelumAda } from "@/lib/db/tabelBelumAda";

export const runtime = "nodejs";

/**
 * Versi template surat KGB (ADR-019). Super Admin dan Tim SDM KGB boleh membaca (Tim SDM hanya melihat dan
 * mempratinjau); hanya Super Admin yang membuat versi baru.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { belumAktif, versi } = await muatVersiTemplate();
  const keadaan = keadaanVersi(versi, hariIniWita());
  return NextResponse.json({
    belumAktif,
    bawaan: TEMPLATE_BAWAAN,
    versi: versi.map((v) => ({
      id: v.id,
      versi: v.versi,
      berlakuMulai: new Date(v.berlakuMulai as Date).toISOString(),
      catatan: v.catatan,
      dibuatOleh: v.dibuatOleh,
      dibuatAt: v.dibuatAt ? new Date(v.dibuatAt).toISOString() : null,
      keadaan: keadaan.get(v.id),
      isi: v.isi,
    })),
  });
}

/**
 * Simpan versi baru. Tanggal mulai berlaku tidak boleh sebelum hari ini: versi baru tidak boleh mengubah
 * rupa SK yang sudah terbit.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role ?? ""))
    return NextResponse.json({ error: "Hanya Super Admin yang dapat mengubah template surat" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { isi?: unknown; berlakuMulai?: unknown; catatan?: unknown };
  const isi = normalisasiTemplate(body.isi);
  const galat = periksaTemplate(isi);
  if (galat.length > 0) return NextResponse.json({ error: galat.join(" "), galat }, { status: 400 });

  const berlakuMulai = bacaTanggalInput(body.berlakuMulai);
  if (!berlakuMulai) return NextResponse.json({ error: "Tanggal mulai berlaku wajib diisi dan harus valid" }, { status: 400 });
  if (tanggalKalender(berlakuMulai)! < tanggalKalender(hariIniWita())!)
    return NextResponse.json(
      { error: "Tanggal mulai berlaku tidak boleh sebelum hari ini, agar SK yang sudah terbit tidak berubah." },
      { status: 400 },
    );
  const catatan = typeof body.catatan === "string" ? body.catatan.trim().slice(0, 500) : "";

  const { belumAktif, versi } = await muatVersiTemplate();
  if (belumAktif) return NextResponse.json({ error: PESAN_TEMPLATE_BELUM_AKTIF }, { status: 503 });
  const nomor = Math.max(0, ...versi.map((v) => v.versi)) + 1;

  try {
    await db.templateSurat.create({
      id: newId(),
      versi: nomor,
      berlakuMulai,
      isi: JSON.stringify(isi),
      catatan: catatan || null,
      dibuatOleh: `${pengguna.nama} (${pengguna.nip})`,
      dibuatAt: new Date(),
    });
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ error: PESAN_TEMPLATE_BELUM_AKTIF }, { status: 503 });
    throw e;
  }

  logAudit({
    userId: pengguna.id,
    aksi: "simpan_template_surat",
    detail: `Template surat KGB versi ${nomor} disimpan, berlaku mulai ${formatTanggalId(berlakuMulai)}${catatan ? `: ${catatan}` : ""}`,
    targetNama: `Template surat v${nomor}`,
  });
  return NextResponse.json({ ok: true, versi: nomor }, { status: 201 });
}
