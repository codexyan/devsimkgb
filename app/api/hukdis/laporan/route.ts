import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";
import { tabelBelumAda } from "@/lib/laporanHukdisServer";
import { namaAsliBerkas } from "@/lib/usulanPegawai";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { SATKER } from "@/lib/satker";
import type { LaporanHukdisRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

type JenisBaris = { kode: string; label: string | null };

/**
 * Laporan hukuman disiplin dari seluruh UPT untuk SDM Hukdis dan Super Admin (ADR-016). Yang menunggu
 * didahulukan; yang sudah dicatat tetap dikirim sebagai riwayat asal usul catatan hukdisnya.
 * `aktif: false` berarti tabelnya belum dibuat di basis data, dan daftarnya memang kosong.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  // ?pegawaiId= untuk tab Riwayat Hukdis di halaman pegawai: pindaian SK tiap hukdis yang tercatat dari laporan (ADR-071).
  const pegawaiId = new URL(req.url).searchParams.get("pegawaiId")?.trim() || null;
  let laporan: LaporanHukdisRow[];
  try {
    laporan = (await db.laporanHukdis.findMany(pegawaiId ? { where: { pegawaiId } } : undefined)) as LaporanHukdisRow[];
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ aktif: false, laporan: [] });
    throw e;
  }
  if (laporan.length === 0) return NextResponse.json({ aktif: true, laporan: [] });

  const [semuaPegawai, semuaJenis] = await Promise.all([
    db.pegawai.findMany() as Promise<PegawaiRow[]>,
    db.hukdisJenis.findMany() as Promise<JenisBaris[]>,
  ]);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));
  const labelJenis = new Map(semuaJenis.map((j) => [j.kode, j.label ?? j.kode]));
  const urutStatus: Record<string, number> = { menunggu: 0, dikembalikan: 1, diterima: 2 };

  const daftar = laporan
    .map((l) => {
      const p = pegawaiById.get(l.pegawaiId);
      const satker = SATKER.find((s) => s.kode === l.satker);
      return {
        id: l.id,
        pegawai: p
          ? { id: p.id, nama: p.nama, nip: p.nip, jabatan: p.jabatan, golonganRuang: p.golonganRuang, statusHukdis: !!p.statusHukdis }
          : null,
        satker: l.satker,
        satkerNama: satker?.nama ?? l.satker,
        jenisHukdis: l.jenisHukdis,
        jenisLabel: labelJenis.get(l.jenisHukdis) ?? l.jenisHukdis,
        nomorSK: l.nomorSK,
        tanggalSK: isoTanggalKalender(l.tanggalSK),
        tmtMulai: isoTanggalKalender(l.tmtMulai),
        tmtBerakhir: isoTanggalKalender(l.tmtBerakhir),
        keterangan: l.keterangan,
        berkas: l.pathBerkas ? { nama: namaAsliBerkas(l.pathBerkas), url: `/api/hukdis/laporan/${l.id}/berkas` } : null,
        status: l.status,
        catatanKanwil: l.catatanKanwil,
        dilaporkanOleh: l.dilaporkanOleh,
        dilaporkanAt: l.dilaporkanAt ? new Date(l.dilaporkanAt).toISOString() : null,
        ditinjauOleh: l.ditinjauOleh,
        ditinjauAt: l.ditinjauAt ? new Date(l.ditinjauAt).toISOString() : null,
        riwayatId: l.riwayatId ?? null,
      };
    })
    .sort(
      (a, b) =>
        (urutStatus[a.status] ?? 9) - (urutStatus[b.status] ?? 9) ||
        (a.status === "menunggu"
          ? (a.dilaporkanAt ?? "").localeCompare(b.dilaporkanAt ?? "")
          : (b.dilaporkanAt ?? "").localeCompare(a.dilaporkanAt ?? "")),
    );

  return NextResponse.json({ aktif: true, laporan: daftar });
}
