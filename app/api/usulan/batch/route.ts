import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { setujuiUsulan } from "@/lib/setujuiUsulan";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { PegawaiRow, UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/** Batas sekali jalan; menjaga satu permintaan tidak melampaui waktu jalan Worker. */
const BATAS_SEKALI = 200;

/**
 * Setujui banyak usulan sekaligus, biasanya seluruh usulan pada satu surat.
 *
 * Sejak UPT dapat mengunggah daftar pegawai sekaligus, satu surat dapat memuat ratusan nama. Meninjau
 * tiap nama satu per satu masih mungkin dan tetap disediakan, tetapi menyetujui seratus nama yang sudah
 * diperiksa bersama-sama tidak sepatutnya menuntut seratus kali tekan.
 *
 * Tiap usulan diterapkan sendiri lewat jalur yang sama dengan tinjauan satu per satu. Satu usulan yang
 * gagal tidak menggagalkan sisanya: yang berhasil tetap tersimpan, dan yang gagal dilaporkan berikut
 * sebabnya, sebab mengulang seluruh berkas karena satu NIP bentrok jauh lebih mahal.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const peninjau = await penggunaLogin(session);
  if (!peninjau) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Tidak ada usulan yang dipilih" }, { status: 400 });
  if (ids.length > BATAS_SEKALI)
    return NextResponse.json(
      { error: `Sekali jalan paling banyak ${BATAS_SEKALI} usulan. Setujui per surat atau per bagian.` },
      { status: 413 },
    );

  const oleh = `${peninjau.nama} (${peninjau.nip})`;
  const sekarang = new Date();
  const berhasil: string[] = [];
  const galat: string[] = [];
  const surat = new Set<string>();
  const satker = new Set<string>();

  // KGB berjalan yang ikut disesuaikan (ADR-011), dilaporkan ke peninjau.
  const penyesuaianKgb: string[] = [];
  for (const id of ids) {
    const usulan = (await db.usulanPegawai.findUnique({ id })) as UsulanPegawaiRow | null;
    if (!usulan) { galat.push(`Usulan ${id} tidak ditemukan`); continue; }

    const pegawaiLama = usulan.pegawaiId ? ((await db.pegawai.findUnique({ id: usulan.pegawaiId })) as PegawaiRow | null) : null;
    const nama = pegawaiLama?.nama ?? usulan.nama ?? usulan.nip ?? "-";
    if (usulan.status !== "menunggu") { galat.push(`${nama}: sudah ditinjau`); continue; }
    if (usulan.jenis !== "baru" && !pegawaiLama) { galat.push(`${nama}: data pegawainya tidak ditemukan`); continue; }

    const hasil = await setujuiUsulan(usulan, pegawaiLama, oleh, sekarang, peninjau.id);
    if (!hasil.ok) { galat.push(`${nama}: ${hasil.pesan}`); continue; }
    berhasil.push(nama);
    if (hasil.penyesuaianKgb) penyesuaianKgb.push(`${nama}: ${hasil.penyesuaianKgb}`);
    if (usulan.nomorSurat) surat.add(usulan.nomorSurat);
    satker.add(SATKER.find((s) => s.kode === usulan.satker)?.nama ?? usulan.satker ?? "-");
  }

  // Satu catatan untuk satu tindakan. Siapa meninjau apa tetap terbaca dari tiap baris usulannya,
  // yang masing-masing menyimpan peninjau dan waktunya.
  logAudit({
    userId: peninjau.id,
    aksi: "setujui_usulan_massal",
    detail:
      `Setujui ${berhasil.length} usulan sekaligus dari ${[...satker].join(", ") || "-"}` +
      (surat.size > 0 ? `, surat ${[...surat].join(", ")}` : "") +
      (galat.length > 0 ? `, ${galat.length} gagal` : ""),
    targetNama: [...satker].join(", ") || undefined,
  });

  return NextResponse.json({ berhasil: berhasil.length, gagal: galat.length, galat, penyesuaianKgb });
}
