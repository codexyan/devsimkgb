// Isi surat KGB yang dikirim ke peramban untuk disusun menjadi PDF (lib/generateSuratKGB.tsx). Dipakai route PDF Kanwil
// (POST /api/kgb/[id]/pdf) dan pratinjau review Admin UPT (ADR-077), sehingga yang direview UPT persis sama dengan yang
// kelak dicetak Kanwil.

import { db } from "./db";
import type { DataSuratKGB } from "./generateSuratKGB";
import { tentukanPenandatangan, type JenisPenandatangan } from "./penandatangan";
import { PENETAP_KANWIL } from "./penetapSk";
import { cariSatker, SATKER_KANWIL } from "./satker";
import { getPangkat } from "./tabelGaji";
import { templateUntuk } from "./templateSurat";
import { muatVersiTemplate } from "./templateSuratServer";
import { tanggalKalender } from "./waktu";
import type { SuratKgbTersimpan } from "./prosesKgb";
import type { PegawaiRow, RiwayatKGBRow } from "./sheets/tables";

/** Teks peraturan gaji: nilai lengkap dipakai apa adanya, nomor polos digabung dengan tahunnya. */
export function teksDasarHukum(nomorPP?: string | null, tahunPP?: string | null): string {
  const nomor = nomorPP?.trim() ?? "";
  const tahun = tahunPP?.trim() || "2024";
  if (!nomor) return `Nomor 5 Tahun ${tahun}`;
  return /^\d+$/.test(nomor) ? `Nomor ${nomor} Tahun ${tahun}` : nomor;
}

/**
 * "Penata (III/c)" untuk golongan KGB baru. Nama pangkat diambil dari tabel golongan; pangkat yang
 * tercatat pada pegawai hanya dipakai bila golongannya sama dan tabel tidak mengenalnya.
 */
export function teksPangkatGolongan(golongan: string, pegawai: { pangkat: string; golonganRuang: string }): string {
  const pangkat = getPangkat(golongan) || (golongan === pegawai.golonganRuang ? pegawai.pangkat?.trim() : "");
  return pangkat ? `${pangkat} (${golongan})` : golongan;
}

export interface PenandatanganSurat {
  jenis: JenisPenandatangan;
  jabatan: string;
  nama: string;
}

/** Satker pegawai menurut daftar baku; unit kerja kosong berarti Kanwil, unit kerja di luar daftar null. */
export function satkerSurat(unitKerja: string | null | undefined) {
  const teks = unitKerja?.trim() ?? "";
  return teks ? cariSatker(teks) : SATKER_KANWIL;
}

/** Isi surat dari data KGB, pegawai, satker, nomor dan tanggal surat, serta penandatangannya. */
export async function susunDataSuratKgb(input: {
  kgb: RiwayatKGBRow;
  pegawai: PegawaiRow;
  satker: { nama: string; jenis: string; kppn: string };
  nomorSurat: string;
  tanggalSurat: Date;
  penandatangan: PenandatanganSurat;
}): Promise<DataSuratKGB> {
  const { kgb, pegawai, satker, nomorSurat, tanggalSurat, penandatangan } = input;
  const kanwil = (await db.konfigurasiKanwil.findUnique({ id: "default" })) as { nomorPP?: string | null; tahunPP?: string | null } | null;
  return {
    nomorSurat,
    tanggalSurat,
    kppn: satker.kppn,
    satker: { nama: satker.nama, kanwil: satker.jenis === "kanwil" },
    // Pangkat dan golongan diambil dari data KGB, sama dengan gaji pokok dan masa kerjanya (ADR-056). Data pegawai
    // dapat sudah berubah sesudah Input KGB (kenaikan pangkat yang dicatat belakangan, koreksi golongan), sehingga
    // satu SK mencetak dua golongan yang berbeda.
    pegawai: {
      nama: pegawai.nama,
      nip: pegawai.nip,
      pangkat:
        getPangkat(kgb.golonganLama) ||
        (kgb.golonganLama === pegawai.golonganRuang ? pegawai.pangkat : "") ||
        pegawai.pangkat,
      golonganRuang: kgb.golonganLama || pegawai.golonganRuang,
    },
    kgb: {
      gajiPokokLama: kgb.gajiPokokLama,
      nomorSK: kgb.nomorSK,
      tanggalSK: kgb.tanggalSK,
      tmtSK: kgb.tmtSK,
      // Surat lama (sebelum kolom ini ada) selalu mencetak penetap Kanwil.
      penetapSkDasar: kgb.penetapSkDasar?.trim() || PENETAP_KANWIL,
      mkgTahunLama: kgb.mkgTahunLama,
      mkgBulanLama: kgb.mkgBulanLama,
      gajiPokokBaru: kgb.gajiPokokBaru,
      mkgTahunBaru: kgb.mkgTahunBaru,
      mkgBulanBaru: kgb.mkgBulanBaru,
      pangkatGolonganBaru: teksPangkatGolongan(kgb.golonganBaru, pegawai),
      tmtKgbBaru: kgb.tmtKgbBaru,
      tmtKgbBerikutnya: kgb.tmtKgbBerikutnya,
    },
    penandatangan: { jenis: penandatangan.jenis, jabatan: penandatangan.jabatan, nama: penandatangan.nama },
    dasarHukum: teksDasarHukum(kanwil?.nomorPP, kanwil?.tahunPP),
    // Versi template yang berlaku pada tanggal surat (ADR-019): SK lama tetap tercetak dengan format ketika terbit.
    template: templateUntuk((await muatVersiTemplate()).versi, tanggalSurat),
  };
}

/**
 * Isi surat yang sudah dibuat, apa adanya: nomor, tanggal, dan penandatangan dari baris surat tersimpan. Surat lama
 * tanpa salinan jabatan penandatangan memakai penandatangan yang berlaku pada tanggal suratnya.
 */
export async function dataSuratTersimpan(input: {
  kgb: RiwayatKGBRow;
  pegawai: PegawaiRow;
  surat: SuratKgbTersimpan;
}): Promise<{ ok: true; surat: DataSuratKGB } | { ok: false; status: number; pesan: string }> {
  const { kgb, pegawai, surat } = input;
  const satker = satkerSurat(pegawai.unitKerja);
  if (!satker)
    return { ok: false, status: 422, pesan: `Unit kerja "${pegawai.unitKerja ?? ""}" belum sesuai daftar satker, sehingga SK tidak dapat disusun.` };
  const tanggalSurat = surat.tanggalSurat ? new Date(surat.tanggalSurat) : null;
  if (!tanggalSurat || Number.isNaN(tanggalSurat.getTime())) return { ok: false, status: 404, pesan: "Belum ada surat yang dibuat." };

  let penandatangan: PenandatanganSurat;
  if (surat.jabatanPenandatangan?.trim()) {
    penandatangan = {
      jenis: surat.jenisPenandatangan as JenisPenandatangan,
      jabatan: surat.jabatanPenandatangan,
      nama: surat.namaKepalaKanwil ?? "",
    };
  } else {
    const hasil = tentukanPenandatangan(await db.penandatangan.findMany(), tanggalKalender(tanggalSurat)!, pegawai.nip);
    if (!hasil.ok) return { ok: false, status: 422, pesan: hasil.error };
    penandatangan = { jenis: hasil.penandatangan.jenis, jabatan: hasil.jabatan, nama: hasil.penandatangan.nama };
  }
  return {
    ok: true,
    surat: await susunDataSuratKgb({ kgb, pegawai, satker, nomorSurat: surat.nomorSurat, tanggalSurat, penandatangan }),
  };
}
