// Pemutakhiran data pegawai dari kiriman formulir (ADR-023): perbandingan kiriman dengan Data Pegawai, peringatan
// otomatis, dan status tindak lanjut. Modul ini murni; dipakai tab "Dokumen & Pemutakhiran" di halaman pegawai dan
// penanda di daftar Data Pegawai.
//
// Jalur penerapan tiap isian yang berbeda:
//   langsung  identitas dan SK CPNS: diterapkan ke Data Pegawai dari tab itu;
//   kp        golongan/TMT golongan: lewat Catat kenaikan pangkat, supaya riwayat pangkat dan jadwal KGB konsisten;
//   pmk       masa kerja dari SK PMK: lewat Catat peninjauan masa kerja;
//   mutasi    satker: lewat Catat mutasi;
//   periksa   selisih yang tidak dijelaskan kiriman (mis. MKG atau TMT KGB): dicocokkan dengan SK lebih dulu.

import type { IsianInventaris } from "./inventarisKgb";
import { SATKER } from "./satker";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export type JalurPenerapan = "langsung" | "kp" | "pmk" | "mutasi" | "periksa";

/** Data pegawai yang dibandingkan (sebagian PegawaiRow). */
export interface PegawaiBanding {
  nama: string;
  tempatLahir: string | null;
  tanggalLahir: NilaiTanggal;
  jabatan: string;
  golonganRuang: string;
  tmtGolongan: NilaiTanggal;
  mkgTahun: number;
  mkgBulan: number;
  tmtKgbTerakhir: NilaiTanggal;
  unitKerja: string;
  nomorSkDasar: string | null;
  tanggalSkDasar: NilaiTanggal;
}

/** Kunci isian Data Pegawai yang dapat diterapkan langsung. */
export type KolomLangsung = "nama" | "tempatLahir" | "tanggalLahir" | "jabatan" | "nomorSkDasar" | "tanggalSkDasar";

export interface BarisBanding {
  kunci: string;
  label: string;
  simKgb: string;
  kiriman: string;
  beda: boolean;
  jalur: JalurPenerapan;
  /** Untuk jalur langsung: kolom Data Pegawai dan nilai kiriman dalam bentuk isian formulir (tanggal yyyy-mm-dd). */
  kolom?: KolomLangsung;
  nilaiBaru?: string;
  /** Penjelasan singkat mengapa jalurnya bukan langsung. */
  catatan?: string;
}

