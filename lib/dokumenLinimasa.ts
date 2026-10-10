// Dokumen tiap SK pada linimasa SK penetap gaji pokok (ADR-066).
//
// Riwayat kenaikan pangkat dan PMK sengaja tidak menyimpan kunci berkas (ADR-028), jadi pindaiannya dicari menurut
// jenis dan nomor SK di dokumen pegawai: arsip dokumen yang diunggah Kanwil, dan berkas usulan UPT yang disetujui.
// SK KGB dari SIM-KGB ditautkan lewat KGB-nya: SK bertanda tangan bila sudah diunggah, selain itu draf cetakan
// SIM-KGB tanpa tanda tangan.

import { JENIS_DOKUMEN, type DokumenPegawai, type JenisDokumen } from "./dokumenPegawai";
import type { JenisSkGaji, SkGaji } from "./linimasaDasarSk";
import { kunciNomorSk } from "./nomorSurat";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

/** Cara membuka dokumen satu SK. */
export type DokumenSk =
  | { jenis: "berkas"; url: string; sumber: string }
  /** SK KGB yang dibuat SIM-KGB tetapi belum diunggah bertanda tangan: dicetak ulang sebagai draf. */
  | { jenis: "draf"; kgbId: string; sumber: string };

/** KGB pada riwayat beserta suratnya, secukupnya untuk menautkan SK KGB. */
export interface KgbUntukDokumen {
  id: string;
  isArsip?: boolean;
  surat?: { nomorSurat?: string | null; pathFile?: string | null } | null;
}

const JENIS_DOKUMEN_SK: Partial<Record<JenisSkGaji, JenisDokumen>> = {
  kgb: "sk_kgb",
  kp: "sk_pangkat",
  pmk: "sk_pmk",
  cpns: "sk_cpns",
};

/** Urutan sumber bila beberapa berkas cocok: arsip yang diunggah Kanwil lebih dulu, lalu usulan UPT yang disetujui. */
const URUT_SUMBER: Record<string, number> = { sk_kgb: 0, arsip: 1, usulan: 2 };

const SUMBER: Record<string, string> = {
  sk_kgb: "SK bertanda tangan di SIM-KGB",
  arsip: "Arsip dokumen pegawai",
  usulan: "Berkas usulan UPT yang disetujui",
};

/** Dokumen satu SK, atau null bila belum ada pindaiannya. */
export function dokumenSk(sk: SkGaji, dokumen: readonly DokumenPegawai[], kgb: readonly KgbUntukDokumen[]): DokumenSk | null {
  if (sk.kunci.startsWith("kgb:")) {
    const k = kgb.find((x) => x.id === sk.kunci.slice(4));
    if (k?.surat?.pathFile) {
      const dok = dokumen.find((d) => d.id === `sk-${k.id}`);
      return {
        jenis: "berkas",
        url: dok?.url ?? `/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}`,
        sumber: k.isArsip ? "Berkas arsip KGB" : SUMBER.sk_kgb,
      };
    }
    const cocok = cariDokumenSk(sk.jenis, sk.nomorSK, dokumen, sk.tanggalSK);
    if (cocok) return cocok;
    // Arsip KGB tidak pernah dicetak SIM-KGB, jadi tidak punya draf cetakan.
    if (k && !k.isArsip && k.surat?.nomorSurat && k.surat.nomorSurat !== "-")
      return { jenis: "draf", kgbId: k.id, sumber: "Draf cetakan SIM-KGB, tanpa tanda tangan" };
    return null;
  }
  return cariDokumenSk(sk.jenis, sk.nomorSK, dokumen, sk.tanggalSK);
}

/**
 * Pindaian satu SK menurut jenis dan nomornya (ADR-066, ADR-071). Urutannya:
 * 1. nomor sama dan jenis sama;
 * 2. nomor sama dengan jenis lain, sebab nomor SK sudah cukup menunjuk satu SK dan jenis unggahan sering keliru pilih
 *    (mis. SK kenaikan pangkat yang diunggah sebagai SK KGB lewat Ubah SK dasar);
 * 3. jenis sama, tanpa nomor, dan tanggal SK sama.
 * Di antara yang setara: SK bertanda tangan, arsip yang diunggah Kanwil, lalu berkas usulan UPT yang disetujui.
 */
export function cariDokumenMenurutSk(
  jenis: JenisDokumen,
  nomorSK: string | null | undefined,
  dokumen: readonly DokumenPegawai[],
  tanggalSK?: NilaiTanggal,
): Extract<DokumenSk, { jenis: "berkas" }> | null {
  const nomor = kunciNomorSk(nomorSK);
  const tanggal = tanggalKalender(tanggalSK)?.getTime() ?? null;
  const sah = (d: DokumenPegawai) => d.sumber in URUT_SUMBER && (d.sumber !== "usulan" || d.status === "disetujui");
  const peringkat = (d: DokumenPegawai): number | null => {
    const nomorDok = kunciNomorSk(d.nomorSK);
    if (nomor && nomorDok === nomor) return d.jenis === jenis ? 0 : 1;
    if (!nomorDok && d.jenis === jenis && tanggal !== null && tanggalKalender(d.tanggal)?.getTime() === tanggal) return 2;
    return null;
  };
  const calon = dokumen
    .filter(sah)
    .map((d) => ({ d, p: peringkat(d) }))
    .filter((x): x is { d: DokumenPegawai; p: number } => x.p !== null)
    .sort((a, b) => a.p - b.p || URUT_SUMBER[a.d.sumber] - URUT_SUMBER[b.d.sumber] || b.d.tanggal.localeCompare(a.d.tanggal));
  const hasil = calon[0];
  if (!hasil) return null;
  const { d } = hasil;
  const lain = d.jenis && d.jenis !== jenis ? ` (diunggah sebagai ${JENIS_DOKUMEN[d.jenis]})` : "";
  return { jenis: "berkas", url: d.url, sumber: `${SUMBER[d.sumber]}${lain}` };
}

/**
 * Pindaian satu SK penetap gaji pokok; dipakai linimasa, baris riwayat kenaikan pangkat dan PMK, dan tab Riwayat KGB,
 * supaya semuanya selalu menunjuk berkas yang sama.
 */
export function cariDokumenSk(
  jenisSk: JenisSkGaji,
  nomorSK: string | null | undefined,
  dokumen: readonly DokumenPegawai[],
  tanggalSK?: NilaiTanggal,
): Extract<DokumenSk, { jenis: "berkas" }> | null {
  const jenis = JENIS_DOKUMEN_SK[jenisSk];
  return jenis ? cariDokumenMenurutSk(jenis, nomorSK, dokumen, tanggalSK) : null;
}

/** Dokumen seluruh SK pada linimasa, menurut kuncinya. */
export function dokumenLinimasa(
  sk: readonly SkGaji[],
  dokumen: readonly DokumenPegawai[],
  kgb: readonly KgbUntukDokumen[],
): Record<string, DokumenSk | null> {
  return Object.fromEntries(sk.map((s) => [s.kunci, dokumenSk(s, dokumen, kgb)]));
}
