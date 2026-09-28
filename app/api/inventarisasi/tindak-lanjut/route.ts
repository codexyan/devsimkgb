import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { db } from "@/lib/db";
import { bacaKegiatan, simpanTindakLanjut } from "@/lib/inventarisServer";
import { salinBerkasKeArsip } from "@/lib/dokumenPegawaiServer";
import { STATUS_SALIN_ARSIP } from "@/lib/dokumenPegawai";
import { LABEL_TINDAK_LANJUT, isStatusTindakLanjut } from "@/lib/pemutakhiranPegawai";

export const runtime = "nodejs";

/**
 * Catat tindak lanjut satu kiriman formulir: belum diperiksa, sesuai, perlu perbaikan, atau sudah diterapkan
 * (ADR-023). Badan: { kegiatan, nip, status, catatan }.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nip = typeof body.nip === "string" ? body.nip : "";
  const catatan = typeof body.catatan === "string" ? body.catatan.trim().slice(0, 500) : "";
  if (!/^\d{18}$/.test(nip)) return NextResponse.json({ error: "NIP tidak valid" }, { status: 400 });
  if (!isStatusTindakLanjut(body.status)) return NextResponse.json({ error: "Status tidak dikenal" }, { status: 400 });
  if (body.status === "perlu_perbaikan" && !catatan)
    return NextResponse.json({ error: "Tulis catatan apa yang perlu diperbaiki." }, { status: 400 });
  const kegiatan = await bacaKegiatan(typeof body.kegiatan === "string" ? body.kegiatan : "");
  if (!kegiatan) return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });

  const kiriman = await simpanTindakLanjut(kegiatan.id, nip, {
    status: body.status,
    catatan,
    oleh: pengguna.nama,
    at: new Date().toISOString(),
  });
  if (!kiriman) return NextResponse.json({ error: "Kiriman tidak ditemukan" }, { status: 404 });
  // Kiriman yang sudah diperiksa menjadikan SIM-KGB rujukan dokumen (ADR-024): berkasnya disalin ke arsip pegawai.
  let disalin = 0;
  if ((STATUS_SALIN_ARSIP as readonly string[]).includes(body.status)) {
    const pegawai = await db.pegawai.findUnique({ nip });
    if (pegawai) {
      disalin = await salinBerkasKeArsip(pegawai.id, kiriman.berkas, {
        oleh: pengguna.nama,
        keterangan: `Dari kiriman ${kegiatan.nama}`,
        nomorSK: kiriman.isian.nomorSkDasar ?? "",
      }).catch((err) => {
        console.error("[tindak-lanjut] berkas gagal disalin ke arsip:", err);
        return 0;
      });
    }
  }

  logAudit({
    userId: pengguna.id,
    aksi: "tindak_lanjut_inventarisasi",
    targetNama: kiriman.isian.nama,
    detail: `Kiriman ${kiriman.isian.nama} (${nip}) pada "${kegiatan.nama}": ${LABEL_TINDAK_LANJUT[body.status]}${catatan ? ` (${catatan})` : ""}${disalin > 0 ? `, ${disalin} berkas disalin ke arsip dokumen` : ""}`,
  });
  return NextResponse.json({ ok: true, tindakLanjut: kiriman.tindakLanjut, disalin });
}