const RAPIKAN = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Tanggal kalender "yyyy-mm-dd" dari nilai tersimpan atau isian; "" bila kosong. */
export function isoTanggal(nilai: NilaiTanggal): string {
  const t = tanggalKalender(nilai);
  if (!t) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

const mkgTeks = (tahun: number, bulan: number) => `${tahun} thn ${bulan} bln`;

/** Perbandingan isian kiriman dengan Data Pegawai, termasuk isian yang sama (beda false). */
export function bandingkanKiriman(pegawai: PegawaiBanding, isian: IsianInventaris): BarisBanding[] {
  const pernah = isian.keadaan === "pernah";
  const naik = pernah && isian.naikSetelahKgb === "ya";
  const pmk = pernah && isian.pmkSetelahKgb === "ya";
  const baris: BarisBanding[] = [];
  const teks = (kunci: KolomLangsung, label: string, sim: string | null | undefined, kirim: string) => {
    const a = RAPIKAN(sim);
    const b = RAPIKAN(kirim);
    baris.push({ kunci, label, simKgb: a, kiriman: b, beda: !!b && a.toLowerCase() !== b.toLowerCase(), jalur: "langsung", kolom: kunci, nilaiBaru: b });
  };
  const tanggal = (kunci: KolomLangsung, label: string, sim: NilaiTanggal, kirim: string) => {
    const a = isoTanggal(sim);
    const b = isoTanggal(kirim);
    baris.push({ kunci, label, simKgb: a, kiriman: b, beda: !!b && a !== b, jalur: "langsung", kolom: kunci, nilaiBaru: b });
  };

  teks("nama", "Nama", pegawai.nama, isian.nama);
  teks("tempatLahir", "Tempat lahir", pegawai.tempatLahir, isian.tempatLahir);
  tanggal("tanggalLahir", "Tanggal lahir", pegawai.tanggalLahir, isian.tanggalLahir);
  teks("jabatan", "Jabatan", pegawai.jabatan, isian.jabatan);

  if (isian.satker) {
    const satkerKiriman = SATKER.find((s) => s.kode === isian.satker)?.nama ?? isian.satker;
    baris.push({
      kunci: "satker",
      label: "Satker",
      simKgb: pegawai.unitKerja,
      kiriman: satkerKiriman,
      beda: satkerKiriman !== pegawai.unitKerja,
      jalur: "mutasi",
      catatan: "Pindah satker dicatat lewat Catat mutasi.",
    });
  }

  const golBeda = !!isian.golonganRuang && isian.golonganRuang !== pegawai.golonganRuang;
  baris.push({
    kunci: "golonganRuang",
    label: "Golongan ruang",
    simKgb: pegawai.golonganRuang,
    kiriman: isian.golonganRuang,
    beda: golBeda,
    jalur: "kp",
    catatan: "Golongan berubah lewat Catat kenaikan pangkat.",
  });
  const tmtGolSim = isoTanggal(pegawai.tmtGolongan);
  const tmtGolKirim = isoTanggal(isian.tmtGolongan);
  baris.push({
    kunci: "tmtGolongan",
    label: "TMT golongan",
    simKgb: tmtGolSim,
    kiriman: tmtGolKirim,
    beda: !!tmtGolKirim && tmtGolSim !== tmtGolKirim,
    jalur: golBeda || naik ? "kp" : "periksa",
    catatan: golBeda || naik ? "Dicatat bersama kenaikan pangkat." : "Cocokkan dengan SK pangkat, lalu perbaiki lewat Ubah data pegawai.",
  });

  if (pernah) {
    const tmtSim = isoTanggal(pegawai.tmtKgbTerakhir);
    const tmtKirim = isoTanggal(isian.tmtDasar);
    baris.push({
      kunci: "tmtKgbTerakhir",
      label: "TMT KGB terakhir",
      simKgb: tmtSim,
      kiriman: tmtKirim,
      beda: !!tmtKirim && tmtSim !== tmtKirim,
      jalur: "periksa",
      catatan: "SK KGB yang terbit di luar SIM-KGB dicatat lewat Arsip KGB di Proses KGB.",
    });
    // MKG kiriman adalah MKG pada SK terbaru; hanya sebanding dengan Data Pegawai (MKG pada TMT KGB terakhir)
    // bila SK terbarunya SK KGB terakhir yang TMT-nya sama.
    const sebanding = !naik && !pmk && tmtSim === tmtKirim;
    const mkgKirim = Number(isian.mkgTahun || 0) * 12 + Number(isian.mkgBulan || 0);
    const mkgSim = (pegawai.mkgTahun || 0) * 12 + (pegawai.mkgBulan || 0);
    baris.push({
      kunci: "mkg",
      label: naik || pmk ? "Masa kerja golongan (SK terbaru)" : "Masa kerja golongan",
      simKgb: mkgTeks(pegawai.mkgTahun || 0, pegawai.mkgBulan || 0),
      kiriman: mkgTeks(Math.floor(mkgKirim / 12), mkgKirim % 12),
      beda: sebanding ? mkgKirim !== mkgSim : pmk,
      jalur: pmk ? "pmk" : naik ? "kp" : "periksa",
      catatan: pmk
        ? "Tambahan masa kerja dicatat lewat Catat peninjauan masa kerja."
        : naik
          ? "Masa kerja setelah kenaikan pangkat dihitung sistem saat kenaikan pangkat dicatat."
          : "Cocokkan dengan SK KGB terakhir.",
    });
  } else {
    teks("nomorSkDasar", "Nomor SK CPNS", pegawai.nomorSkDasar, isian.nomorSkDasar);
    tanggal("tanggalSkDasar", "Tanggal SK CPNS", pegawai.tanggalSkDasar, isian.tanggalSkDasar);
    const tmtSim = isoTanggal(pegawai.tmtKgbTerakhir);
    const tmtKirim = isoTanggal(isian.tmtDasar);
    baris.push({
      kunci: "tmtCpns",
      label: "TMT CPNS",
      simKgb: tmtSim,
      kiriman: tmtKirim,
      beda: !!tmtKirim && tmtSim !== tmtKirim,
      jalur: "periksa",
      catatan: "TMT CPNS menentukan jadwal KGB pertama; cocokkan dengan SK CPNS, lalu perbaiki lewat Ubah data pegawai.",
    });
  }
  return baris;
}

/** Peringatan otomatis atas kiriman, di luar selisih isian. */
export function peringatanKiriman(pegawai: Pick<PegawaiBanding, "golonganRuang" | "tmtGolongan">, isian: IsianInventaris): string[] {
  const hasil: string[] = [];
  if (isian.keadaan !== "pernah") return hasil;
  const jenjang = isian.golonganRuang.split("/")[0];
  const mkg = Number(isian.mkgTahun || 0);
  if ((jenjang === "III" || jenjang === "IV") && mkg % 2 === 1)
    hasil.push(
      `Masa kerja ${mkg} tahun (ganjil) tidak ada di tabel gaji golongan ${jenjang}. Kemungkinan masih masa kerja golongan II; setelah penyesuaian ijazah ke III/a masa kerja dipotong 5 tahun.`,
    );
  if (jenjang === "II" && mkg > 0 && mkg % 2 === 0)
    hasil.push(`Masa kerja ${mkg} tahun (genap) tidak ada di tabel gaji golongan II. Periksa kembali masa kerja pada SK.`);
  const urut = (g: string) => ["I", "II", "III", "IV"].indexOf(g.split("/")[0]) * 10 + "abcde".indexOf(g.split("/")[1] ?? "");
  if (isian.golonganRuang && pegawai.golonganRuang && urut(isian.golonganRuang) < urut(pegawai.golonganRuang))
    hasil.push(`Golongan kiriman (${isian.golonganRuang}) lebih rendah dari SIM-KGB (${pegawai.golonganRuang}); kemungkinan golongan lama dari SK KGB.`);
  // Naik pangkat dengan golongan yang sama di SIM-KGB tetapi TMT golongan berbeda: kenaikan pangkatnya kemungkinan
  // belum dicatat (mis. kenaikan dalam jenjang yang tidak mengubah golongan yang diketik pegawai).
  if (
    isian.naikSetelahKgb === "ya" &&
    isian.golonganRuang === pegawai.golonganRuang &&
    isoTanggal(isian.tmtGolongan) !== isoTanggal(pegawai.tmtGolongan)
  )
    hasil.push("Pegawai menyatakan naik pangkat setelah KGB terakhir, tetapi TMT golongannya berbeda dengan SIM-KGB; pastikan kenaikan pangkatnya sudah dicatat.");
  return hasil;
}

export type StatusTindakLanjut = "belum_diperiksa" | "sesuai" | "perlu_perbaikan" | "diterapkan";

export const LABEL_TINDAK_LANJUT: Record<StatusTindakLanjut, string> = {
  belum_diperiksa: "Belum diperiksa",
  sesuai: "Sesuai",
  perlu_perbaikan: "Perlu perbaikan",
  diterapkan: "Sudah diterapkan",
};

export function isStatusTindakLanjut(nilai: unknown): nilai is StatusTindakLanjut {
  return typeof nilai === "string" && Object.prototype.hasOwnProperty.call(LABEL_TINDAK_LANJUT, nilai);
}

export interface TindakLanjut {
  status: StatusTindakLanjut;
  catatan: string;
  oleh: string;
  /** ISO */
  at: string;
}
