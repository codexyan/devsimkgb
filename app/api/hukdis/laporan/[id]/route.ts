import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { newId } from "@/lib/sheets/id";
import { catatHukdis } from "@/lib/catatHukdis";
import { PESAN_BELUM_AKTIF, tabelBelumAda } from "@/lib/laporanHukdisServer";
import { TIPE_NOTIFIKASI, notifikasiHukdisDikembalikan } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { LaporanHukdisRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Catat atau kembalikan satu laporan hukuman disiplin dari UPT (ADR-016).
 *
 * `terima` mencatat hukumannya persis seperti input hukdis oleh SDM Hukdis (lib/catatHukdis.ts): baris
 * riwayat hukdis, penanda pada pegawai, dan penggeseran KGB bila menunda. Isian yang dikirim adalah
 * nilai akhir peninjau, yang boleh berbeda dari ketikan UPT setelah dicocokkan dengan SK-nya. Laporannya
 * tetap disimpan dan menunjuk ke baris riwayat yang terbit darinya.
 *
 * `kembalikan` tidak mengubah apa pun pada data pegawai; laporannya kembali ke UPT beserta catatan.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak: hanya SDM Hukdis dan Super Admin" }, { status: 403 });

  const peninjau = await penggunaLogin(session);
  if (!peninjau) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  let laporan: LaporanHukdisRow | null;
  try {
    laporan = (await db.laporanHukdis.findUnique({ id })) as LaporanHukdisRow | null;
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ error: PESAN_BELUM_AKTIF }, { status: 503 });
    throw e;
  }
  if (!laporan) return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
  if (laporan.status !== "menunggu")
    return NextResponse.json(
      { error: laporan.status === "diterima" ? "Laporan ini sudah dicatat." : "Laporan ini sudah dikembalikan ke UPT." },
      { status: 409 },
    );

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const aksi = typeof body.aksi === "string" ? body.aksi : "";
  if (aksi !== "terima" && aksi !== "kembalikan")
    return NextResponse.json({ error: "Aksi harus terima atau kembalikan" }, { status: 400 });

  const pegawai = (await db.pegawai.findUnique({ id: laporan.pegawaiId })) as PegawaiRow | null;
  if (!pegawai) return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });

  const oleh = `${peninjau.nama} (${peninjau.nip})`;
  const sekarang = new Date();
  const namaSatker = SATKER.find((s) => s.kode === laporan.satker)?.nama ?? laporan.satker;

  if (aksi === "kembalikan") {
    const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
    if (!catatan) return NextResponse.json({ error: "Catatan perbaikan wajib diisi" }, { status: 400 });
    await db.laporanHukdis.update(
      { id },
      { status: "dikembalikan", ditinjauOleh: oleh, ditinjauAt: sekarang, catatanKanwil: catatan },
    );
    await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.HUKDIS_UPT, referenceId: id });
    try {
      await db.notifikasi.create({
        ...notifikasiHukdisDikembalikan(pegawai, catatan),
        id: newId(),
        dibaca: false,
        createdAt: sekarang,
      });
    } catch {
      // Laporannya sudah kembali ke UPT dan tampak pada modulnya; loncengnya saja yang tidak jadi.
    }
    logAudit({
      userId: peninjau.id,
      aksi: "kembalikan_lapor_hukdis",
      detail: `Kembalikan laporan hukuman disiplin ${pegawai.nama} (${pegawai.nip}) ke ${namaSatker}: ${catatan}`,
      targetNama: pegawai.nama,
    });
    return NextResponse.json({ ok: true, status: "dikembalikan" });
  }

  const hasil = await catatHukdis(pegawai.id, body, peninjau.id, `, dari laporan ${namaSatker}`);
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: hasil.status });

  await db.laporanHukdis.update(
    { id },
    { status: "diterima", ditinjauOleh: oleh, ditinjauAt: sekarang, riwayatId: hasil.hukdis.id, catatanKanwil: null },
  );
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.HUKDIS_UPT, referenceId: id });

  return NextResponse.json({
    ok: true,
    status: "diterima",
    labelJenis: hasil.labelJenis,
    tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
  });
}
