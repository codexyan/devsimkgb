// Pembetulan data SK pada riwayat kenaikan pangkat dan PMK (ADR-068): nomor SK, tanggal SK, pejabat penetap
// ("Ditetapkan oleh"), dan jenis kenaikan pangkat.
//
// Keempatnya tidak ikut menghitung gaji pokok, masa kerja, atau jadwal KGB, jadi aman dibetulkan sesudah dicatat.
// Golongan, masa kerja, dan TMT tetap tidak dapat diubah dari sini, sebab hitungannya sudah diterapkan ke data
// pegawai dan KGB.
//
// Data SK yang sama tersalin ke beberapa tempat, jadi pembetulannya diselaraskan:
// - KGB yang Atas dasarnya SK ini dan belum ditandatangani (Sedang Diproses, atau jadwal yang belum diproses). SK
//   yang sudah ditandatangani tidak diubah, karena dokumennya sudah sah dengan isi lamanya.
// - SK dasar pada Data Pegawai, bila nomornya sama dengan nomor lama SK ini.
// - Pindaian di arsip dokumen pegawai, yang dicocokkan menurut nomor SK (ADR-066). Pindaian dari berkas usulan UPT
//   disalin ke arsip dengan nomor baru, sebab usulan yang disetujui tidak diubah.

