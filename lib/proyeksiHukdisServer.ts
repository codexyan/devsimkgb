// Bagian server proyeksi hukdis (ADR-114, ADR-116): memuat laporan hukdis yang menunggu Kanwil beserta pegawai, KGB, dan
// katalog jenisnya, lalu menghitung perkiraan jadwal dengan lib/proyeksiHukdis.ts. Hanya membaca; tidak menulis apa pun.

import { db } from "./db";
import { cariDalam, pegawaiMenurutId } from "./dataSatker";
import { bacaTanggal, kgbBerjalanTerbaru } from "./dataPegawai";
import { proyeksiLaporanHukdis, tentukanDampakIsian, type JenisDampak, type ProyeksiHukdis } from "./proyeksiHukdis";
import { tabelBelumAda } from "./db/tabelBelumAda";
import type { LaporanHukdisRow, PegawaiRow, RiwayatKGBRow } from "./sheets/tables";

export interface ProyeksiLaporan {
  laporanId: string;
  proyeksi: ProyeksiHukdis;
}

type JenisKatalog = JenisDampak & { kode: string };

/**
 * Perkiraan jadwal KGB untuk tiap laporan di daftar ini, per id laporan. Laporan yang pegawainya tidak ditemukan dilewati.
 * Pemanggil menyaring statusnya; modul ini memperlakukan semuanya sebagai laporan yang menunggu.
 */
export async function proyeksiUntukLaporan(laporan: LaporanHukdisRow[], hariIni: Date): Promise<Map<string, ProyeksiHukdis>> {
  const hasil = new Map<string, ProyeksiHukdis>();
  if (laporan.length === 0) return hasil;

  const idPegawai = [...new Set(laporan.map((l) => l.pegawaiId))];
  const [pegawai, kgb, katalog] = await Promise.all([
    pegawaiMenurutId(idPegawai),
    cariDalam((where) => db.riwayatKGB.findMany({ where }) as Promise<RiwayatKGBRow[]>, "pegawaiId", idPegawai),
    db.hukdisJenis.findMany() as unknown as Promise<JenisKatalog[]>,
  ]);
  const pegawaiById = new Map(pegawai.map((p) => [p.id, p]));
  const jenisByKode = new Map(katalog.map((j) => [j.kode, j]));
  const kgbPerPegawai = new Map<string, RiwayatKGBRow[]>();
  for (const k of kgb) kgbPerPegawai.set(k.pegawaiId, [...(kgbPerPegawai.get(k.pegawaiId) ?? []), k]);

  for (const l of laporan) {
    const p = pegawaiById.get(l.pegawaiId);
    if (!p) continue;
    hasil.set(
      l.id,
      proyeksiLaporanHukdis({
        pegawai: p,
        kgbAktif: kgbBerjalanTerbaru(kgbPerPegawai.get(p.id) ?? []),
        laporan: { jenisHukdis: l.jenisHukdis, tmtMulai: l.tmtMulai },
        jenis: jenisByKode.get(l.jenisHukdis),
        hariIni,
      }),
    );
  }
  return hasil;
}

/** Perkiraan untuk semua laporan hukdis dari seluruh UPT yang masih menunggu Kanwil, per id laporan (sisi Kanwil). */
export async function proyeksiSemuaLaporanMenunggu(laporan: LaporanHukdisRow[], hariIni: Date): Promise<Map<string, ProyeksiHukdis>> {
  return proyeksiUntukLaporan(laporan.filter((l) => l.status === "menunggu"), hariIni);
}

/**
 * Perkiraan jadwal KGB untuk laporan hukdis satker ini yang masih menunggu Kanwil, per id pegawai. Satu pegawai hanya
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
  const perkiraan = await proyeksiUntukLaporan(laporan, hariIni);
  const hasil = new Map<string, ProyeksiLaporan>();
  for (const l of laporan) {
    const proyeksi = perkiraan.get(l.id);
    if (proyeksi) hasil.set(l.pegawaiId, { laporanId: l.id, proyeksi });
  }
  return hasil;
}

/**
 * Perkiraan jadwal KGB dari isian formulir hukdis Kanwil sebelum disimpan: jenis, TMT mulai, serta dampak dan lama
 * penundaan yang sedang diketik peninjau (kosong berarti mengikuti katalog jenisnya). Aturannya persis `catatHukdis`.
 * null bila pegawainya tidak ada, atau TMT mulainya belum terisi dengan tanggal yang valid.
 */
export async function proyeksiIsianHukdis(input: {
  pegawaiId: string;
  jenisHukdis: string;
  tmtMulai: unknown;
  berdampakKGB?: boolean;
  durasiTunda?: unknown;
  hariIni: Date;
}): Promise<ProyeksiHukdis | null> {
  const tmtMulai = bacaTanggal(input.tmtMulai);
  if (tmtMulai.status !== "valid") return null;
  const pegawai = (await db.pegawai.findUnique({ id: input.pegawaiId })) as PegawaiRow | null;
  if (!pegawai) return null;

  const jenis = (await db.hukdisJenis.findUnique({ kode: input.jenisHukdis })) as unknown as JenisDampak | null;
  const dampak = tentukanDampakIsian(input.jenisHukdis, jenis, { berdampakKGB: input.berdampakKGB, durasiTunda: input.durasiTunda });
  if (!dampak.ok) return { aksi: "tolak", alasan: dampak.alasan };
  if (!dampak.berdampakKGB) return { aksi: "tidak_menunda" };

  const riwayatKgb = (await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatKGBRow[];
  return proyeksiLaporanHukdis({
    pegawai,
    kgbAktif: kgbBerjalanTerbaru(riwayatKgb),
    laporan: { jenisHukdis: input.jenisHukdis, tmtMulai: tmtMulai.tanggal },
    // Dampak final sudah diputuskan di atas; jenis hanya meneruskannya.
    jenis: { berdampakKGB: true, durasiTunda: dampak.durasiTunda },
    hariIni: input.hariIni,
  });
}
