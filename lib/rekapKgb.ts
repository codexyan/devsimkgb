// Satu definisi hitungan KGB untuk dashboard, Data KGB, laporan, dan rekap keuangan.
// Modul ini murni (tanpa akses data) dan dapat dipakai di server maupun peramban.
//
// Aturan bersama:
// - KGB arsip (SK terbit di luar SIM-KGB) tidak dihitung.
// - Satu KGB = satu pegawai untuk satu TMT. Bila ada beberapa entri untuk TMT yang sama (misalnya
//   KGB dibatalkan lalu diinput ulang), hanya entri dengan tahap paling lanjut yang dihitung.
// - KGB dibatalkan yang sudah diganti (lihat tanpaBatalYangDiganti) tidak dihitung, termasuk bila
//   penggantinya memakai TMT lain atau berupa arsip.
// - Rapelan: selesai memakai keputusan keuangan (rapelanDitetapkan); sedang diproses dan menunggu
//   keuangan memakai flagRapelan yang tercatat saat input; belum diproses, dan dibatalkan yang belum
//   diinput ulang, memakai tanggal hari ini terhadap deadline SDM.
// Semua tanggal dibaca sebagai tanggal kalender WITA.

import { jendelaProsesKgb } from "./tabelGaji";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export interface KgbUntukRekap {
  id?: string | null;
  pegawaiId: string;
  status: string;
  tmtKgbBaru: NilaiTanggal;
  flagRapelan?: boolean | null;
  rapelanDitetapkan?: boolean | null;
  isArsip?: boolean | null;
  /** Entri Belum Diproses untuk pegawai yang belum punya record KGB aktif. */
  isVirtual?: boolean;
  konfirmasiKeuanganAt?: NilaiTanggal;
  createdAt?: NilaiTanggal;
}

export interface PegawaiUntukRekap {
  id: string;
  aktif: boolean;
  tmtKgbBerikutnya: NilaiTanggal;
}

export type StatusRapelan = "ditetapkan" | "berpotensi";

export interface RekapStatusKgb {
  /** Jumlah KGB (satu per pegawai per TMT), termasuk yang dibatalkan dan belum diinput ulang. */
  total: number;
  belumDiproses: number;
  sedangDiproses: number;
  menungguKeuangan: number;
  selesai: number;
  ditolak: number;
  /** Sedang diproses ditambah menunggu keuangan. */
  diproses: number;
  /** Selesai dan ditetapkan rapelan oleh keuangan. */
  rapelanDitetapkan: number;
  /** Belum selesai dan berpotensi rapelan. */
  berpotensiRapelan: number;
  /** Belum diinput (belum diproses, atau dibatalkan dan belum diinput ulang) dan deadline SDM sudah lewat. */
  terlambat: number;
}

export interface RekapBulanTmt {
  /** "yyyy-mm" menurut bulan TMT. */
  bulanTmt: string;
  /** Seluruh KGB bulan TMT ini, termasuk yang dibatalkan dan belum diinput ulang. */
  total: number;
  /** Selesai dikonfirmasi keuangan. */
  dikonfirmasi: number;
  menungguKeuangan: number;
  /** Belum sampai keuangan: belum diproses, sedang diproses, atau dibatalkan dan belum diinput ulang. */
  belumSampaiKeuangan: number;
  /** Dibatalkan dan belum diinput ulang; sudah termasuk dalam belumSampaiKeuangan. */
  dibatalkan: number;
  rapelanDitetapkan: number;
  /** Belum selesai dan berpotensi rapelan. */
  berpotensiRapelan: number;
  /** Tanggal konfirmasi keuangan paling akhir di bulan TMT ini, atau null. */
  konfirmasiTerakhir: Date | null;
}

export const STATUS_KGB_AKTIF = ["belum_diproses", "sedang_diproses", "menunggu_keuangan"] as const;

