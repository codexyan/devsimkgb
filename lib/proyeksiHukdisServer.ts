// Bagian server proyeksi hukdis (ADR-114, ADR-116): memuat laporan hukdis yang menunggu Kanwil beserta pegawai, KGB, dan
// katalog jenisnya, lalu menghitung perkiraan jadwal dengan lib/proyeksiHukdis.ts. Hanya membaca; tidak menulis apa pun.

import { db } from "./db";
import { cariDalam, pegawaiMenurutId } from "./dataSatker";
import { bacaTanggal, kgbBerjalanTerbaru } from "./dataPegawai";
import { susunLinimasaHukdis, type LinimasaHukdis } from "./linimasaHukdis";
import { proyeksiLaporanHukdis, tentukanDampakIsian, type JenisDampak, type ProyeksiHukdis } from "./proyeksiHukdis";
import { tabelBelumAda } from "./db/tabelBelumAda";
import { tanggalKalender } from "./waktu";
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

export interface PerkiraanIsian {
  proyeksi: ProyeksiHukdis;
  /** Linimasa perhitungan dua jalur; null bila hukumannya tidak menggeser jadwal, atau hitungannya tidak mungkin. */
  linimasa: LinimasaHukdis | null;
}

/**
 * Perkiraan jadwal KGB dari isian formulir hukdis Kanwil sebelum disimpan: jenis, TMT mulai, serta dampak dan lama
 * penundaan yang sedang diketik peninjau (kosong berarti mengikuti katalog jenisnya). Aturannya persis `catatHukdis`.
 * Bila hukumannya menggeser jadwal, ikut linimasa perhitungannya (ADR-116).
 * null bila pegawainya tidak ada, atau TMT mulainya belum terisi dengan tanggal yang valid.
 */
export async function proyeksiIsianHukdis(input: {
  pegawaiId: string;
  jenisHukdis: string;
  tmtMulai: unknown;
  tmtBerakhir?: unknown;
  berdampakKGB?: boolean;
  durasiTunda?: unknown;
  hariIni: Date;
}): Promise<PerkiraanIsian | null> {
  const tmtMulai = bacaTanggal(input.tmtMulai);
  if (tmtMulai.status !== "valid") return null;
  const pegawai = (await db.pegawai.findUnique({ id: input.pegawaiId })) as PegawaiRow | null;
  if (!pegawai) return null;

  const jenis = (await db.hukdisJenis.findUnique({ kode: input.jenisHukdis })) as unknown as JenisDampak | null;
  const dampak = tentukanDampakIsian(input.jenisHukdis, jenis, { berdampakKGB: input.berdampakKGB, durasiTunda: input.durasiTunda });
  if (!dampak.ok) return { proyeksi: { aksi: "tolak", alasan: dampak.alasan }, linimasa: null };
  if (!dampak.berdampakKGB) return { proyeksi: { aksi: "tidak_menunda" }, linimasa: null };

  const riwayatKgb = (await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatKGBRow[];
  const kgbAktif = kgbBerjalanTerbaru(riwayatKgb);
  const proyeksi = proyeksiLaporanHukdis({
    pegawai,
    kgbAktif,
    laporan: { jenisHukdis: input.jenisHukdis, tmtMulai: tmtMulai.tanggal },
    // Dampak final sudah diputuskan di atas; jenis hanya meneruskannya.
    jenis: { berdampakKGB: true, durasiTunda: dampak.durasiTunda },
    hariIni: input.hariIni,
  });
  if (proyeksi.aksi !== "geser") return { proyeksi, linimasa: null };

  // Dasar hitung linimasa: KGB yang sedang berjalan bila ada (yang digeser siklus sesudahnya), selain itu pegawai dengan
  // TMT KGB terakhir yang akan tersimpan.
  const tmtAktif = kgbAktif ? tanggalKalender(kgbAktif.tmtKgbBaru) : null;
  const dasar =
    kgbAktif && tmtAktif
      ? {
          golonganRuang: kgbAktif.golonganBaru,
          mkgTahun: kgbAktif.mkgTahunBaru,
          mkgBulan: kgbAktif.mkgBulanBaru,
          gajiPokok: kgbAktif.gajiPokokBaru,
          tmtKgbTerakhir: tmtAktif,
        }
      : {
          golonganRuang: pegawai.golonganRuang,
          mkgTahun: pegawai.mkgTahun,
          mkgBulan: pegawai.mkgBulan,
          gajiPokok: pegawai.gajiPokok,
          tmtKgbTerakhir: proyeksi.tmtKgbTerakhir,
        };
  const tmtBerakhir = bacaTanggal(input.tmtBerakhir);
  return {
    proyeksi,
    linimasa: susunLinimasaHukdis({
      dasar,
      acuanBerjalan: !!(kgbAktif && tmtAktif),
      tmtSebelum: proyeksi.tmtSebelum,
      tmtBaru: proyeksi.tmtBaru,
      bulan: proyeksi.bulan,
      hukuman: { mulai: tmtMulai.tanggal, berakhir: tmtBerakhir.status === "valid" ? tmtBerakhir.tanggal : null },
    }),
  };
}
