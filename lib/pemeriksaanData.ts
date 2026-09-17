// Pemeriksaan Data (Pengaturan, khusus Super Admin): aturan murni untuk menemukan data pegawai yang
// tidak konsisten. Hanya membaca; tidak ada data yang diubah. Tanggal dibandingkan sebagai tanggal
// kalender WITA (lib/waktu.ts), karena nilai yang sama bisa tersimpan sebagai tengah malam UTC atau WITA.

import { kgbBerjalanTerbaru } from "./dataPegawai";
import { cariSatker } from "./satker";
import { isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "./waktu";

export interface PegawaiDiperiksa {
  id: string;
  nama: string;
  nip: string;
  unitKerja: string | null;
  aktif: boolean;
  tmtKgbTerakhir: NilaiTanggal;
  tmtKgbBerikutnya: NilaiTanggal;
}

export interface KgbDiperiksa {
  pegawaiId: string;
  status: string;
  tmtKgbBaru: NilaiTanggal;
  createdAt: Date | null;
}

interface IdentitasPegawai {
  pegawaiId: string;
  nama: string;
  nip: string;
}

export interface TemuanUnitKerja extends IdentitasPegawai {
  unitKerja: string;
}

export interface TemuanTmtTerakhir extends IdentitasPegawai {
  aktif: boolean;
  /** "yyyy-mm-dd" tanggal WITA; null bila kosong atau tidak valid. */
  tmtKgbTerakhir: string | null;
  /** "yyyy-mm-dd" tanggal WITA menurut riwayat KGB. */
  tmtMenurutRiwayat: string;
  sumber: "selesai" | "berjalan";
}

export type MasalahTmtBerikutnya = "kosong" | "bukan_tanggal_1" | "tidak_sesudah_tmt_terakhir";

export interface TemuanTmtBerikutnya extends IdentitasPegawai {
  /** "yyyy-mm-dd" tanggal WITA; null bila kosong atau tidak valid. */
  tmtKgbBerikutnya: string | null;
  masalah: MasalahTmtBerikutnya;
}

export interface HasilPemeriksaanData {
  unitKerjaTidakDikenal: TemuanUnitKerja[];
  tmtKgbTerakhirTidakSesuai: TemuanTmtTerakhir[];
  tmtKgbBerikutnyaTidakValid: TemuanTmtBerikutnya[];
}

function isoAtauNull(nilai: NilaiTanggal): string | null {
  const tanggal = tanggalKalender(nilai);
  return tanggal ? isoTanggalLokal(tanggal) : null;
}

function identitas(p: PegawaiDiperiksa): IdentitasPegawai {
  return { pegawaiId: p.id, nama: p.nama, nip: p.nip };
}

/** true bila unit kerja terisi tetapi tidak cocok dengan satu pun dari 19 satker (lib/satker.ts). */
export function unitKerjaTidakDikenal(unitKerja: string | null | undefined): boolean {
  const teks = unitKerja?.trim() ?? "";
  return teks !== "" && !cariSatker(teks);
}

/**
 * TMT KGB terakhir yang semestinya tercatat pada data pegawai menurut riwayat KGB-nya:
 * TMT KGB berjalan (Sedang Diproses atau Menunggu Keuangan) yang paling baru dibuat, karena Input KGB
 * sudah menulisnya ke data pegawai; bila tidak ada, TMT KGB Selesai yang paling akhir (arsip termasuk).
 * null bila riwayat tidak memberi petunjuk (belum ada KGB Selesai maupun berjalan dengan TMT valid).
 */
export function tmtKgbTerakhirMenurutRiwayat(
  riwayat: KgbDiperiksa[],
): { tmt: Date; sumber: "selesai" | "berjalan" } | null {
  const berjalan = kgbBerjalanTerbaru(riwayat);
  const tmtBerjalan = berjalan ? tanggalKalender(berjalan.tmtKgbBaru) : null;
  if (tmtBerjalan) return { tmt: tmtBerjalan, sumber: "berjalan" };
  let terakhir: Date | null = null;
  for (const k of riwayat) {
    if (k.status !== "selesai") continue;
    const tmt = tanggalKalender(k.tmtKgbBaru);
    if (tmt && (!terakhir || tmt.getTime() > terakhir.getTime())) terakhir = tmt;
  }
  return terakhir ? { tmt: terakhir, sumber: "selesai" } : null;
}

/** Masalah pada TMT KGB berikutnya pegawai; null bila valid. TMT KGB selalu jatuh pada tanggal 1. */
export function masalahTmtKgbBerikutnya(p: Pick<PegawaiDiperiksa, "tmtKgbTerakhir" | "tmtKgbBerikutnya">): MasalahTmtBerikutnya | null {
  const berikutnya = tanggalKalender(p.tmtKgbBerikutnya);
  if (!berikutnya) return "kosong";
  if (berikutnya.getDate() !== 1) return "bukan_tanggal_1";
  const terakhir = tanggalKalender(p.tmtKgbTerakhir);
  if (terakhir && berikutnya.getTime() <= terakhir.getTime()) return "tidak_sesudah_tmt_terakhir";
  return null;
}

const urutNama = <T extends IdentitasPegawai>(a: T, b: T) => a.nama.localeCompare(b.nama, "id");

/**
 * Jalankan semua aturan pemeriksaan:
 * 1. pegawai aktif dengan unit kerja terisi yang tidak cocok dengan satker mana pun;
 * 2. pegawai (aktif maupun nonaktif) yang TMT KGB terakhirnya berbeda dengan yang ditunjukkan riwayat KGB;
 * 3. pegawai aktif tanpa TMT KGB berikutnya yang valid.
 */
export function periksaDataPegawai(pegawai: PegawaiDiperiksa[], riwayatKgb: KgbDiperiksa[]): HasilPemeriksaanData {
  const riwayatPerPegawai = new Map<string, KgbDiperiksa[]>();
  for (const k of riwayatKgb) {
    const daftar = riwayatPerPegawai.get(k.pegawaiId);
    if (daftar) daftar.push(k);
    else riwayatPerPegawai.set(k.pegawaiId, [k]);
  }

  const hasil: HasilPemeriksaanData = {
    unitKerjaTidakDikenal: [],
    tmtKgbTerakhirTidakSesuai: [],
    tmtKgbBerikutnyaTidakValid: [],
  };

  for (const p of pegawai) {
    if (p.aktif && unitKerjaTidakDikenal(p.unitKerja)) {
      hasil.unitKerjaTidakDikenal.push({ ...identitas(p), unitKerja: (p.unitKerja ?? "").trim() });
    }

    const menurutRiwayat = tmtKgbTerakhirMenurutRiwayat(riwayatPerPegawai.get(p.id) ?? []);
    if (menurutRiwayat) {
      const tercatat = tanggalKalender(p.tmtKgbTerakhir);
      if (!tercatat || tercatat.getTime() !== menurutRiwayat.tmt.getTime()) {
        hasil.tmtKgbTerakhirTidakSesuai.push({
          ...identitas(p),
          aktif: p.aktif,
          tmtKgbTerakhir: tercatat ? isoTanggalLokal(tercatat) : null,
          tmtMenurutRiwayat: isoTanggalLokal(menurutRiwayat.tmt),
          sumber: menurutRiwayat.sumber,
        });
      }
    }

    if (p.aktif) {
      const masalah = masalahTmtKgbBerikutnya(p);
      if (masalah) {
        hasil.tmtKgbBerikutnyaTidakValid.push({ ...identitas(p), tmtKgbBerikutnya: isoAtauNull(p.tmtKgbBerikutnya), masalah });
      }
    }
  }

  hasil.unitKerjaTidakDikenal.sort(urutNama);
  hasil.tmtKgbTerakhirTidakSesuai.sort(urutNama);
  hasil.tmtKgbBerikutnyaTidakValid.sort(urutNama);
  return hasil;
}
