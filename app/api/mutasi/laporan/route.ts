import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canEditPegawai } from "@/lib/auth";
import { LABEL_JENIS_MUTASI, type JenisMutasi } from "@/lib/mutasiPegawai";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { LaporanMutasiRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/** Laporan mutasi dari seluruh UPT; yang menunggu tinjauan didahulukan. */
export async function GET() {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const [laporan, semuaPegawai] = await Promise.all([
    db.laporanMutasi.findMany() as Promise<LaporanMutasiRow[]>,
    db.pegawai.findMany() as Promise<PegawaiRow[]>,
  ]);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));

  const daftar = laporan
    .map((l) => {
      const p = pegawaiById.get(l.pegawaiId);
      return {
        id: l.id,
        pegawaiId: l.pegawaiId,
        nama: p?.nama ?? "-",
        nip: p?.nip ?? "-",
        unitKerja: p?.unitKerja ?? SATKER.find((s) => s.kode === l.satker)?.nama ?? l.satker,
        jenis: l.jenis,
        label: LABEL_JENIS_MUTASI[l.jenis as JenisMutasi] ?? l.jenis,
        satkerTujuan: l.satkerTujuan,
        tmt: l.tmt ? new Date(l.tmt).toISOString() : null,
        nomorSK: l.nomorSK,
        tanggalSK: l.tanggalSK ? new Date(l.tanggalSK).toISOString() : null,
        alasan: l.alasan,
        keterangan: l.keterangan,
        status: l.status,
        catatanKanwil: l.catatanKanwil,
        dilaporkanOleh: l.dilaporkanOleh,
        dilaporkanAt: l.dilaporkanAt ? new Date(l.dilaporkanAt).toISOString() : null,
        ditinjauOleh: l.ditinjauOleh,
        ditinjauAt: l.ditinjauAt ? new Date(l.ditinjauAt).toISOString() : null,
      };
    })
    .sort((a, b) => {
      if ((a.status === "menunggu") !== (b.status === "menunggu")) return a.status === "menunggu" ? -1 : 1;
      return (b.dilaporkanAt ?? "").localeCompare(a.dilaporkanAt ?? "");
    });

  return NextResponse.json(daftar);
}
