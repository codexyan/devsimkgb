// Hapus satu riwayat kenaikan pangkat mana pun oleh Super Admin (ADR-118), selama bukan riwayat yang menopang data
// pegawai (lib/riwayatPenopang.ts). Data pegawai tidak berubah. KGB yang masih menyebut nomor SK-nya diberitahukan,
// bukan diubah.
//
// Riwayat yang tercatat dua kali dengan angka persis sama tetap bisa dihapus Tim SDM lewat lib/ubahSkRiwayat.ts
// (hapusRiwayatKembar, ADR-069).

import { db } from "./db";
import { logAudit } from "./auditLog";
import { isJenisKp, JENIS_KP } from "./kenaikanPangkat";
import { kunciNomorSk } from "./nomorSurat";
import { bolehHapusRiwayatKp } from "./riwayatPenopang";
import { formatTanggalId } from "./waktu";
import type { PegawaiRow, RiwayatKGBRow, RiwayatPangkatRow } from "./sheets/tables";

export type HasilHapusRiwayatKp =
  | { ok: true; ringkas: string; peringatan: string[] }
  | { ok: false; status: number; pesan: string };

export async function hapusRiwayatKpBebas(input: {
  pegawai: PegawaiRow;
  riwayatId: string;
  userId: string;
}): Promise<HasilHapusRiwayatKp> {
  const { pegawai } = input;
  const semua = (await db.riwayatPangkat.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatPangkatRow[];
  const riwayat = semua.find((r) => r.id === input.riwayatId);
  if (!riwayat) return { ok: false, status: 404, pesan: "Riwayat tidak ditemukan" };
  const izin = bolehHapusRiwayatKp(riwayat.id, semua);
  if (!izin.boleh) return { ok: false, status: 409, pesan: izin.alasan };

  await db.riwayatPangkat.delete({ id: riwayat.id });

  const peringatan: string[] = [];
  const nomor = kunciNomorSk(riwayat.nomorSK);
  const nomorMasihAda = semua.some((r) => r.id !== riwayat.id && kunciNomorSk(r.nomorSK) === nomor);
  if (nomor && !nomorMasihAda) {
    const kgb = (await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatKGBRow[];
    const menyebut = kgb.filter((k) => !k.isArsip && kunciNomorSk(k.nomorSK) === nomor);
    if (menyebut.length > 0)
      peringatan.push(`${menyebut.length} KGB masih menyebut SK ${riwayat.nomorSK} sebagai Atas dasar; periksa di Proses KGB`);
    if (kunciNomorSk(pegawai.nomorSkDasar) === nomor) peringatan.push("SK dasar di Data Pegawai masih menyebut nomor itu");
  }

  const jenisKp = riwayat.jenisKp;
  const teks =
    `Hapus riwayat kenaikan pangkat ${pegawai.nama} (${pegawai.nip}): SK ${riwayat.nomorSK}, ` +
    `${riwayat.golonganLama} → ${riwayat.golonganBaru}, TMT ${riwayat.tmtPangkat ? formatTanggalId(riwayat.tmtPangkat) : "-"}, ` +
    `MKG ${riwayat.mkgTahunBaru} thn ${riwayat.mkgBulanBaru} bln, gaji Rp ${riwayat.gajiPokokBaru.toLocaleString("id-ID")}` +
    `${isJenisKp(jenisKp) ? ` (${JENIS_KP[jenisKp]})` : ""}; data pegawai tidak berubah`;
  logAudit({
    userId: input.userId,
    aksi: "hapus_riwayat_kp",
    targetNama: pegawai.nama,
    detail: peringatan.length > 0 ? `${teks}. ${peringatan.join(". ")}.` : `${teks}.`,
  });
  return { ok: true, ringkas: teks, peringatan };
}