const URUTAN_TAHAP: Record<string, number> = {
  selesai: 5,
  menunggu_keuangan: 4,
  sedang_diproses: 3,
  ditolak: 2,
  belum_diproses: 1,
};

function tahap(k: KgbUntukRekap): number {
  const nilai = URUTAN_TAHAP[k.status] ?? 0;
  // Entri virtual kalah dari record nyata dengan status yang sama.
  return nilai * 2 + (k.isVirtual ? 0 : 1);
}

function waktu(nilai: NilaiTanggal): number {
  if (nilai === null || nilai === undefined || nilai === "") return 0;
  const t = new Date(nilai).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function duaDigit(n: number): string {
  return String(n).padStart(2, "0");
}

/** "yyyy-mm-dd" dari tanggal kalender WITA; null bila kosong atau tidak valid. */
export function kunciTanggal(nilai: NilaiTanggal): string | null {
  const t = tanggalKalender(nilai);
  return t ? `${t.getFullYear()}-${duaDigit(t.getMonth() + 1)}-${duaDigit(t.getDate())}` : null;
}

/**
 * Tanggal kalender WITA sebagai "yyyy-mm-ddT00:00:00.000Z" untuk respons API. Sepuluh karakter
 * pertamanya selalu tanggal kalender, dan new Date() di peramban WITA tetap jatuh pada tanggal itu.
 * null bila kosong atau tidak valid.
 */
export function isoTanggalKalender(nilai: NilaiTanggal): string | null {
  const kunci = kunciTanggal(nilai);
  return kunci ? `${kunci}T00:00:00.000Z` : null;
}

/** "yyyy-mm" dari tanggal kalender WITA; null bila kosong atau tidak valid. */
export function kunciBulanTmt(nilai: NilaiTanggal): string | null {
  const t = tanggalKalender(nilai);
  return t ? `${t.getFullYear()}-${duaDigit(t.getMonth() + 1)}` : null;
}

/** Tahun TMT menurut WITA; null bila TMT kosong atau tidak valid. */
export function tahunTmt(k: Pick<KgbUntukRekap, "tmtKgbBaru">): number | null {
  return tanggalKalender(k.tmtKgbBaru)?.getFullYear() ?? null;
}

/**
 * Daftar tanpa KGB dibatalkan yang sudah diganti: pegawai yang sama punya KGB sedang diproses atau
 * menunggu keuangan, atau record lain yang tidak dibatalkan (termasuk arsip dan placeholder) yang
 * dibuat sesudah pembatalan itu. Aturannya sama dengan tombol Input Ulang KGB di Data KGB. Entri
 * virtual bukan pengganti. Pakai pada daftar lengkap, sebelum arsip atau periode TMT disaring.
 */
export function tanpaBatalYangDiganti<T extends KgbUntukRekap>(daftar: readonly T[]): T[] {
  const pengganti = new Map<string, { berjalan: boolean; dibuatTerakhir: number }>();
  for (const k of daftar) {
    if (k.isVirtual || k.status === "ditolak") continue;
    const lama = pengganti.get(k.pegawaiId);
    pengganti.set(k.pegawaiId, {
      berjalan: (lama?.berjalan ?? false) || k.status === "sedang_diproses" || k.status === "menunggu_keuangan",
      dibuatTerakhir: Math.max(lama?.dibuatTerakhir ?? -Infinity, waktu(k.createdAt)),
    });
  }
  return daftar.filter((k) => {
    if (k.status !== "ditolak" || k.isVirtual) return true;
    const p = pengganti.get(k.pegawaiId);
    return !p || !(p.berjalan || p.dibuatTerakhir > waktu(k.createdAt));
  });
}

/**
 * Satu entri per pegawai per TMT, tanpa arsip dan tanpa KGB dibatalkan yang sudah diganti. Entri
 * dengan tahap paling lanjut dipilih (selesai, menunggu keuangan, sedang diproses, dibatalkan,
 * belum diproses); bila sama, record terbaru. Entri tanpa TMT yang valid tidak digabung. Urutan asal
 * dipertahankan.
 */
export function satuPerSiklus<T extends KgbUntukRekap>(daftar: readonly T[]): T[] {
  const terpilih = new Map<string, T>();
  const urutan: string[] = [];
  tanpaBatalYangDiganti(daftar).forEach((k, indeks) => {
    if (k.isArsip) return;
    const tmt = kunciTanggal(k.tmtKgbBaru);
    const kunci = tmt ? `${k.pegawaiId}|${tmt}` : `tanpa-tmt|${k.id ?? indeks}`;
    const lama = terpilih.get(kunci);
    if (!lama) {
      terpilih.set(kunci, k);
      urutan.push(kunci);
      return;
    }
    const lebihLanjut = tahap(k) > tahap(lama) || (tahap(k) === tahap(lama) && waktu(k.createdAt) > waktu(lama.createdAt));
    if (lebihLanjut) terpilih.set(kunci, k);
  });
  return urutan.map((kunci) => terpilih.get(kunci)!);
}

/**
 * Entri Belum Diproses untuk pegawai aktif yang punya TMT berikutnya tetapi belum punya record
 * KGB berstatus belum diproses, sedang diproses, atau menunggu keuangan (sama dengan GET /api/kgb).
 */
export function entriVirtual(
  pegawai: readonly PegawaiUntukRekap[],
  kgb: readonly Pick<KgbUntukRekap, "pegawaiId" | "status">[],
): KgbUntukRekap[] {
  const aktif = new Set<string>(STATUS_KGB_AKTIF);
  const punyaAktif = new Set(kgb.filter((k) => aktif.has(k.status)).map((k) => k.pegawaiId));
  return pegawai
    .filter((p) => p.aktif && !punyaAktif.has(p.id) && tanggalKalender(p.tmtKgbBerikutnya))
    .map((p) => ({
      id: null,
      pegawaiId: p.id,
      status: "belum_diproses",
      tmtKgbBaru: tanggalKalender(p.tmtKgbBerikutnya),
      flagRapelan: null,
      rapelanDitetapkan: null,
      isArsip: false,
      isVirtual: true,
    }));
}

/** Record KGB tanpa placeholder dan KGB dibatalkan milik pegawai yang tidak aktif, karena tidak akan diproses lagi. */
export function tanpaEntriPegawaiNonaktif<T extends KgbUntukRekap>(
  kgb: readonly T[],
  pegawai: readonly Pick<PegawaiUntukRekap, "id" | "aktif">[],
): T[] {
  const aktif = new Set(pegawai.filter((p) => p.aktif).map((p) => p.id));
  return kgb.filter((k) => aktif.has(k.pegawaiId) || (k.status !== "belum_diproses" && k.status !== "ditolak"));
}

/** Entri untuk rekap: record KGB (tanpa entri pegawai tidak aktif) ditambah entri virtual. */
export function entriRekapKgb<T extends KgbUntukRekap>(
  kgb: readonly T[],
  pegawai: readonly PegawaiUntukRekap[],
): (T | KgbUntukRekap)[] {
  return [...tanpaEntriPegawaiNonaktif(kgb, pegawai), ...entriVirtual(pegawai, kgb)];
}

/** Status rapelan satu entri menurut aturan bersama; null bila bukan rapelan. */
export function statusRapelan(
  k: Pick<KgbUntukRekap, "status" | "tmtKgbBaru" | "flagRapelan" | "rapelanDitetapkan">,
  hariIni?: Date,
): StatusRapelan | null {
  switch (k.status) {
    case "selesai":
      return k.rapelanDitetapkan === true ? "ditetapkan" : null;
    case "sedang_diproses":
    case "menunggu_keuangan":
      return k.flagRapelan === true ? "berpotensi" : null;
    case "belum_diproses":
      return jendelaProsesKgb(k.tmtKgbBaru, hariIni)?.flagRapelan ? "berpotensi" : null;
    default:
      return null;
  }
}

/**
 * Rapelan dan keterlambatan satu siklus KGB. Siklus yang belum diinput (belum diproses, atau
 * dibatalkan dan belum diinput ulang) memakai deadline SDM terhadap hari ini dan dianggap terlambat
 * bila deadline sudah lewat; status lain mengikuti statusRapelan dan tidak terlambat.
 * Pakai hanya untuk entri yang mewakili siklusnya (hasil satuPerSiklus atau pilihKgbSiklus).
 */
export function rapelanSiklus(
  k: Pick<KgbUntukRekap, "status" | "tmtKgbBaru" | "flagRapelan" | "rapelanDitetapkan">,
  hariIni?: Date,
): { rapelan: StatusRapelan | null; terlambat: boolean } {
  if (k.status === "belum_diproses" || k.status === "ditolak") {
    const lewat = jendelaProsesKgb(k.tmtKgbBaru, hariIni)?.flagRapelan === true;
    return { rapelan: lewat ? "berpotensi" : null, terlambat: lewat };
  }
  return { rapelan: statusRapelan(k, hariIni), terlambat: false };
}

/** Hitungan per status dari daftar entri; arsip dan entri ganda per TMT dibuang lebih dulu. */
export function hitungRekapStatus(daftar: readonly KgbUntukRekap[], hariIni?: Date): RekapStatusKgb {
  const hasil: RekapStatusKgb = {
    total: 0,
    belumDiproses: 0,
    sedangDiproses: 0,
    menungguKeuangan: 0,
    selesai: 0,
    ditolak: 0,
    diproses: 0,
    rapelanDitetapkan: 0,
    berpotensiRapelan: 0,
    terlambat: 0,
  };
  for (const k of satuPerSiklus(daftar)) {
    hasil.total++;
    if (k.status === "belum_diproses") hasil.belumDiproses++;
    else if (k.status === "sedang_diproses") hasil.sedangDiproses++;
    else if (k.status === "menunggu_keuangan") hasil.menungguKeuangan++;
    else if (k.status === "selesai") hasil.selesai++;
    else if (k.status === "ditolak") hasil.ditolak++;

    const { rapelan, terlambat } = rapelanSiklus(k, hariIni);
    if (rapelan === "ditetapkan") hasil.rapelanDitetapkan++;
    if (rapelan === "berpotensi") hasil.berpotensiRapelan++;
    if (terlambat) hasil.terlambat++;
  }
  hasil.diproses = hasil.sedangDiproses + hasil.menungguKeuangan;
  return hasil;
}

/**
 * Rekap per bulan TMT untuk dasar input Gaji Web, dihitung dari data KGB saat dibaca.
 * Arsip dan entri ganda dibuang. KGB yang dibatalkan dan belum diinput ulang masih harus diinput
 * ulang, sehingga tetap masuk total sebagai belum sampai keuangan. Diurutkan dari bulan TMT terbaru.
 */
export function rekapPerBulanTmt(daftar: readonly KgbUntukRekap[], hariIni?: Date): RekapBulanTmt[] {
  const perBulan = new Map<string, RekapBulanTmt>();
  for (const k of satuPerSiklus(daftar)) {
    const bulanTmt = kunciBulanTmt(k.tmtKgbBaru);
    if (!bulanTmt) continue;
    let r = perBulan.get(bulanTmt);
    if (!r) {
      r = {
        bulanTmt,
        total: 0,
        dikonfirmasi: 0,
        menungguKeuangan: 0,
        belumSampaiKeuangan: 0,
        dibatalkan: 0,
        rapelanDitetapkan: 0,
        berpotensiRapelan: 0,
        konfirmasiTerakhir: null,
      };
      perBulan.set(bulanTmt, r);
    }
    r.total++;
    if (k.status === "selesai") {
      r.dikonfirmasi++;
      const t = waktu(k.konfirmasiKeuanganAt);
      if (t && (!r.konfirmasiTerakhir || t > r.konfirmasiTerakhir.getTime())) r.konfirmasiTerakhir = new Date(t);
    } else if (k.status === "menunggu_keuangan") {
      r.menungguKeuangan++;
    } else {
      r.belumSampaiKeuangan++;
      if (k.status === "ditolak") r.dibatalkan++;
    }
    const { rapelan } = rapelanSiklus(k, hariIni);
    if (rapelan === "ditetapkan") r.rapelanDitetapkan++;
    if (rapelan === "berpotensi") r.berpotensiRapelan++;
  }
  return [...perBulan.values()].sort((a, b) => b.bulanTmt.localeCompare(a.bulanTmt));
}

export interface HasilPilihKgbSiklus<T> {
  /** Record KGB siklus berjalan (bukan arsip, bukan placeholder), atau null bila belum diinput. */
  kgbBerjalan: T | null;
  /** SK KGB selesai terakhir sebelum siklus berjalan (arsip ikut), untuk data SK terakhir. */
  selesaiSebelumnya: T | null;
}

/**
 * Pilih record KGB siklus berjalan seorang pegawai untuk pipeline dashboard.
 * - KGB yang sedang diproses atau menunggu keuangan selalu menjadi siklus berjalan.
 * - Bila masa input TMT berikutnya pegawai sudah dibuka, siklus berjalan adalah record dengan TMT
 *   itu (misalnya yang dibatalkan); bila tidak ada, KGB belum diinput (null), walaupun pegawai
 *   punya KGB selesai dari siklus sebelumnya.
 * - Bila masa input belum dibuka, record terbaru dengan TMT di tahun berjalan tetap ditampilkan
 *   (misalnya KGB yang selesai tahun ini); selain itu null.
 */
export function pilihKgbSiklus<T extends KgbUntukRekap>(input: {
  tmtKgbBerikutnya: NilaiTanggal;
  kgb: readonly T[];
  hariIni?: Date;
  tahun: number;
}): HasilPilihKgbSiklus<T> {
  const terbaru = (a: T, b: T) => waktu(b.createdAt) - waktu(a.createdAt);
  const nyata = input.kgb.filter((k) => !k.isVirtual);
  const bukanPlaceholder = nyata.filter((k) => !k.isArsip && k.status !== "belum_diproses").sort(terbaru);

  let kgbBerjalan: T | null =
    bukanPlaceholder.find((k) => k.status === "sedang_diproses" || k.status === "menunggu_keuangan") ?? null;

  if (!kgbBerjalan) {
    const tmtBerikutnya = kunciTanggal(input.tmtKgbBerikutnya);
    const jendela = jendelaProsesKgb(input.tmtKgbBerikutnya, input.hariIni);
    if (jendela && !jendela.isLocked) {
      kgbBerjalan = bukanPlaceholder.find((k) => kunciTanggal(k.tmtKgbBaru) === tmtBerikutnya) ?? null;
    } else {
      kgbBerjalan = bukanPlaceholder.find((k) => tahunTmt(k) === input.tahun) ?? null;
    }
  }

  const tmtBerjalan = kgbBerjalan ? tanggalKalender(kgbBerjalan.tmtKgbBaru) : tanggalKalender(input.tmtKgbBerikutnya);
  const selesaiSebelumnya =
    nyata
      .filter((k) => k !== kgbBerjalan && k.status === "selesai")
      .filter((k) => {
        const tmt = tanggalKalender(k.tmtKgbBaru);
        return !!tmt && (!tmtBerjalan || tmt < tmtBerjalan);
      })
      .sort((a, b) => waktu(tanggalKalender(b.tmtKgbBaru)) - waktu(tanggalKalender(a.tmtKgbBaru)))[0] ?? null;

  return { kgbBerjalan, selesaiSebelumnya };
}
