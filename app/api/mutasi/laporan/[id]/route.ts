import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canEditPegawai } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { newId } from "@/lib/sheets/id";
import { catatMutasi } from "@/lib/catatMutasi";
import { LABEL_JENIS_MUTASI, type JenisMutasi } from "@/lib/mutasiPegawai";
import { TIPE_NOTIFIKASI, notifikasiMutasiDikembalikan } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { muatKppnSatker } from "@/lib/muatKppnSatker";
import { SATKER, cariSatker } from "@/lib/satker";
import { formatTanggalId } from "@/lib/waktu";
import type { LaporanMutasiRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Tetapkan atau kembalikan satu laporan mutasi dari UPT.
 *
 * Menerima laporan berarti mencatatnya seperti Kanwil mencatat sendiri: satu baris riwayat mutasi dan
 * perubahan seperlunya pada data pegawai, lewat jalur yang sama (lib/catatMutasi.ts). Laporannya tetap
 * disimpan dan menunjuk ke baris riwayat yang terbit darinya, sehingga asal usulnya tetap terbaca.
 *
 * Mengembalikan tidak mengubah apa pun pada data pegawai; laporannya kembali ke UPT beserta catatan.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const peninjau = await penggunaLogin(session);
  if (!peninjau) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  const laporan = (await db.laporanMutasi.findUnique({ id })) as LaporanMutasiRow | null;
  if (!laporan) return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
  if (laporan.status === "diterima")
    return NextResponse.json({ error: "Laporan ini sudah ditetapkan" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as { aksi?: unknown; catatan?: unknown };
  const aksi = typeof body.aksi === "string" ? body.aksi : "";
  const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
  if (aksi !== "terima" && aksi !== "kembalikan")
    return NextResponse.json({ error: "Aksi harus terima atau kembalikan" }, { status: 400 });

  const pegawai = (await db.pegawai.findUnique({ id: laporan.pegawaiId })) as PegawaiRow | null;
  if (!pegawai) return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });

  const oleh = `${peninjau.nama} (${peninjau.nip})`;
  const sekarang = new Date();
  const label = LABEL_JENIS_MUTASI[laporan.jenis as JenisMutasi] ?? laporan.jenis;

  if (aksi === "kembalikan") {
    if (!catatan) return NextResponse.json({ error: "Catatan perbaikan wajib diisi" }, { status: 400 });
    await db.laporanMutasi.update(
      { id },
      { status: "dikembalikan", ditinjauOleh: oleh, ditinjauAt: sekarang, catatanKanwil: catatan },
    );
    await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.MUTASI_UPT, referenceId: id });
    try {
      await db.notifikasi.create({
        ...notifikasiMutasiDikembalikan(pegawai, catatan),
        id: newId(),
        dibaca: false,
        createdAt: sekarang,
      });
    } catch {
      // Laporannya sudah kembali ke UPT dan tampak pada dasbornya; loncengnya saja yang tidak jadi.
    }
    logAudit({
      userId: peninjau.id,
      aksi: "kembalikan_lapor_mutasi",
      detail: `Kembalikan laporan ${label} ${pegawai.nama} (${pegawai.nip}) ke ${laporan.satker}: ${catatan}`,
      targetNama: pegawai.nama,
    });
    return NextResponse.json({ ok: true, status: "dikembalikan" });
  }

  // Satker tujuan disimpan sebagai nama pada laporan; pencatatan menuntut kodenya.
  const kodeTujuan = laporan.satkerTujuan
    ? SATKER.find((s) => s.nama === laporan.satkerTujuan)?.kode ?? cariSatker(laporan.satkerTujuan)?.kode ?? null
    : null;
  if (laporan.satkerTujuan && !kodeTujuan)
    return NextResponse.json({ error: "Satker tujuan pada laporan tidak dikenal" }, { status: 409 });

  await muatKppnSatker();
  const { baris } = await catatMutasi(
    pegawai,
    {
      jenis: laporan.jenis as JenisMutasi,
      satkerTujuan: kodeTujuan,
      tmt: laporan.tmt ? new Date(laporan.tmt) : null,
      nomorSk: laporan.nomorSK,
      tanggalSk: laporan.tanggalSK ? new Date(laporan.tanggalSK) : null,
      alasan: laporan.alasan,
      keterangan: laporan.keterangan,
    },
    oleh,
    sekarang,
  );

  await db.laporanMutasi.update(
    { id },
    { status: "diterima", ditinjauOleh: oleh, ditinjauAt: sekarang, riwayatId: baris.id },
  );
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.MUTASI_UPT, referenceId: id });

  logAudit({
    userId: peninjau.id,
    aksi: "terima_lapor_mutasi",
    detail:
      `Terima laporan ${label} ${pegawai.nama} (${pegawai.nip}) dari ${laporan.satker}` +
      (laporan.satkerTujuan ? `, tujuan ${laporan.satkerTujuan}` : "") +
      (laporan.alasan ? `, alasan ${laporan.alasan}` : "") +
      `, TMT ${formatTanggalId(laporan.tmt)}, SK ${laporan.nomorSK ?? "-"}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true, status: "diterima", label });
}
