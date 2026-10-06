// Dokumen tiap SK pada linimasa SK penetap gaji pokok (ADR-066).
//
// Riwayat kenaikan pangkat dan PMK sengaja tidak menyimpan kunci berkas (ADR-028), jadi pindaiannya dicari menurut
// jenis dan nomor SK di dokumen pegawai: arsip dokumen yang diunggah Kanwil, dan berkas usulan UPT yang disetujui.
// SK KGB dari SIM-KGB ditautkan lewat KGB-nya: SK bertanda tangan bila sudah diunggah, selain itu draf cetakan
// SIM-KGB tanpa tanda tangan. Berkas formulir inventarisasi tidak dipakai, sebab modul itu akan dihapus (ADR-027).

import type { DokumenPegawai, JenisDokumen } from "./dokumenPegawai";
import type { JenisSkGaji, SkGaji } from "./linimasaDasarSk";
import { kunciNomorSk } from "./nomorSurat";

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
    const cocok = cariDokumenSk(sk.jenis, sk.nomorSK, dokumen);
    if (cocok) return cocok;
    // Arsip KGB tidak pernah dicetak SIM-KGB, jadi tidak punya draf cetakan.
    if (k && !k.isArsip && k.surat?.nomorSurat && k.surat.nomorSurat !== "-")
      return { jenis: "draf", kgbId: k.id, sumber: "Draf cetakan SIM-KGB, tanpa tanda tangan" };
    return null;
  }
  return cariDokumenSk(sk.jenis, sk.nomorSK, dokumen);
}

/**
 * Pindaian satu SK menurut jenis dan nomornya; dipakai linimasa dan baris riwayat kenaikan pangkat dan PMK di halaman
 * pegawai, supaya keduanya selalu menunjuk berkas yang sama.
 */
export function cariDokumenSk(
  jenisSk: JenisSkGaji,
  nomorSK: string | null | undefined,
  dokumen: readonly DokumenPegawai[],
): Extract<DokumenSk, { jenis: "berkas" }> | null {
  const jenis = JENIS_DOKUMEN_SK[jenisSk];
  const nomor = kunciNomorSk(nomorSK);
  if (!jenis || !nomor) return null;
  const calon = dokumen
    .filter(
      (d) =>
        d.jenis === jenis &&
        d.sumber in URUT_SUMBER &&
        kunciNomorSk(d.nomorSK) === nomor &&
        (d.sumber !== "usulan" || d.status === "disetujui"),
    )
    .sort((a, b) => URUT_SUMBER[a.sumber] - URUT_SUMBER[b.sumber] || b.tanggal.localeCompare(a.tanggal));
  const d = calon[0];
  return d ? { jenis: "berkas", url: d.url, sumber: SUMBER[d.sumber] } : null;
}

/** Dokumen seluruh SK pada linimasa, menurut kuncinya. */
export function dokumenLinimasa(
  sk: readonly SkGaji[],
  dokumen: readonly DokumenPegawai[],
  kgb: readonly KgbUntukDokumen[],
): Record<string, DokumenSk | null> {
  return Object.fromEntries(sk.map((s) => [s.kunci, dokumenSk(s, dokumen, kgb)]));
}
