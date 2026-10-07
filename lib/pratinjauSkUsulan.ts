// Pratinjau SK KGB dari isian usulan UPT, sebelum usulannya diajukan (ADR-078).
//
// Admin UPT melihat SK KGB berikutnya pegawai menurut isian formulirnya. Keadaan pegawai sesudah usulan disetujui
// dihitung dengan cara yang sama dengan persetujuan Kanwil (lib/setujuiUsulan.ts), KGB berikutnya dengan rumus jadwal
// Input KGB (lib/jadwalKgb.ts), dan Atas dasar SK-nya dari linimasa SK penetap gaji (lib/linimasaDasarSk.ts). Nomor dan
// tanggal surat, penandatangan, dan pejabat penetap SK dasar tetap ditetapkan Kanwil saat membuat SK, dan SK yang dibuat
// Kanwil masih direview UPT sebelum dicetak (ADR-077).
//
// Murni: tanpa akses data, supaya dapat diuji dan dicocokkan dengan persetujuan.

import { hitungDasarSkUsulan, hitungSkPegawaiBaru } from "./dasarSkUsulan";
import { rencanaSiklusBerikutnya, type RencanaSiklusKgb } from "./jadwalKgb";
import { susunLinimasaDasar, type KgbUntukLinimasa, type SkGaji, type SkPenetapGaji } from "./linimasaDasarSk";
import { kunciNomorSk } from "./nomorSurat";
import { getPangkat } from "./tabelGaji";
import { isiHitungan } from "./usulanFormulir";
import { perubahanPegawai } from "./usulanPegawai";
import { tanggalKalender } from "./waktu";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

/** Keadaan dasar gaji pegawai bila usulan ini disetujui. */
export interface KeadaanSesudahUsulan {
  golonganRuang: string;
  pangkat: string;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbTerakhir: Date | null;
  tmtKgbBerikutnya: Date | null;
}

type Hasil<T> = { ok: true; nilai: T } | { ok: false; pesan: string };

/**
 * Keadaan dasar gaji sesudah usulan disetujui, dengan hitungan persetujuan Kanwil: SK kenaikan pangkat atau PMK yang
 * dilaporkan dihitung terhadap data tercatat (pegawai lama) atau keadaan pada SK KGB terakhir (pegawai baru).
 */
export function keadaanSesudahUsulan(usulan: Partial<UsulanPegawaiRow>, pegawaiLama: PegawaiRow | null): Hasil<KeadaanSesudahUsulan> {
  // SK yang dilaporkan tetapi belum lengkap tidak dihitung saat disetujui; golongan dan masa kerja menurut SK-nya akan
  // terbaca sebagai angka mentah. Pratinjaunya ditahan, bukan disusun dengan angka keliru.
  const jenisSk = usulan.dasarBaruJenis?.trim();
  if ((jenisSk === "kp" || jenisSk === "pmk") && (!tanggalKalender(usulan.dasarBaruTanggalSk) || !tanggalKalender(usulan.dasarBaruTmt)))
    return {
      ok: false,
      pesan: `Isi tanggal SK dan ${jenisSk === "kp" ? "TMT pangkat" : "TMT PMK"} pada SK yang dilaporkan untuk menyusun pratinjau.`,
    };
  if (pegawaiLama) {
    const nilaiBaru = perubahanPegawai(usulan);
    const sk = hitungDasarSkUsulan(pegawaiLama, usulan, nilaiBaru);
    if (sk.berlaku && !sk.ok) return { ok: false, pesan: `SK yang dilaporkan belum dapat dihitung: ${sk.pesan}.` };
    // Tanpa SK, kolom hitungannya dari isian usulan seperti saat disimpan (lib/usulanFormulir.ts).
    const hitungan = sk.berlaku ? null : isiHitungan(usulan, pegawaiLama, null);
    const p: Partial<PegawaiRow> = {
      ...pegawaiLama,
      ...nilaiBaru,
      ...(hitungan ? { pangkat: hitungan.pangkat ?? undefined, gajiPokok: hitungan.gajiPokok ?? undefined, tmtKgbBerikutnya: hitungan.tmtKgbBerikutnya ?? null } : {}),
      ...(sk.berlaku && sk.ok ? sk.nilai : {}),
    };
    const golongan = String(p.golonganRuang ?? "");
    return {
      ok: true,
      nilai: {
        golonganRuang: golongan,
        pangkat: String(p.pangkat || getPangkat(golongan) || ""),
        mkgTahun: Number(p.mkgTahun ?? 0),
        mkgBulan: Number(p.mkgBulan ?? 0),
        gajiPokok: Number(p.gajiPokok ?? 0),
        tmtKgbTerakhir: tanggalKalender(p.tmtKgbTerakhir),
        tmtKgbBerikutnya: tanggalKalender(p.tmtKgbBerikutnya),
      },
    };
  }

  const sk = hitungSkPegawaiBaru(usulan);
  if (sk.berlaku && !sk.ok) return { ok: false, pesan: `SK yang dilaporkan belum dapat dihitung: periksa ${sk.pesan}.` };
  const hitungan = isiHitungan(usulan, null, usulan);
  const golongan = String(usulan.golonganRuang ?? "");
  const menurutSk = sk.berlaku && sk.ok ? sk.nilai : null;
  return {
    ok: true,
    nilai: {
      golonganRuang: golongan,
      pangkat: menurutSk?.pangkat || String(hitungan.pangkat ?? getPangkat(golongan) ?? ""),
      mkgTahun: menurutSk ? menurutSk.mkgTahun : Number(usulan.mkgTahun ?? 0),
      mkgBulan: menurutSk ? menurutSk.mkgBulan : Number(usulan.mkgBulan ?? 0),
      gajiPokok: menurutSk ? menurutSk.gajiPokok : Number(hitungan.gajiPokok ?? 0),
      tmtKgbTerakhir: tanggalKalender(usulan.tmtKgbTerakhir),
      tmtKgbBerikutnya: menurutSk ? menurutSk.tmtKgbBerikutnya : tanggalKalender(hitungan.tmtKgbBerikutnya),
    },
  };
}

