// Atas dasar dan dokumen SK sebuah KGB di halaman pegawai (ADR-070). Murni, dipakai tab Riwayat KGB dan kartu Dasar
// KGB lewat app/dashboard/pegawai/[id]/riwayat/SinkronDasarKgb.tsx.

import { cariDokumenSk, type DokumenSk } from "./dokumenLinimasa";
import type { DokumenPegawai } from "./dokumenPegawai";
import type { LinimasaDasarSk, SkGaji } from "./linimasaDasarSk";
import { kunciNomorSk } from "./nomorSurat";
import { formatTanggalId } from "./waktu";

/** Linimasa secukupnya untuk membandingkan Atas dasar KGB. */
type DataLinimasaRingkas = { linimasa: Pick<LinimasaDasarSk, "dasar"> };

/** Satu SK sebagai teks: label, nomor, dan TMT. */
export const teksSk = (sk: Pick<SkGaji, "label" | "nomorSK" | "tmt">) =>
  `${sk.label}${sk.nomorSK ? ` ${sk.nomorSK}` : ""}${sk.tmt ? `, TMT ${formatTanggalId(sk.tmt)}` : ""}`;

/** Berkas yang dapat dibuka langsung. */
export type BerkasSk = Extract<DokumenSk, { jenis: "berkas" }>;

/** KGB pada riwayat, secukupnya untuk menautkan SK-nya dan Atas dasarnya. */
export interface KgbUntukSinkron {
  id: string;
  status: string;
  isArsip: boolean;
  nomorSK: string;
  tanggalSK: string | null;
  penetapSkDasar?: string | null;
  tmtKgbBaru: string;
  surat: { nomorSurat: string; tanggalSurat?: string | null; pathFile?: string | null } | null;
}

const nomorAda = (n: string | null | undefined) => !!n && n.trim() !== "" && n.trim() !== "-";

/** SK milik satu KGB: nomornya (SK baru, atau SK yang diarsipkan) beserta dokumennya. */
export function skKgb(
  k: KgbUntukSinkron,
  dokumen: readonly DokumenPegawai[] | null,
): { nomor: string | null; dok: DokumenSk | null } {
  const nomor = nomorAda(k.surat?.nomorSurat) ? k.surat!.nomorSurat : k.isArsip && nomorAda(k.nomorSK) ? k.nomorSK : null;
  if (k.surat?.pathFile)
    return {
      nomor,
      dok: {
        jenis: "berkas",
        url: `/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}`,
        sumber: k.isArsip ? "Berkas arsip KGB" : "SK bertanda tangan di SIM-KGB",
      },
    };
  const arsip = dokumen ? cariDokumenSk("kgb", nomor, dokumen) : null;
  if (arsip) return { nomor, dok: arsip };
  if (!k.isArsip && nomorAda(k.surat?.nomorSurat))
    return { nomor, dok: { jenis: "draf", kgbId: k.id, sumber: "Draf cetakan SIM-KGB, tanpa tanda tangan" } };
  return { nomor, dok: null };
}

/**
 * Dokumen SK yang menjadi Atas dasar sebuah KGB, dicari menurut nomornya: SK KGB di SIM-KGB lebih dulu, lalu pindaian
 * SK kenaikan pangkat, PMK, SK KGB, atau SK CPNS di dokumen pegawai.
 */
export function dokumenAtasDasar(
  nomor: string | null | undefined,
  kgb: readonly KgbUntukSinkron[],
  dokumen: readonly DokumenPegawai[] | null,
): DokumenSk | null {
  if (!nomorAda(nomor)) return null;
  const kunci = kunciNomorSk(nomor);
  const sumber = kgb.find((k) => kunciNomorSk(skKgb(k, null).nomor) === kunci);
  if (sumber) {
    const { dok } = skKgb(sumber, dokumen);
    if (dok) return dok;
  }
  if (!dokumen) return null;
  for (const jenis of ["kp", "pmk", "kgb", "cpns"] as const) {
    const d = cariDokumenSk(jenis, nomor, dokumen);
    if (d) return d;
  }
  return null;
}

/** Pesan bila Atas dasar yang tersalin pada KGB berjalan berbeda dari SK terbaru menurut linimasa. */
export function pesanAtasDasarBerbeda(k: KgbUntukSinkron, data: DataLinimasaRingkas | null | "gagal"): string | null {
  if (!data || data === "gagal" || !data.linimasa.dasar) return null;
  if (k.status !== "sedang_diproses" && k.status !== "belum_diproses") return null;
  const dasar = data.linimasa.dasar;
  if (!nomorAda(k.nomorSK)) return null;
  if (kunciNomorSk(k.nomorSK) === kunciNomorSk(dasar.nomorSK)) return null;
  return (
    `Atas dasar yang tersalin pada KGB ini masih SK ${k.nomorSK}, sedangkan SK terbaru sebelum TMT-nya menurut riwayat ` +
    `adalah ${teksSk(dasar)}. Buat SK memakai SK terbaru itu.`
  );
}
