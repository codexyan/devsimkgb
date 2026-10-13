// Bagian server proyeksi hukdis (ADR-114): memuat laporan hukdis satker yang menunggu Kanwil beserta pegawai, KGB, dan
// katalog jenisnya, lalu menghitung perkiraan jadwal dengan lib/proyeksiHukdis.ts. Hanya membaca; tidak menulis apa pun.

import { db } from "./db";
import { cariDalam, pegawaiMenurutId } from "./dataSatker";
import { kgbBerjalanTerbaru } from "./dataPegawai";
import { proyeksiLaporanHukdis, type JenisDampak, type ProyeksiHukdis } from "./proyeksiHukdis";
import { tabelBelumAda } from "./db/tabelBelumAda";
import type { LaporanHukdisRow, RiwayatKGBRow } from "./sheets/tables";

export interface ProyeksiLaporan {
  laporanId: string;
  proyeksi: ProyeksiHukdis;
}

/**
 * Perkiraan jadwal KGB untuk tiap laporan hukdis satker ini yang masih menunggu Kanwil, per id pegawai. Satu pegawai hanya
 * boleh punya satu laporan berjalan, jadi satu entri per pegawai. Kosong bila modul laporan hukdis belum aktif.
 */
export async function proyeksiLaporanMenunggu(satker: string, hariIni: Date): Promise<Map<string, ProyeksiLaporan>> {
  let laporan: LaporanHukdisRow[];
  try {
    laporan = (await db.laporanHukdis.findMany({ where: { satker, status: "menunggu" } })) as LaporanHukdisRow[];
  } catch (e) {
    if (!tabelBelumAda(e)) throw e;
    return new Map();
  }
  const hasil = new Map<string, ProyeksiLaporan>();
  if (laporan.length === 0) return hasil;

  const idPegawai = [...new Set(laporan.map((l) => l.pegawaiId))];
  const [pegawai, kgb, katalog] = await Promise.all([
    pegawaiMenurutId(idPegawai),
    cariDalam((where) => db.riwayatKGB.findMany({ where }) as Promise<RiwayatKGBRow[]>, "pegawaiId", idPegawai),
    db.hukdisJenis.findMany() as unknown as Promise<(JenisDampak & { kode: string })[]>,
  ]);
  const pegawaiById = new Map(pegawai.map((p) => [p.id, p]));
  const jenisByKode = new Map(katalog.map((j) => [j.kode, j]));
  const kgbPerPegawai = new Map<string, RiwayatKGBRow[]>();
  for (const k of kgb) kgbPerPegawai.set(k.pegawaiId, [...(kgbPerPegawai.get(k.pegawaiId) ?? []), k]);

  for (const l of laporan) {
    const p = pegawaiById.get(l.pegawaiId);
    if (!p) continue;
    hasil.set(l.pegawaiId, {
      laporanId: l.id,
      proyeksi: proyeksiLaporanHukdis({
        pegawai: p,
        kgbAktif: kgbBerjalanTerbaru(kgbPerPegawai.get(p.id) ?? []),
        laporan: { jenisHukdis: l.jenisHukdis, tmtMulai: l.tmtMulai },
        jenis: jenisByKode.get(l.jenisHukdis),
        hariIni,
      }),
    });
  }
  return hasil;
}
