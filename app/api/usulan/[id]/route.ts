import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { setujuiUsulan } from "@/lib/setujuiUsulan";
import { TIPE_NOTIFIKASI, notifikasiUsulanRevisi } from "@/lib/generateNotifikasi";
import { newId } from "@/lib/sheets/id";
import type { PegawaiRow } from "@/lib/sheets/tables";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Tinjauan satu usulan data pegawai: setujui, atau kembalikan ke UPT untuk diperbaiki.
 *
 * Menyetujui menyalin kolom yang diusulkan ke data pegawai. Laporan hukuman disiplin tidak ikut
 * membuat catatan hukdis secara otomatis: penetapannya ada pada SDM Hukdis lewat modul Hukuman
 * Disiplin, karena butuh nomor SK dan penilaian dampaknya pada KGB. Usulan yang disetujui tetap
 * menyimpan laporan itu sebagai rujukan.
 *
 * Mengembalikan tidak menghapus apa pun: isian dan berkasnya tetap, statusnya menjadi "revisi", dan
 * usulan itu berpindah kembali ke daftar kerja UPT beserta catatan peninjau. Penolakan yang dulu ada
 * di sini dihapus karena selalu berujung sama: UPT mengetik ulang seluruh usulan dari nol. Usulan yang
 * memang tidak boleh lanjut pun dikembalikan, dengan catatan agar UPT menghapusnya.
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
  let catatan = "";
  try {
    const body = (await req.json()) as { aksi?: unknown; catatan?: unknown };
    if (typeof body.aksi === "string") aksi = body.aksi;
    if (typeof body.catatan === "string") catatan = body.catatan.trim();
  } catch {
    // body tidak valid diperlakukan sebagai aksi kosong
  }
  if (aksi !== "setujui" && aksi !== "kembalikan")
    return NextResponse.json({ error: "Aksi harus setujui atau kembalikan" }, { status: 400 });

  const pegawaiLama = usulan.pegawaiId ? await db.pegawai.findUnique({ id: usulan.pegawaiId }) : null;
  if (usulan.jenis !== "baru" && !pegawaiLama)
    return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });
  const namaUsulan = pegawaiLama?.nama ?? usulan.nama ?? "-";
  const nipUsulan = pegawaiLama?.nip ?? usulan.nip ?? "-";

  const oleh = `${peninjau.nama} (${peninjau.nip})`;
  const sekarang = new Date();

  if (aksi === "kembalikan") {
    if (!catatan)
      return NextResponse.json({ error: "Catatan perbaikan wajib diisi" }, { status: 400 });
    // Catatan peninjau menumpang kolom alasanTolak: isinya memang sama, yaitu sebab usulan tidak
    // diterima apa adanya, dan UPT membacanya di tempat yang sama pula.
    await db.usulanPegawai.update(
      { id },
      { status: "revisi", ditinjauOleh: oleh, ditinjauAt: sekarang, alasanTolak: catatan },
    );
    // Usulan ini tidak lagi menunggu Kanwil, jadi loncengnya ditutup di sini dan diganti lonceng UPT.
    await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_UPT, referenceId: id });
    try {
      await db.notifikasi.create({
        ...notifikasiUsulanRevisi({ id, satker: usulan.satker, nomorSurat: usulan.nomorSurat }, { nama: namaUsulan, nip: nipUsulan }, catatan),
        id: newId(),
        dibaca: false,
        createdAt: sekarang,
      });
    } catch {
      // Usulannya sudah kembali ke UPT dan tampak pada dasbornya; loncengnya saja yang tidak jadi.
    }
    logAudit({
      userId: peninjau.id,
      aksi: "kembalikan_usulan_pegawai",
      detail: `Kembalikan usulan ${usulan.jenis === "baru" ? "pegawai baru" : "data"} ${namaUsulan} (${nipUsulan}) ke ${usulan.satker} untuk diperbaiki, surat ${usulan.nomorSurat ?? "-"}: ${catatan}`,
      targetNama: namaUsulan,
    });
    return NextResponse.json({ ok: true, status: "revisi" });
  }

  const hasil = await setujuiUsulan(usulan, pegawaiLama as PegawaiRow | null, oleh, sekarang, peninjau.id);
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: 409 });

  logAudit({
    userId: peninjau.id,
    aksi: "setujui_usulan_pegawai",
    detail: `Setujui usulan ${usulan.jenis === "baru" ? "pegawai baru" : "data"} ${namaUsulan} (${nipUsulan}) dari ${usulan.satker}, surat ${usulan.nomorSurat}: ${hasil.ringkasPerubahan}${hasil.penyesuaianKgb ? `. KGB: ${hasil.penyesuaianKgb}` : ""}${hasil.hukdis ? `. Laporan hukuman disiplin: ${hasil.hukdis}` : ""}`,
    targetNama: namaUsulan,
  });

  return NextResponse.json({
    ok: true,
    status: "disetujui",
    jumlahPerubahan: hasil.jumlahPerubahan,
    // Pengingat untuk peninjau: hukdis tetap dicatat manual di modul Hukuman Disiplin.
    perluCatatHukdis: hasil.perluCatatHukdis,
    // Apa yang disesuaikan pada KGB berjalan, misalnya SK yang harus dibuat ulang (ADR-011).
    penyesuaianKgb: hasil.penyesuaianKgb,
  });
}
