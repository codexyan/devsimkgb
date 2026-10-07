// Pencatatan SK yang menetapkan gaji pokok baru: kenaikan pangkat (termasuk penyesuaian ijazah) dan
// peninjauan masa kerja (PMK).
//
// Dipisahkan dari rutenya karena dijalankan dua pihak (ADR-030): Tim SDM Kanwil lewat Catat kenaikan pangkat
// dan Catat PMK di halaman pegawai, dan persetujuan usulan UPT yang menyertakan SK-nya. Keduanya harus
// menghasilkan data yang persis sama, sebab yang berbeda hanya siapa yang memicunya.
//
// Ketiganya berjalan berurutan dan sama untuk kedua jalur:
//   1. riwayat (riwayat_pangkat atau riwayat_pmk) disimpan lebih dulu, sehingga jejaknya tetap ada walau
//      langkah berikutnya gagal;
//   2. data gaji pegawai mengikuti SK itu;
//   3. jadwal KGB "belum diproses" disusun ulang, dan SK ini menjadi Atas dasar SK KGB berikutnya bila
//      TMT-nya sesudah KGB terakhir yang selesai (ADR-020, ADR-021).

import { db } from "./db";
import { newId } from "./sheets/id";
import { dampakKenaikanPangkatPadaKgb, hitungKenaikanPangkat, isJenisKp, skKpLebihBaru, JENIS_KP } from "./kenaikanPangkat";
import { hitungPmk } from "./pmk";
import { rencanaSiklusBerikutnya } from "./jadwalKgb";
import { isoTanggalKalender } from "./rekapKgb";
import { formatTanggalId, tanggalKalender } from "./waktu";
import { kunciNomorSk } from "./nomorSurat";
import type { PegawaiRow, RiwayatKGBRow, RiwayatPangkatRow, RiwayatPmkRow } from "./sheets/tables";

export interface GagalCatat {
  ok: false;
  status: number;
  pesan: string;
}

/** KGB yang sudah dikerjakan Tim SDM atau keuangan ketika SK ini dicatat; Tim SDM memutuskan sendiri. */
export interface KgbPerluDitinjau {
  id: string;
  status: string;
  tmtKgbBaru: string | null;
}

export interface HasilCatatKp {
  ok: true;
  golonganLama: string;
  golonganBaru: string;
  pangkatBaru: string;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  potonganMkgTahun: number;
  kgbDiselaraskan: number;
  kgbPerluDitinjau: KgbPerluDitinjau[];
  /** Kalimat siap pakai untuk jejak audit. */
  ringkas: string;
}

export interface HasilCatatPmk {
  ok: true;
  tambahBulan: number;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  tmtKgbBerikutnyaLama: string | null;
  tmtKgbBerikutnya: string | null;
  kgbDiselaraskan: number;
  kgbPerluDitinjau: KgbPerluDitinjau[];
  ringkas: string;
}

const ringkasTinjau = (daftar: RiwayatKGBRow[]): KgbPerluDitinjau[] =>
  daftar.map((k) => ({ id: k.id, status: k.status, tmtKgbBaru: isoTanggalKalender(k.tmtKgbBaru) }));

/**
 * Catat SK kenaikan pangkat lalu sesuaikan data gaji pegawai: golongan, pangkat, masa kerja golongan (dipotong
 * bila pindah jenjang), dan gaji pokok dari tabel PP 5/2024. TMT KGB tidak diatur ulang, karena siklus KGB
 * berjalan dari TMT KGB terakhir; yang berubah hanya dasar gajinya (Buku Saku KP 2026).
 */