/** KGB berikutnya dari keadaan sesudah usulan, dengan rumus jadwal Input KGB. */
export function rencanaKgbPratinjau(keadaan: KeadaanSesudahUsulan, hariIni?: Date): Hasil<RencanaSiklusKgb> {
  if (!keadaan.tmtKgbBerikutnya)
    return { ok: false, pesan: "TMT KGB berikutnya belum dapat dihitung. Lengkapi golongan, masa kerja golongan, dan TMT KGB terakhir." };
  try {
    return {
      ok: true,
      nilai: rencanaSiklusBerikutnya({
        golonganRuang: keadaan.golonganRuang,
        mkgTahun: keadaan.mkgTahun,
        mkgBulan: keadaan.mkgBulan,
        gajiPokok: keadaan.gajiPokok,
        tmtKgbBerikutnya: keadaan.tmtKgbBerikutnya,
        tmtKgbTerakhir: keadaan.tmtKgbTerakhir,
        hariIni,
      }),
    };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : "KGB berikutnya belum dapat dihitung." };
  }
}

/**
 * Atas dasar SK KGB berikutnya: SK terbaru yang menetapkan gaji pokok, dari linimasa yang sama dengan Buat SK Kanwil
 * (ADR-062). SK yang dilaporkan pada usulan ikut sebagai calon, dan SK acuan pada isian menggantikan SK dasar Data
 * Pegawai, sama dengan yang terjadi saat usulannya disetujui.
 */
export function dasarSkPratinjau(input: {
  usulan: Partial<UsulanPegawaiRow>;
  pegawaiLama: PegawaiRow | null;
  /** Riwayat pegawai yang sudah tercatat; kosong pada pegawai baru. */
  kgb?: readonly KgbUntukLinimasa[];
  pangkat?: readonly SkPenetapGaji[];
  pmk?: readonly SkPenetapGaji[];
  tmtKgbBaru: Date;
}): SkGaji | null {
  const { usulan, pegawaiLama } = input;
  const pangkat = [...(input.pangkat ?? [])];
  const pmk = [...(input.pmk ?? [])];
  const jenis = usulan.dasarBaruJenis?.trim();
  const tmtSk = tanggalKalender(usulan.dasarBaruTmt);
  if ((jenis === "kp" || jenis === "pmk") && tmtSk) {
    const sk: SkPenetapGaji = {
      id: "usulan",
      nomorSK: usulan.dasarBaruNomorSk ?? null,
      tanggalSK: usulan.dasarBaruTanggalSk ?? null,
      tmt: tmtSk,
      jenisKp: jenis === "kp" ? usulan.dasarBaruJenisKp ?? null : undefined,
      penetapSK: usulan.dasarBaruPenetap ?? null,
    };
    (jenis === "kp" ? pangkat : pmk).push(sk);
  }
  const acuanBaru = usulan.nomorSkTerakhir?.trim();
  const mkgAcuan = usulan.golonganAcuan?.trim()
    ? { mkgTahun: usulan.mkgTahunAcuan ?? 0, mkgBulan: usulan.mkgBulanAcuan ?? 0 }
    : { mkgTahun: usulan.mkgTahun ?? pegawaiLama?.mkgTahun ?? 0, mkgBulan: usulan.mkgBulan ?? pegawaiLama?.mkgBulan ?? 0 };
  const linimasa = susunLinimasaDasar({
    kgb: input.kgb ?? [],
    pangkat,
    pmk,
    pegawai: {
      nomorSkDasar: acuanBaru || pegawaiLama?.nomorSkDasar || null,
      tanggalSkDasar: acuanBaru ? usulan.tanggalSkTerakhir ?? null : pegawaiLama?.tanggalSkDasar ?? null,
      // Nomor SK dasar yang berganti membuat pejabat penetap lama tidak berlaku lagi (lib/setujuiUsulan.ts).
      penetapSkDasar: acuanBaru && kunciNomorSk(acuanBaru) !== kunciNomorSk(pegawaiLama?.nomorSkDasar) ? null : pegawaiLama?.penetapSkDasar ?? null,
      tmtKgbTerakhir: usulan.tmtKgbTerakhir ?? pegawaiLama?.tmtKgbTerakhir ?? null,
      ...mkgAcuan,
    },
    tmtKgbSebelumnya: usulan.tmtKgbTerakhir ?? pegawaiLama?.tmtKgbTerakhir ?? null,
    tmtKgbBaru: input.tmtKgbBaru,
  });
  return linimasa.dasar;
}
