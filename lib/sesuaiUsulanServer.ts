// Apakah SK KGB yang dibuat Kanwil sama dengan usulan UPT yang disetujui (ADR-082). Server: membaca usulan dan riwayat.

import { db } from "./db";
import { keadaanSesudahUsulan, rencanaKgbPratinjau, dasarSkPratinjau } from "./pratinjauSkUsulan";
import { bedaSkDenganUsulan, type BedaSk } from "./sesuaiUsulan";
import { tanggalKalender } from "./waktu";
import type { SuratKgbTersimpan } from "./prosesKgb";
import type { PegawaiRow, RiwayatKGBRow, RiwayatPangkatRow, RiwayatPmkRow, UsulanPegawaiRow } from "./sheets/tables";

export type HasilSesuaiUsulan = { sesuai: true; usulanId: string } | { sesuai: false; alasan: string; beda: BedaSk[] };

const waktu = (v: Date | string | null | undefined) => (v ? new Date(v).getTime() || 0 : 0);

/**
 * SK sesuai usulan bila: konfirmasi UPT untuk siklus KGB ini berasal dari usulan yang disetujui (TMT konfirmasi sama
 * dengan TMT KGB), dan golongan, masa kerja, gaji pokok lama dan baru, TMT, serta Atas dasar SK sama dengan hitungan
 * usulan itu. Usulan yang hitungannya tidak dapat disusun ulang dianggap berbeda, sehingga SK-nya tetap direview.
 */
export async function cekSesuaiUsulan(kgb: RiwayatKGBRow, pegawai: PegawaiRow): Promise<HasilSesuaiUsulan> {
  const tmt = tanggalKalender(kgb.tmtKgbBaru);
  const konfirmasi = tanggalKalender(pegawai.konfirmasiUptTmt);
  if (!tmt || !konfirmasi || tmt.getTime() !== konfirmasi.getTime())
    return { sesuai: false, alasan: "Belum ada usulan Anda yang disetujui Kanwil untuk KGB ini, jadi SK-nya perlu diperiksa seluruhnya.", beda: [] };

  const usulan = ((await db.usulanPegawai.findMany({ where: { pegawaiId: pegawai.id, status: "disetujui" } })) as UsulanPegawaiRow[]).sort(
    (a, b) => waktu(b.ditinjauAt) - waktu(a.ditinjauAt),
  )[0];
  if (!usulan)
    return { sesuai: false, alasan: "Usulan Anda untuk KGB ini tidak ditemukan, jadi SK-nya perlu diperiksa seluruhnya.", beda: [] };

  const keadaan = keadaanSesudahUsulan(usulan, usulan.jenis === "baru" ? null : pegawai, null);
  const rencana = keadaan.ok ? rencanaKgbPratinjau(keadaan.nilai) : null;
  if (!rencana?.ok)
    return { sesuai: false, alasan: "Hitungan dari usulan Anda tidak dapat disusun ulang, jadi SK-nya perlu diperiksa seluruhnya.", beda: [] };

  const [riwayatKgb, pangkat, pmk] = await Promise.all([
    db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } }) as Promise<RiwayatKGBRow[]>,
    db.riwayatPangkat.findMany({ where: { pegawaiId: pegawai.id } }) as Promise<RiwayatPangkatRow[]>,
    db.riwayatPmk.findMany({ where: { pegawaiId: pegawai.id } }) as Promise<RiwayatPmkRow[]>,
  ]);
  // KGB yang sedang dibuat SK-nya bukan calon Atas dasar dirinya sendiri.
  const lain = riwayatKgb.filter((k) => k.id !== kgb.id);
  const surat = lain.length
    ? ((await db.suratKGB.findMany({ where: { kgbId: { in: lain.map((k) => k.id) } } })) as SuratKgbTersimpan[])
    : [];
  const suratByKgb = new Map(surat.map((s) => [s.kgbId, s]));
  const dasar = dasarSkPratinjau({
    usulan,
    pegawaiLama: usulan.jenis === "baru" ? null : pegawai,
    tmtKgbBaru: rencana.nilai.tmtKgbBaru,
    kgb: lain.map((k) => ({ ...k, surat: suratByKgb.get(k.id) ?? null })),
    pangkat: pangkat.map((r) => ({ id: r.id, nomorSK: r.nomorSK, tanggalSK: r.tanggalSK, tmt: r.tmtPangkat, jenisKp: r.jenisKp, penetapSK: r.penetapSK })),
    pmk: pmk.map((r) => ({ id: r.id, nomorSK: r.nomorSK, tanggalSK: r.tanggalSK, tmt: r.tmtPmk, penetapSK: r.penetapSK })),
  });

  const beda = bedaSkDenganUsulan(kgb, { ...rencana.nilai, nomorSkDasar: dasar?.nomorSK ?? null });
  return beda.length === 0
    ? { sesuai: true, usulanId: usulan.id }
    : { sesuai: false, alasan: "SK yang dibuat Kanwil berbeda dari usulan Anda yang disetujui.", beda };
}