export async function catatKenaikanPangkat(input: {
  pegawai: PegawaiRow;
  jenisKp: string;
  golonganBaru: string;
  nomorSK: string;
  tanggalSK: Date;
  tmtPangkat: Date;
  penetapSK?: string | null;
  keterangan?: string | null;
  /** Id pengguna pencatat, untuk createdBy riwayat. */
  userId: string;
  /**
   * Riwayat SK yang sama yang sudah tersimpan oleh pencatatan yang terputus (ADR-079): angka hitungannya diperbarui,
   * bukan dicatat dua kali. Nomor, tanggal, TMT, dan penetap pada riwayat itu dibiarkan.
   */
  riwayatAda?: string | null;
}): Promise<HasilCatatKp | GagalCatat> {
  const { pegawai, jenisKp, golonganBaru, nomorSK, tanggalSK, tmtPangkat, userId } = input;
  const penetapSK = input.penetapSK?.trim() || null;
  const keterangan = input.keterangan?.trim() || null;

  if (!isJenisKp(jenisKp)) return { ok: false, status: 400, pesan: "Jenis kenaikan pangkat tidak dikenal" };
  if (!nomorSK.trim()) return { ok: false, status: 400, pesan: "Nomor SK kenaikan pangkat wajib diisi" };
  // Satu SK hanya menaikkan pangkat sekali; SK yang sama dicatat dua kali membuat linimasa dan pindaiannya kembar
  // (ADR-069). Data SK-nya dibetulkan lewat Ubah data SK, bukan dicatat ulang.
  const tercatat = (await db.riwayatPangkat.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatPangkatRow[];
  if (!input.riwayatAda && tercatat.some((r) => kunciNomorSk(r.nomorSK) === kunciNomorSk(nomorSK)))
    return {
      ok: false,
      status: 409,
      pesan: `SK kenaikan pangkat ${nomorSK.trim()} sudah tercatat pada riwayat pegawai ini. Bila data SK-nya keliru, betulkan lewat Ubah data SK di tab Pangkat & PMK.`,
    };

  const hitung = hitungKenaikanPangkat({
    golonganLama: pegawai.golonganRuang,
    mkgTahunLama: pegawai.mkgTahun ?? 0,
    mkgBulanLama: pegawai.mkgBulan ?? 0,
    golonganBaru,
  });
  if (!hitung.ok) return { ok: false, status: 400, pesan: hitung.pesan };
  const hasil = hitung.hasil;

  const kgbPegawai = (await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatKGBRow[];
  const dampak = dampakKenaikanPangkatPadaKgb(kgbPegawai);

  const riwayat: RiwayatPangkatRow = {
    id: newId(),
    pegawaiId: pegawai.id,
    jenisKp,
    nomorSK: nomorSK.trim(),
    tanggalSK,
    tmtPangkat,
    golonganLama: pegawai.golonganRuang,
    golonganBaru: hasil.golonganBaru,
    mkgTahunLama: pegawai.mkgTahun ?? 0,
    mkgBulanLama: pegawai.mkgBulan ?? 0,
    mkgTahunBaru: hasil.mkgTahunBaru,
    mkgBulanBaru: hasil.mkgBulanBaru,
    gajiPokokLama: pegawai.gajiPokok ?? 0,
    gajiPokokBaru: hasil.gajiPokokBaru,
    keterangan,
    createdAt: new Date(),
    createdBy: userId,
    penetapSK,
  };
  if (input.riwayatAda)
    await db.riwayatPangkat.update(
      { id: input.riwayatAda },
      {
        golonganLama: riwayat.golonganLama,
        golonganBaru: riwayat.golonganBaru,
        mkgTahunLama: riwayat.mkgTahunLama,
        mkgBulanLama: riwayat.mkgBulanLama,
        mkgTahunBaru: riwayat.mkgTahunBaru,
        mkgBulanBaru: riwayat.mkgBulanBaru,
        gajiPokokLama: riwayat.gajiPokokLama,
        gajiPokokBaru: riwayat.gajiPokokBaru,
      },
    );
  else await db.riwayatPangkat.create(riwayat);

  await db.pegawai.update(
    { id: pegawai.id },
    {
      golonganRuang: hasil.golonganBaru,
      pangkat: hasil.pangkatBaru,
      mkgTahun: hasil.mkgTahunBaru,
      mkgBulan: hasil.mkgBulanBaru,
      gajiPokok: hasil.gajiPokokBaru,
      tmtGolongan: tmtPangkat,
      updatedAt: new Date(),
    },
  );

  // Penetap yang belum diketahui dibiarkan kosong agar Tim SDM mengisinya saat Input KGB, bukan tercetak
  // penetap SK KGB lama.
  const kpTerbaru = skKpLebihBaru(tmtPangkat, kgbPegawai, pegawai.tmtKgbTerakhir);
  const diselaraskan: string[] = [];
  for (const k of dampak.diselaraskan) {
    const tmtKgbBaru = tanggalKalender(k.tmtKgbBaru);
    if (!tmtKgbBaru) continue;
    try {
      const rencana = rencanaSiklusBerikutnya({
        golonganRuang: hasil.golonganBaru,
        mkgTahun: hasil.mkgTahunBaru,
        mkgBulan: hasil.mkgBulanBaru,
        gajiPokok: hasil.gajiPokokBaru,
        tmtKgbBerikutnya: tmtKgbBaru,
        tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
        penetapSkDasar: kpTerbaru ? penetapSK : k.penetapSkDasar,
      });
      await db.riwayatKGB.update(
        { id: k.id },
        {
          golonganLama: rencana.golonganLama,
          gajiPokokLama: rencana.gajiPokokLama,
          mkgTahunLama: rencana.mkgTahunLama,
          mkgBulanLama: rencana.mkgBulanLama,
          golonganBaru: rencana.golonganBaru,
          gajiPokokBaru: rencana.gajiPokokBaru,
          mkgTahunBaru: rencana.mkgTahunBaru,
          mkgBulanBaru: rencana.mkgBulanBaru,
          tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
          ...(kpTerbaru ? { penetapSkDasar: penetapSK } : {}),
        },
      );
      diselaraskan.push(k.id);
    } catch {
      // Golongan atau TMT yang tidak terbaca dibiarkan; Tim SDM memperbaikinya lewat Proses KGB.
    }
  }

  return {
    ok: true,
    golonganLama: pegawai.golonganRuang,
    golonganBaru: hasil.golonganBaru,
    pangkatBaru: hasil.pangkatBaru,
    mkgTahunBaru: hasil.mkgTahunBaru,
    mkgBulanBaru: hasil.mkgBulanBaru,
    gajiPokokLama: pegawai.gajiPokok ?? 0,
    gajiPokokBaru: hasil.gajiPokokBaru,
    potonganMkgTahun: hasil.potonganMkgTahun,
    kgbDiselaraskan: diselaraskan.length,
    kgbPerluDitinjau: ringkasTinjau(dampak.perluDitinjau),
    ringkas:
      `Kenaikan pangkat ${JENIS_KP[jenisKp]} ${pegawai.nama} (${pegawai.nip}), ` +
      `Gol. ${pegawai.golonganRuang} → ${hasil.golonganBaru}, MKG ${pegawai.mkgTahun ?? 0} thn → ${hasil.mkgTahunBaru} thn` +
      `${hasil.potonganMkgTahun > 0 ? ` (dipotong ${hasil.potonganMkgTahun} tahun)` : ""}, ` +
      `Gaji Rp ${(pegawai.gajiPokok ?? 0).toLocaleString("id-ID")} → Rp ${hasil.gajiPokokBaru.toLocaleString("id-ID")}, SK ${nomorSK.trim()}`,
  };
}

/**
 * Catat SK peninjauan masa kerja lalu sesuaikan data gaji dan jadwal KGB pegawai (ADR-021). Berbeda dengan
 * kenaikan pangkat, PMK dapat memajukan jadwal KGB: masa kerja yang bertambah bisa mencapai langkah tabel gaji
 * berikutnya lebih cepat.
 */
export async function catatPmk(input: {
  pegawai: PegawaiRow;
  nomorSK: string;
  tanggalSK: Date;
  tmtPmk: Date;
  mkgTahunSk: number;
  mkgBulanSk: number;
  /** Koreksi Tim SDM sesuai SK; kosong berarti memakai usulan hitungan. */
  tmtKgbBerikutnya?: Date | null;
  penetapSK?: string | null;
  keterangan?: string | null;
  userId: string;
  /** Riwayat SK PMK yang sama yang sudah tersimpan oleh pencatatan yang terputus (ADR-079); diperbarui, bukan digandakan. */
  riwayatAda?: string | null;
}): Promise<HasilCatatPmk | GagalCatat> {
  const { pegawai, nomorSK, tanggalSK, tmtPmk, mkgTahunSk, mkgBulanSk, userId } = input;
  const penetapSK = input.penetapSK?.trim() || null;
  const keterangan = input.keterangan?.trim() || null;

  if (!nomorSK.trim()) return { ok: false, status: 400, pesan: "Nomor SK PMK wajib diisi" };
  // Satu SK PMK hanya dicatat sekali (ADR-069).
  const tercatat = (await db.riwayatPmk.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatPmkRow[];
  if (!input.riwayatAda && tercatat.some((r) => kunciNomorSk(r.nomorSK) === kunciNomorSk(nomorSK)))
    return {
      ok: false,
      status: 409,
      pesan: `SK PMK ${nomorSK.trim()} sudah tercatat pada riwayat pegawai ini. Bila data SK-nya keliru, betulkan lewat Ubah data SK di tab Pangkat & PMK.`,
    };
  if (Number.isNaN(mkgTahunSk)) return { ok: false, status: 400, pesan: "Masa kerja golongan pada SK PMK wajib diisi" };

  const hitung = hitungPmk({
    golonganRuang: pegawai.golonganRuang,
    mkgTahun: pegawai.mkgTahun ?? 0,
    mkgBulan: pegawai.mkgBulan ?? 0,
    tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
    tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya,
    tmtPmk,
    mkgTahunSk,
    mkgBulanSk,
  });
  if (!hitung.ok) return { ok: false, status: 400, pesan: hitung.pesan };
  const hasil = hitung.hasil;

  const tmtKgbBerikutnya = input.tmtKgbBerikutnya ?? hasil.tmtKgbBerikutnyaUsulan;
  if (tmtKgbBerikutnya <= tmtPmk)
    return { ok: false, status: 400, pesan: `TMT KGB berikutnya harus sesudah TMT PMK (${formatTanggalId(tmtPmk)})` };

  const kgbPegawai = (await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } })) as RiwayatKGBRow[];
  const dampak = dampakKenaikanPangkatPadaKgb(kgbPegawai);

  const riwayat: RiwayatPmkRow = {
    id: newId(),
    pegawaiId: pegawai.id,
    nomorSK: nomorSK.trim(),
    tanggalSK,
    tmtPmk,
    golonganRuang: pegawai.golonganRuang,
    tambahBulan: hasil.tambahBulan,
    mkgTahunSebelum: hasil.mkgSebelumPadaTmt.tahun,
    mkgBulanSebelum: hasil.mkgSebelumPadaTmt.bulan,
    mkgTahunSesudah: hasil.mkgSesudahPadaTmt.tahun,
    mkgBulanSesudah: hasil.mkgSesudahPadaTmt.bulan,
    mkgTahunDasarLama: pegawai.mkgTahun ?? 0,
    mkgBulanDasarLama: pegawai.mkgBulan ?? 0,
    mkgTahunDasarBaru: hasil.mkgTahunDasar,
    mkgBulanDasarBaru: hasil.mkgBulanDasar,
    gajiPokokLama: pegawai.gajiPokok ?? 0,
    gajiPokokBaru: hasil.gajiPokokBaru,
    tmtKgbBerikutnyaLama: tanggalKalender(pegawai.tmtKgbBerikutnya),
    tmtKgbBerikutnyaBaru: tmtKgbBerikutnya,
    penetapSK,
    keterangan,
    createdAt: new Date(),
    createdBy: userId,
  };
  if (input.riwayatAda) {
    const { id: _id, nomorSK: _n, tanggalSK: _t, tmtPmk: _tmt, penetapSK: _p, keterangan: _k, createdAt: _c, createdBy: _b, ...angka } = riwayat;
    await db.riwayatPmk.update({ id: input.riwayatAda }, angka);
  } else await db.riwayatPmk.create(riwayat);

  await db.pegawai.update(
    { id: pegawai.id },
    {
      mkgTahun: hasil.mkgTahunDasar,
      mkgBulan: hasil.mkgBulanDasar,
      gajiPokok: hasil.gajiPokokBaru,
      tmtKgbBerikutnya,
      updatedAt: new Date(),
    },
  );

  const pmkTerbaru = skKpLebihBaru(tmtPmk, kgbPegawai, pegawai.tmtKgbTerakhir);
  const placeholder = [...dampak.diselaraskan].sort(
    (a, b) => (tanggalKalender(a.tmtKgbBaru)?.getTime() ?? 0) - (tanggalKalender(b.tmtKgbBaru)?.getTime() ?? 0),
  );
  const diselaraskan: string[] = [];
  let tmtBerikut: Date | null = tmtKgbBerikutnya;
  for (const k of placeholder) {
    if (!tmtBerikut) break;
    try {
      const rencana = rencanaSiklusBerikutnya({
        golonganRuang: pegawai.golonganRuang,
        mkgTahun: hasil.mkgTahunDasar,
        mkgBulan: hasil.mkgBulanDasar,
        gajiPokok: hasil.gajiPokokBaru,
        tmtKgbBerikutnya: tmtBerikut,
        tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
        penetapSkDasar: pmkTerbaru ? penetapSK : k.penetapSkDasar,
      });
      await db.riwayatKGB.update(
        { id: k.id },
        {
          tanggalSK: rencana.tanggalSK,
          tmtSK: rencana.tmtSK,
          golonganLama: rencana.golonganLama,
          gajiPokokLama: rencana.gajiPokokLama,
          mkgTahunLama: rencana.mkgTahunLama,
          mkgBulanLama: rencana.mkgBulanLama,
          golonganBaru: rencana.golonganBaru,
          gajiPokokBaru: rencana.gajiPokokBaru,
          mkgTahunBaru: rencana.mkgTahunBaru,
          mkgBulanBaru: rencana.mkgBulanBaru,
          tmtKgbBaru: rencana.tmtKgbBaru,
          tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
          flagRapelan: rencana.flagRapelan,
          ...(pmkTerbaru ? { penetapSkDasar: penetapSK } : {}),
        },
      );
      diselaraskan.push(k.id);
      tmtBerikut = rencana.tmtKgbBerikutnya;
    } catch {
      // Golongan atau TMT yang tidak terbaca dibiarkan; Tim SDM memperbaikinya lewat Proses KGB.
      tmtBerikut = null;
    }
  }

  const jadwalBergeser =
    isoTanggalKalender(pegawai.tmtKgbBerikutnya) !== isoTanggalKalender(tmtKgbBerikutnya)
      ? `, KGB berikutnya ${formatTanggalId(pegawai.tmtKgbBerikutnya)} → ${formatTanggalId(tmtKgbBerikutnya)}`
      : "";

  return {
    ok: true,
    tambahBulan: hasil.tambahBulan,
    gajiPokokLama: pegawai.gajiPokok ?? 0,
    gajiPokokBaru: hasil.gajiPokokBaru,
    tmtKgbBerikutnyaLama: isoTanggalKalender(pegawai.tmtKgbBerikutnya),
    tmtKgbBerikutnya: isoTanggalKalender(tmtKgbBerikutnya),
    kgbDiselaraskan: diselaraskan.length,
    kgbPerluDitinjau: ringkasTinjau(dampak.perluDitinjau),
    ringkas:
      `PMK ${pegawai.nama} (${pegawai.nip}), tambah ${Math.floor(hasil.tambahBulan / 12)} thn ${hasil.tambahBulan % 12} bln, ` +
      `MKG pada TMT PMK ${hasil.mkgSesudahPadaTmt.tahun} thn ${hasil.mkgSesudahPadaTmt.bulan} bln, ` +
      `Gaji Rp ${(pegawai.gajiPokok ?? 0).toLocaleString("id-ID")} → Rp ${hasil.gajiPokokBaru.toLocaleString("id-ID")}` +
      `${jadwalBergeser}, SK ${nomorSK.trim()}`,
  };
}