import { db } from "./db";
import { logAudit } from "./auditLog";
import { newId } from "./sheets/id";
import { isJenisKp, JENIS_KP, skKpLebihBaru } from "./kenaikanPangkat";
import { kunciNomorSk } from "./nomorSurat";
import { suratSudahDibuat, type SuratKgbTersimpan } from "./prosesKgb";
import { daftarDokumenArsip, salinObjekKeArsip, ubahDaftarDokumenArsip } from "./dokumenPegawaiServer";
import { namaAsliBerkas } from "./usulanPegawai";
import { formatTanggalId, isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "./waktu";
import type { PegawaiRow, RiwayatKGBRow, RiwayatPangkatRow, RiwayatPmkRow, UsulanPegawaiRow } from "./sheets/tables";

export interface DataSkRiwayat {
  nomorSK: string;
  tanggalSK: Date | null;
  penetapSK: string | null;
}

/** KGB secukupnya untuk menentukan penyelarasannya. */
export interface KgbUntukSelaras {
  id: string;
  status: string;
  isArsip?: boolean | null;
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  penetapSkDasar?: string | null;
  tmtKgbBaru: NilaiTanggal;
}

export interface RencanaSelarasKgb {
  /** KGB yang Atas dasarnya ikut dibetulkan. */
  ubah: { id: string; patch: { nomorSK?: string; tanggalSK?: Date | null; penetapSkDasar?: string | null } }[];
  /** KGB yang SK-nya sudah ditandatangani dengan Atas dasar SK ini; dibiarkan. */
  terkunci: { id: string; tmtKgbBaru: NilaiTanggal }[];
}

const samaTanggal = (a: NilaiTanggal, b: NilaiTanggal) => (tanggalKalender(a)?.getTime() ?? null) === (tanggalKalender(b)?.getTime() ?? null);
const samaTeks = (a: string | null | undefined, b: string | null | undefined) => (a?.trim() || null) === (b?.trim() || null);

/**
 * KGB mana yang ikut dibetulkan. KGB yang Atas dasarnya bernomor sama dengan nomor lama SK ini dan belum ditandatangani
 * mengikuti seluruh pembetulan. Jadwal yang belum diproses tanpa nomor dasar hanya mengikuti penetapnya, dan hanya bila
 * SK ini memang SK terbaru (`skTerbaru`) serta penetapnya masih penetap lama, sama dengan aturan Catat KP/PMK.
 */
export function rencanaSelarasKgb(
  kgb: readonly KgbUntukSelaras[],
  lama: DataSkRiwayat,
  baru: DataSkRiwayat,
  skTerbaru: boolean,
): RencanaSelarasKgb {
  const hasil: RencanaSelarasKgb = { ubah: [], terkunci: [] };
  const nomorLama = kunciNomorSk(lama.nomorSK);
  const penetapBerubah = !samaTeks(lama.penetapSK, baru.penetapSK);
  for (const k of kgb) {
    if (k.isArsip) continue;
    const cocok = !!nomorLama && kunciNomorSk(k.nomorSK) === nomorLama;
    if (cocok && (k.status === "menunggu_keuangan" || k.status === "selesai")) {
      hasil.terkunci.push({ id: k.id, tmtKgbBaru: k.tmtKgbBaru });
      continue;
    }
    if (k.status !== "sedang_diproses" && k.status !== "belum_diproses") continue;
    const patch: RencanaSelarasKgb["ubah"][number]["patch"] = {};
    if (cocok) {
      if (k.nomorSK !== baru.nomorSK) patch.nomorSK = baru.nomorSK;
      if (!samaTanggal(lama.tanggalSK, baru.tanggalSK)) patch.tanggalSK = baru.tanggalSK;
      if (penetapBerubah) patch.penetapSkDasar = baru.penetapSK;
    } else if (k.status === "belum_diproses" && !k.nomorSK?.trim() && skTerbaru && penetapBerubah && samaTeks(k.penetapSkDasar, lama.penetapSK)) {
      patch.penetapSkDasar = baru.penetapSK;
    }
    if (Object.keys(patch).length > 0) hasil.ubah.push({ id: k.id, patch });
  }
  return hasil;
}

export type HasilUbahSkRiwayat =
  | { ok: true; berubah: boolean; ringkas: string; selaras: string[] }
  | { ok: false; status: number; pesan: string };

export interface IsianUbahSkRiwayat {
  nomorSK: string;
  tanggalSK: Date | null;
  penetapSK: string | null;
  /** Hanya kenaikan pangkat. */
  jenisKp?: string;
}

/** Betulkan data SK satu riwayat kenaikan pangkat (`jenis` "kp") atau PMK ("pmk"), lalu selaraskan salinannya. */
export async function ubahSkRiwayat(input: {
  jenis: "kp" | "pmk";
  pegawai: PegawaiRow;
  riwayatId: string;
  isian: IsianUbahSkRiwayat;
  userId: string;
  oleh: string;
}): Promise<HasilUbahSkRiwayat> {
  const { jenis, pegawai, isian } = input;
  const label = jenis === "kp" ? "SK kenaikan pangkat" : "SK PMK";
  const nomorSK = isian.nomorSK.trim();
  if (!nomorSK) return { ok: false, status: 400, pesan: `Nomor ${label} wajib diisi` };
  if (!isian.tanggalSK) return { ok: false, status: 400, pesan: `Tanggal ${label} wajib diisi` };
  if (jenis === "kp" && !isJenisKp(isian.jenisKp ?? "")) return { ok: false, status: 400, pesan: "Jenis kenaikan pangkat tidak dikenal" };

  const semua = (
    jenis === "kp"
      ? await db.riwayatPangkat.findMany({ where: { pegawaiId: pegawai.id } })
      : await db.riwayatPmk.findMany({ where: { pegawaiId: pegawai.id } })
  ) as (RiwayatPangkatRow | RiwayatPmkRow)[];
  const riwayat = semua.find((r) => r.id === input.riwayatId);
  if (!riwayat) return { ok: false, status: 404, pesan: "Riwayat tidak ditemukan" };
  // Nomor yang sama pada riwayat lain membuat pindaian dan Atas dasarnya tidak dapat dibedakan.
  const kembar = semua.find((r) => r.id !== riwayat.id && kunciNomorSk(r.nomorSK) === kunciNomorSk(nomorSK));
  if (kembar)
    return { ok: false, status: 409, pesan: `Nomor ${nomorSK} sudah dipakai riwayat ${label} lain pegawai ini. Periksa kembali nomornya.` };

  const lama: DataSkRiwayat = { nomorSK: riwayat.nomorSK, tanggalSK: tanggalKalender(riwayat.tanggalSK), penetapSK: riwayat.penetapSK ?? null };
  const baru: DataSkRiwayat = { nomorSK, tanggalSK: isian.tanggalSK, penetapSK: isian.penetapSK?.trim() || null };
  const jenisKpLama = jenis === "kp" ? (riwayat as RiwayatPangkatRow).jenisKp : null;
  const jenisKpBaru = jenis === "kp" ? (isian.jenisKp as string) : null;

  const beda: string[] = [];
  if (lama.nomorSK !== baru.nomorSK) beda.push(`nomor "${lama.nomorSK}" → "${baru.nomorSK}"`);
  if (!samaTanggal(lama.tanggalSK, baru.tanggalSK))
    beda.push(`tanggal ${lama.tanggalSK ? formatTanggalId(lama.tanggalSK) : "-"} → ${formatTanggalId(baru.tanggalSK)}`);
  if (!samaTeks(lama.penetapSK, baru.penetapSK)) beda.push(`ditetapkan oleh "${lama.penetapSK ?? "-"}" → "${baru.penetapSK ?? "-"}"`);
  if (jenisKpLama !== jenisKpBaru && jenisKpBaru)
    beda.push(`jenis ${isJenisKp(jenisKpLama ?? "") ? JENIS_KP[jenisKpLama as keyof typeof JENIS_KP] : jenisKpLama ?? "-"} → ${JENIS_KP[jenisKpBaru as keyof typeof JENIS_KP]}`);
  if (beda.length === 0) return { ok: true, berubah: false, ringkas: "Tidak ada data SK yang berubah.", selaras: [] };

  const patchRiwayat = { nomorSK: baru.nomorSK, tanggalSK: baru.tanggalSK, penetapSK: baru.penetapSK };
  if (jenis === "kp") await db.riwayatPangkat.update({ id: riwayat.id }, { ...patchRiwayat, jenisKp: jenisKpBaru as string });
  else await db.riwayatPmk.update({ id: riwayat.id }, patchRiwayat);

  const selaras: string[] = [];

  // KGB yang Atas dasarnya SK ini.
  const kgb = (await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatKGBRow[];
  const tmtSk = jenis === "kp" ? (riwayat as RiwayatPangkatRow).tmtPangkat : (riwayat as RiwayatPmkRow).tmtPmk;
  const rencana = rencanaSelarasKgb(kgb, lama, baru, skKpLebihBaru(tmtSk, kgb, pegawai.tmtKgbTerakhir));
  const buatUlang: string[] = [];
  for (const u of rencana.ubah) {
    await db.riwayatKGB.update({ id: u.id }, u.patch);
    const k = kgb.find((x) => x.id === u.id)!;
    const tmt = formatTanggalId(k.tmtKgbBaru);
    selaras.push(`Atas dasar KGB TMT ${tmt} ikut dibetulkan`);
    if (k.status === "sedang_diproses" && suratSudahDibuat((await db.suratKGB.findUnique({ kgbId: k.id })) as SuratKgbTersimpan | null))
      buatUlang.push(tmt);
  }
  if (buatUlang.length > 0) selaras.push(`SK KGB TMT ${buatUlang.join(", ")} yang sudah dibuat perlu dibuat ulang agar memuat data baru`);
  for (const t of rencana.terkunci)
    selaras.push(`SK KGB TMT ${formatTanggalId(t.tmtKgbBaru)} sudah ditandatangani dengan data lama dan tidak diubah`);

  // SK dasar pada Data Pegawai yang menunjuk SK ini.
  if (kunciNomorSk(pegawai.nomorSkDasar) && kunciNomorSk(pegawai.nomorSkDasar) === kunciNomorSk(lama.nomorSK)) {
    await db.pegawai.update(
      { id: pegawai.id },
      { nomorSkDasar: baru.nomorSK, tanggalSkDasar: baru.tanggalSK, penetapSkDasar: baru.penetapSK, updatedAt: new Date() },
    );
    selaras.push("SK dasar pada Data Pegawai ikut dibetulkan");
  }

  // Pindaian di arsip dokumen pegawai, dicocokkan menurut jenis dan nomor (ADR-066).
  const jenisDok = jenis === "kp" ? "sk_pangkat" : "sk_pmk";
  const tanggalLamaIsian = lama.tanggalSK ? isoTanggalLokal(lama.tanggalSK) : "";
  const tanggalBaruIsian = baru.tanggalSK ? isoTanggalLokal(baru.tanggalSK) : "";
  const diperbarui = await ubahDaftarDokumenArsip(pegawai.id, (d) =>
    d.jenis === jenisDok && kunciNomorSk(d.nomorSK) === kunciNomorSk(lama.nomorSK)
      ? { ...d, nomorSK: baru.nomorSK, tanggalSK: !d.tanggalSK || d.tanggalSK === tanggalLamaIsian ? tanggalBaruIsian : d.tanggalSK }
      : null,
  );
  if (diperbarui > 0) selaras.push(`${diperbarui} pindaian di arsip dokumen ikut memakai data baru`);

  // Pindaian dari berkas usulan UPT yang disetujui: usulannya tidak diubah, jadi berkasnya disalin ke arsip dengan
  // nomor baru supaya tetap tercocokkan.
  if (diperbarui === 0 && kunciNomorSk(lama.nomorSK) !== kunciNomorSk(baru.nomorSK)) {
    const arsip = await daftarDokumenArsip(pegawai.id);
    const sudahAda = arsip.some((d) => d.jenis === jenisDok && kunciNomorSk(d.nomorSK) === kunciNomorSk(baru.nomorSK));
    const usulan = (await db.usulanPegawai.findMany({ where: { pegawaiId: pegawai.id, status: "disetujui" } })) as UsulanPegawaiRow[];
    const asal = usulan.find(
      (u) => u.dasarBaruJenis === jenis && kunciNomorSk(u.dasarBaruNomorSk) === kunciNomorSk(lama.nomorSK) && (jenis === "kp" ? u.pathSkPangkat : u.pathSkPmk),
    );
    const kunciAsal = asal ? (jenis === "kp" ? asal.pathSkPangkat : asal.pathSkPmk) : null;
    if (!sudahAda && kunciAsal && !arsip.some((d) => d.asal === kunciAsal)) {
      const tersalin = await salinObjekKeArsip(pegawai.id, kunciAsal, {
        id: newId(),
        jenis: jenisDok,
        nomorSK: baru.nomorSK,
        tanggalSK: tanggalBaruIsian,
        keterangan: `Disalin dari berkas usulan UPT${asal?.nomorSurat ? ` surat ${asal.nomorSurat}` : ""} saat nomor SK riwayat dibetulkan`,
        namaBerkas: namaAsliBerkas(kunciAsal) ?? `${label} ${baru.nomorSK}.pdf`,
        ukuran: 0,
        diunggahOleh: input.oleh,
        diunggahAt: new Date().toISOString(),
        asal: kunciAsal,
      });
      if (tersalin) selaras.push("Pindaian dari berkas usulan UPT disalin ke arsip dokumen dengan nomor baru");
    }
  }

  const ringkas = `Betulkan ${label} ${pegawai.nama} (${pegawai.nip}): ${beda.join("; ")}`;
  logAudit({
    userId: input.userId,
    aksi: jenis === "kp" ? "ubah_sk_kenaikan_pangkat" : "ubah_sk_pmk",
    targetNama: pegawai.nama,
    detail: selaras.length > 0 ? `${ringkas}. ${selaras.join(". ")}.` : `${ringkas}.`,
  });
  return { ok: true, berubah: true, ringkas, selaras };
}
