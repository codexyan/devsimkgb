// Penyelarasan SK dasar pada Data Pegawai (ADR-070): nomor, tanggal, dan pejabat penetap SK KGB terakhir (atau SK
// CPNS) yang dibetulkan lewat Ubah SK dasar ikut ke salinannya, dengan aturan yang sama dengan pembetulan data SK
// riwayat kenaikan pangkat dan PMK (lib/ubahSkRiwayat.ts, ADR-068):
// - KGB yang Atas dasarnya bernomor sama dan belum ditandatangani; jadwal yang belum diproses hanya mengikuti
//   penetapnya, dan hanya bila SK dasar ini memang SK terbaru (tidak ada kenaikan pangkat atau PMK sesudahnya);
// - pindaian SK KGB atau SK CPNS di arsip dokumen pegawai yang bernomor lama;
// - riwayat kenaikan pangkat atau PMK yang bernomor sama, dari data lama yang menyimpan SK kenaikan pangkat sebagai
//   SK dasar.
// SK KGB yang sudah ditandatangani tidak diubah.

import { db } from "./db";
import { ubahDaftarDokumenArsip } from "./dokumenPegawaiServer";
import { skKpLebihBaru } from "./kenaikanPangkat";
import { kunciNomorSk } from "./nomorSurat";
import { rencanaSelarasKgb, type DataSkRiwayat } from "./ubahSkRiwayat";
import { formatTanggalId, isoTanggalLokal, tanggalKalender } from "./waktu";
import type { PegawaiRow, RiwayatKGBRow, RiwayatPangkatRow, RiwayatPmkRow } from "./sheets/tables";

const samaTeks = (a: string | null | undefined, b: string | null | undefined) => (a?.trim() || null) === (b?.trim() || null);

/** Selaraskan salinan SK dasar sesudah Data Pegawai disimpan; mengembalikan kalimat untuk pengguna dan jejak audit. */
export async function selaraskanSkDasarPegawai(lama: PegawaiRow, baru: PegawaiRow): Promise<string[]> {
  const skLama: DataSkRiwayat = {
    nomorSK: lama.nomorSkDasar?.trim() ?? "",
    tanggalSK: tanggalKalender(lama.tanggalSkDasar),
    penetapSK: lama.penetapSkDasar?.trim() || null,
  };
  const skBaru: DataSkRiwayat = {
    nomorSK: baru.nomorSkDasar?.trim() ?? "",
    tanggalSK: tanggalKalender(baru.tanggalSkDasar),
    penetapSK: baru.penetapSkDasar?.trim() || null,
  };
  const berubah =
    skLama.nomorSK !== skBaru.nomorSK ||
    (skLama.tanggalSK?.getTime() ?? null) !== (skBaru.tanggalSK?.getTime() ?? null) ||
    !samaTeks(skLama.penetapSK, skBaru.penetapSK);
  // Tanpa nomor lama tidak ada salinan yang dapat dikenali; nomor baru yang kosong tidak disebarkan.
  if (!berubah || !kunciNomorSk(skLama.nomorSK) || !kunciNomorSk(skBaru.nomorSK)) return [];

  const selaras: string[] = [];
  const [kgb, kp, pmk] = await Promise.all([
    db.riwayatKGB.findMany({ where: { pegawaiId: baru.id } }) as Promise<RiwayatKGBRow[]>,
    db.riwayatPangkat.findMany({ where: { pegawaiId: baru.id } }) as Promise<RiwayatPangkatRow[]>,
    db.riwayatPmk.findMany({ where: { pegawaiId: baru.id } }) as Promise<RiwayatPmkRow[]>,
  ]);

  // SK dasar adalah SK terbaru bila tidak ada kenaikan pangkat atau PMK sesudah KGB terakhir.
  const adaSkSesudahnya = [...kp.map((r) => r.tmtPangkat), ...pmk.map((r) => r.tmtPmk)].some((tmt) =>
    skKpLebihBaru(tmt, kgb, baru.tmtKgbTerakhir),
  );
  const rencana = rencanaSelarasKgb(kgb, skLama, skBaru, !adaSkSesudahnya);
  for (const u of rencana.ubah) {
    await db.riwayatKGB.update({ id: u.id }, u.patch);
    const k = kgb.find((x) => x.id === u.id)!;
    selaras.push(`Atas dasar KGB TMT ${formatTanggalId(k.tmtKgbBaru)} ikut dibetulkan`);
  }
  for (const t of rencana.terkunci)
    selaras.push(`SK KGB TMT ${formatTanggalId(t.tmtKgbBaru)} sudah ditandatangani dengan data lama dan tidak diubah`);

  const tanggalLama = skLama.tanggalSK ? isoTanggalLokal(skLama.tanggalSK) : "";
  const tanggalBaru = skBaru.tanggalSK ? isoTanggalLokal(skBaru.tanggalSK) : "";
  const arsip = await ubahDaftarDokumenArsip(baru.id, (d) =>
    (d.jenis === "sk_kgb" || d.jenis === "sk_cpns") && kunciNomorSk(d.nomorSK) === kunciNomorSk(skLama.nomorSK)
      ? { ...d, nomorSK: skBaru.nomorSK, tanggalSK: !d.tanggalSK || d.tanggalSK === tanggalLama ? tanggalBaru : d.tanggalSK }
      : null,
  );
  if (arsip > 0) selaras.push(`${arsip} pindaian SK dasar di arsip dokumen ikut memakai data baru`);

  // Data lama yang menyimpan SK kenaikan pangkat atau PMK sebagai SK dasar: riwayatnya ikut dibetulkan supaya linimasa
  // tidak menampilkan dua versi SK yang sama.
  const patchRiwayat = { nomorSK: skBaru.nomorSK, tanggalSK: skBaru.tanggalSK, penetapSK: skBaru.penetapSK };
  for (const r of kp.filter((x) => kunciNomorSk(x.nomorSK) === kunciNomorSk(skLama.nomorSK))) {
    await db.riwayatPangkat.update({ id: r.id }, patchRiwayat);
    selaras.push(`Riwayat kenaikan pangkat SK ${skBaru.nomorSK} ikut dibetulkan`);
  }
  for (const r of pmk.filter((x) => kunciNomorSk(x.nomorSK) === kunciNomorSk(skLama.nomorSK))) {
    await db.riwayatPmk.update({ id: r.id }, patchRiwayat);
    selaras.push(`Riwayat PMK SK ${skBaru.nomorSK} ikut dibetulkan`);
  }
  return selaras;
}
