// Fungsi murni untuk form dan tampilan modal KGB.

import type { DataDasarSk, PegawaiKgb, RiwayatKgbItem } from "@/lib/kgbAksi";
import { kalkulasiKGB, type HasilKalkulasiKGB } from "@/lib/tabelGaji";
import { isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";

/** Identitas pegawai yang ditampilkan di kepala modal. */
export interface RingkasPegawai {
  nama: string;
  nip?: string | null;
}

/** Nilai awal bagian Atas Dasar SK Terakhir; tanggal boleh berupa nilai tersimpan (ISO) atau "yyyy-mm-dd". */
export interface DasarSkAwal {
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  tmtSK?: NilaiTanggal;
  penetapSkDasar?: string | null;
}

export function subjudulPegawai(pegawai: RingkasPegawai): string {
  const nip = pegawai.nip?.trim();
  return nip ? `${pegawai.nama} · NIP ${nip}` : pegawai.nama;
}

/** Nilai input type=date ("yyyy-mm-dd") dari tanggal tersimpan, dibaca sebagai tanggal kalender WITA. */
export function nilaiInputTanggal(value: NilaiTanggal): string {
  const tanggal = tanggalKalender(value);
  return tanggal ? isoTanggalLokal(tanggal) : "";
}

/** Nomor SK tersimpan untuk isian form; "-" (penanda surat tanpa nomor) dianggap kosong. */
export function nomorSkTerisi(nilai: string | null | undefined): string {
  const teks = nilai?.trim() ?? "";
  return teks === "-" ? "" : teks;
}

/** Tahun dari nilai input tanggal "yyyy-mm-dd"; null bila formatnya lain. */
export function tahunTanggalInput(nilai: string | null | undefined): number | null {
  const cocok = /^(\d{4})-\d{2}-\d{2}$/.exec(nilai?.trim() ?? "");
  return cocok ? Number(cocok[1]) : null;
}

/** Isian awal bagian Atas Dasar SK Terakhir dari data tersimpan. */
export function isianDasarSk(awal?: DasarSkAwal | null): DataDasarSk {
  return {
    nomorSK: nomorSkTerisi(awal?.nomorSK),
    tanggalSK: nilaiInputTanggal(awal?.tanggalSK),
    tmtSK: nilaiInputTanggal(awal?.tmtSK),
    penetapSkDasar: awal?.penetapSkDasar?.trim() ?? "",
  };
}

/** Data kartu pipeline /dashboard untuk isian awal Input KGB (tanggal tersimpan dalam format ISO). */
export interface DataDasarKartuKgb {
  statusKGB: string | null;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtSK: string | null;
  penetapSkDasar: string | null;
  prevNomorSK: string | null;
  prevTanggalSK: string | null;
  prevTmtSK: string | null;
  prevPenetapSkDasar: string | null;
}

/**
 * Isian awal Atas Dasar SK Terakhir untuk Input KGB: data KGB yang dibatalkan (Input Ulang KGB) bila
 * nomor SK-nya tersimpan, selain itu SK KGB yang terakhir selesai. null bila tidak ada data tersimpan.
 * Jadwal Belum Diproses yang dibatalkan tidak punya nomor SK; tanggal SK dan TMT SK-nya berisi TMT KGB
 * baru, jadi tidak dipakai.
 */
export function dasarAwalInputKgb(k: DataDasarKartuKgb): DasarSkAwal | null {
  if (k.statusKGB === "ditolak" && nomorSkTerisi(k.nomorSK)) {
    return { nomorSK: k.nomorSK, tanggalSK: k.tanggalSK, tmtSK: k.tmtSK, penetapSkDasar: k.penetapSkDasar };
  }
  if (!k.prevNomorSK && !k.prevTanggalSK && !k.prevTmtSK) return null;
  return { nomorSK: k.prevNomorSK, tanggalSK: k.prevTanggalSK, tmtSK: k.prevTmtSK, penetapSkDasar: k.prevPenetapSkDasar };
}

/** true bila keempat isian Atas Dasar SK Terakhir masih kosong. */
export function isianDasarKosong(isian: DataDasarSk): boolean {
  return !isian.nomorSK.trim() && !isian.tanggalSK && !isian.tmtSK && !isian.penetapSkDasar.trim();
}

/**
 * Isian awal Atas Dasar SK Terakhir dari riwayat KGB pegawai (GET /api/kgb?pegawaiId=): SK KGB yang
 * terakhir selesai menurut TMT, yaitu nomor dan tanggal SK baru beserta TMT-nya. Record arsip tanpa
 * nomor surat memakai kolom SK yang diarsipkan. Penetap diambil dari jadwal Belum Diproses (yang
 * dibuat dari penandatangan SK itu), atau dari record arsip. null bila tidak ada data.
 */
export function dasarAwalDariRiwayat(riwayat: ReadonlyArray<RiwayatKgbItem>): DasarSkAwal | null {
  let terakhir: RiwayatKgbItem | null = null;
  let tmtTerakhir: Date | null = null;
  for (const k of riwayat) {
    if (k.status !== "selesai") continue;
    const tmt = tanggalKalender(k.tmtKgbBaru);
    if (tmt && (!tmtTerakhir || tmt > tmtTerakhir)) {
      terakhir = k;
      tmtTerakhir = tmt;
    }
  }
  const penetapJadwal =
    riwayat.find((k) => k.status === "belum_diproses" && k.penetapSkDasar?.trim())?.penetapSkDasar?.trim() ?? null;
  if (!terakhir) return penetapJadwal ? { penetapSkDasar: penetapJadwal } : null;

  const nomorSurat = nomorSkTerisi(terakhir.surat?.nomorSurat);
  const arsip = terakhir.isArsip === true;
  const nomorSK = nomorSurat || (arsip ? nomorSkTerisi(terakhir.nomorSK) : "");
  const tanggalSK = nomorSurat ? terakhir.surat?.tanggalSurat : arsip && nomorSK ? terakhir.tanggalSK : null;
  return {
    nomorSK: nomorSK || null,
    tanggalSK: tanggalSK ?? null,
    tmtSK: arsip && tanggalKalender(terakhir.tmtSK) ? terakhir.tmtSK : terakhir.tmtKgbBaru,
    penetapSkDasar: penetapJadwal ?? (arsip ? terakhir.penetapSkDasar?.trim() || null : null),
  };
}

export function formatRupiah(nilai: number | null | undefined): string {
  if (typeof nilai !== "number" || !Number.isFinite(nilai)) return "-";
  return `Rp ${Math.round(nilai).toLocaleString("id-ID")}`;
}

export function formatMkg(tahun: number | null | undefined, bulan: number | null | undefined): string {
  if (typeof tahun !== "number" || !Number.isFinite(tahun)) return "-";
  return `${tahun} Tahun ${typeof bulan === "number" && Number.isFinite(bulan) ? bulan : 0} Bulan`;
}

/**
 * Pesan untuk bidang wajib yang masih kosong, misalnya "Lengkapi Nomor SK Terakhir dan Tanggal SK Terakhir."
 * Mengembalikan null bila semua terisi.
 */
export function pesanBidangWajib(
  bidang: ReadonlyArray<readonly [label: string, nilai: string | null | undefined]>,
): string | null {
  const kosong = bidang.filter(([, nilai]) => !nilai?.trim()).map(([label]) => label);
  if (kosong.length === 0) return null;
  if (kosong.length === 1) return `Lengkapi ${kosong[0]}.`;
  if (kosong.length === 2) return `Lengkapi ${kosong[0]} dan ${kosong[1]}.`;
  return `Lengkapi ${kosong.slice(0, -1).join(", ")}, dan ${kosong[kosong.length - 1]}.`;
}

/** Server hanya menerima berkas bertipe application/pdf. */
export function berkasPdfSah(berkas: { type: string } | null | undefined): boolean {
  return berkas?.type === "application/pdf";
}

export function formatUkuranBerkas(byte: number): string {
  if (!Number.isFinite(byte) || byte < 0) return "-";
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export type PerhitunganKgb = { ok: true; hasil: HasilKalkulasiKGB } | { ok: false; error: string };

/** Perhitungan KGB untuk pratinjau di modal, dengan rumus yang sama dengan POST /api/kgb. */
export function hitungKgbPegawai(
  pegawai: Pick<PegawaiKgb, "golonganRuang" | "mkgTahun" | "mkgBulan" | "tmtKgbBerikutnya" | "tmtKgbTerakhir">,
  hariIni?: Date,
): PerhitunganKgb {
  try {
    return {
      ok: true,
      hasil: kalkulasiKGB({
        golonganRuang: pegawai.golonganRuang,
        mkgTahun: Number(pegawai.mkgTahun),
        mkgBulan: Number(pegawai.mkgBulan),
        tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya,
        tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
        hariIni,
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Jadwal KGB pegawai tidak dapat dihitung" };
  }
}
