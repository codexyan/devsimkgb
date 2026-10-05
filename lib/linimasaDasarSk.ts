// Linimasa SK yang menetapkan gaji pokok seorang pegawai, dan SK mana yang menjadi "Atas dasar" SK KGB (ADR-020,
// ADR-062).
//
// Aturannya satu kalimat (ADR-020): Atas dasar SK KGB adalah SK terbaru yang menetapkan gaji pokok sebelum TMT KGB itu,
// yaitu SK KGB, SK kenaikan pangkat (termasuk penyesuaian ijazah), atau SK peninjauan masa kerja (PMK). Misalnya:
//   - KGB terakhir 1 Des 2024, lalu kenaikan pangkat 1 Jan 2026: dasar KGB 1 Des 2026 adalah SK kenaikan pangkat itu;
//   - tanpa kenaikan pangkat lagi, dasar KGB 1 Des 2028 adalah SK KGB 1 Des 2026;
//   - PMK atau penyesuaian ijazah sesudah KGB terakhir dan sebelum TMT KGB yang dibuat menggantikannya.
// SK yang baru berlaku sesudah TMT KGB yang dibuat belum menetapkan gaji yang dinaikkan KGB itu, jadi tidak dihitung.
//
// Modul ini menyusun SK-SK itu menjadi linimasa dan menandai peran masing-masing terhadap KGB yang dibuat: dasar,
// tergantikan, atau sesudah. Satu aturan untuk dasbor Admin UPT (lib/dasarKgbBerikutnya.ts), Buat SK dan Perbaiki SK,
// serta jendela Linimasa SK dasar; isian Input KGB memakai batas yang sama (dasarDariKenaikanPangkat). Modul ini murni,
// dan ringan karena rute dasbor UPT memanggilnya untuk setiap pegawai satker.

import { JENIS_KP, isJenisKp } from "./kenaikanPangkat";
import { kunciNomorSk } from "./nomorSurat";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export type JenisSkGaji = "cpns" | "kgb" | "kp" | "pmk";

/** Peran SK terhadap KGB yang dibuat. */
export type PeranSkGaji = "dasar" | "tergantikan" | "sesudah";

export const LABEL_SK_GAJI: Record<JenisSkGaji, string> = {
  cpns: "SK CPNS",
  kgb: "SK KGB",
  kp: "SK kenaikan pangkat",
  pmk: "SK peninjauan masa kerja",
};

/** Record riwayat KGB pegawai. Yang menjadi SK di linimasa hanya yang selesai, termasuk arsip. */
export interface KgbUntukLinimasa {
  id?: string | null;
  status: string;
  isArsip?: boolean | null;
  tmtKgbBaru: NilaiTanggal;
  /** Record arsip: SK yang diarsipkan. Record lain: SK dasar yang dipakai KGB itu. */
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  tmtSK?: NilaiTanggal;
  /** Penetap SK dasar KGB itu; dipakai mengenali penetap SK yang menjadi dasarnya. */
  penetapSkDasar?: string | null;
  golonganBaru?: string | null;
  mkgTahunBaru?: number | null;
  mkgBulanBaru?: number | null;
  gajiPokokBaru?: number | null;
  surat?: { nomorSurat?: string | null; tanggalSurat?: NilaiTanggal } | null;
}

/** SK kenaikan pangkat (termasuk penyesuaian ijazah) atau SK PMK. */
export interface SkPenetapGaji {
  id?: string | null;
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  tmt: NilaiTanggal;
  /** Hanya untuk kenaikan pangkat; dipakai melengkapi labelnya. */
  jenisKp?: string | null;
  penetapSK?: string | null;
  /** Kenaikan pangkat: golongan sebelum dan sesudahnya. */
  golonganLama?: string | null;
  golonganBaru?: string | null;
  /** PMK: tambahan masa kerja golongan, dalam bulan. */
  tambahBulan?: number | null;
  gajiPokokBaru?: number | null;
}

/** SK dasar pada Data Pegawai beserta keterangan yang menentukan jenisnya (ADR-010). */
export interface SkDasarPegawaiUntukDasar {
  nomorSkDasar?: string | null;
  tanggalSkDasar?: NilaiTanggal;
  penetapSkDasar?: string | null;
  /** TMT KGB terakhir, atau TMT CPNS bagi yang belum pernah KGB. */
  tmtKgbTerakhir?: NilaiTanggal;
  mkgTahun?: number | null;
  mkgBulan?: number | null;
}

export interface SkGaji {
  /** Kunci unik dalam satu linimasa. */
  kunci: string;
  jenis: JenisSkGaji;
  /** Label siap tampil, mis. "SK kenaikan pangkat (Pilihan: Penyesuaian Ijazah)". */
  label: string;
  nomorSK: string | null;
  /** ISO, atau null bila tidak diketahui. */
  tanggalSK: string | null;
  /** TMT SK (ISO); null bila tidak diketahui, yaitu SK dasar Data Pegawai yang sudah didahului riwayat SIM-KGB. */
  tmt: string | null;
  /** Pejabat penetapnya: baris "Oleh" bila SK ini menjadi Atas dasar. */
  penetap: string | null;
  /** Ringkasan isinya, mis. "Gol. III/a → III/b, Rp 3.200.000". */
  rincian: string | null;
  asal: "kgb" | "arsip" | "kp" | "pmk" | "data-pegawai";
  /** SK dasar Data Pegawai menyebut SK yang sama; nomor, tanggal, dan penetapnya diambil dari sana (ADR-056). */
  dataPegawai: boolean;
  peran: PeranSkGaji;
}

export interface LinimasaDasarSk {
  /** Urut TMT, yang paling lama lebih dulu; SK yang TMT-nya tidak diketahui di awal, menurut tanggal SK-nya. */
  sk: SkGaji[];
  dasar: SkGaji | null;
  /**
   * TMT KGB terakhir pegawai bila lebih baru daripada SK dasar yang ditemukan: KGB itu terjadi, tetapi SK-nya belum
   * tercatat di SIM-KGB (riwayat maupun SK dasar Data Pegawai), sehingga dasar yang ditemukan mungkin sudah usang.
   */
  kgbTanpaSk: string | null;
}

export interface MasukanLinimasa {
  kgb: readonly KgbUntukLinimasa[];
  pangkat?: readonly SkPenetapGaji[];
  pmk?: readonly SkPenetapGaji[];
  pegawai?: SkDasarPegawaiUntukDasar | null;
  /**
   * TMT KGB terakhir sebelum KGB yang dibuat; batas bawah SK kenaikan pangkat dan PMK. Untuk dasbor dan Input KGB
   * itu TMT KGB terakhir pegawai. Untuk Buat SK, TMT sebelum KGB yang sedang diproses (tmtTerakhirSebelumInput),
   * sebab Input KGB sudah memajukan TMT KGB terakhir pegawai ke TMT KGB itu.
   */
  tmtKgbSebelumnya?: NilaiTanggal;
  /** TMT KGB yang dibuat; SK yang berlaku sesudahnya belum dihitung. Tanpa nilai ini tidak ada batas atas. */
  tmtKgbBaru?: NilaiTanggal;
  /** KGB yang dibuat, agar tidak dihitung sebagai SK bagi dirinya sendiri. */
  kgbId?: string | null;
  /**
   * Hanya dasarnya yang dibutuhkan (dasbor Admin UPT, yang memanggilnya untuk setiap pegawai satker): rincian dan
   * penetap SK KGB tidak disusun, supaya rute itu tetap di bawah batas CPU Workers.
   */
  hanyaDasar?: boolean;
}

const iso = (nilai: NilaiTanggal): string | null => tanggalKalender(nilai)?.toISOString() ?? null;
const terisi = (teks: string | null | undefined) => (teks?.trim() && teks.trim() !== "-" ? teks.trim() : null);
const waktu = (nilai: string | null) => (nilai ? Date.parse(nilai) : Number.NaN);
// Dibuat sekali per isolat: membuat pemformat Intl pada setiap panggilan mahal untuk rute dasbor UPT.
const ANGKA = new Intl.NumberFormat("id-ID");
// Sama dengan formatRupiah di modal KGB (app/dashboard/components/kgb/format.ts).
const rupiah = (n: number | null | undefined) => (typeof n === "number" && n > 0 ? `Rp ${ANGKA.format(n)}` : null);
const gabung = (...bagian: (string | null | false | undefined)[]) => bagian.filter(Boolean).join(", ") || null;
const kunciNomor = (nomor: string | null) => (nomor ? kunciNomorSk(nomor) : null);

/** Label SK kenaikan pangkat beserta jenisnya, mis. "SK kenaikan pangkat (Reguler)". */
export function labelKenaikanPangkat(jenisKp: string | null | undefined): string {
  const jenis = jenisKp?.trim() ?? "";
  return isJenisKp(jenis) ? `${LABEL_SK_GAJI.kp} (${JENIS_KP[jenis]})` : LABEL_SK_GAJI.kp;
}

/** Urutan peringkat pada TMT yang sama: SK kenaikan pangkat dan PMK sudah memuat KGB pada tanggal itu (ADR-020). */
const peringkat = (jenis: JenisSkGaji) => (jenis === "kp" || jenis === "pmk" ? 1 : 0);

/**
 * Penetap SK KGB terbitan SIM-KGB tidak tersimpan pada record-nya sendiri: record KGB menyimpan penetap SK dasarnya.
 * Penetap itu karenanya dibaca dari KGB lain yang memakai SK ini sebagai dasar, atau, untuk KGB selesai yang
 * terakhir, dari jadwal Belum Diproses yang dibuat dari penandatangannya (sama dengan isian Input KGB).
 */
function penetapSkKgb(nomor: string | null, kgb: readonly KgbUntukLinimasa[], terakhir: boolean): string | null {
  const kunci = kunciNomor(nomor);
  if (kunci) {
    for (const k of kgb) {
      if (k.isArsip === true) continue;
      const penetap = terisi(k.penetapSkDasar);
      if (penetap && kunciNomor(terisi(k.nomorSK)) === kunci) return penetap;
    }
  }
  if (!terakhir) return null;
  return terisi(kgb.find((k) => k.status === "belum_diproses" && terisi(k.penetapSkDasar))?.penetapSkDasar);
}

/**
 * Linimasa SK penetap gaji pokok dan Atas dasar SK KGB yang dibuat.
 *
 * Pemilihannya sama dengan aturan yang berlaku sejak ADR-057:
 * 1. SK KGB terakhir yang selesai di SIM-KGB (riwayat, termasuk arsip). SK dasar Data Pegawai dipakai bila riwayatnya
 *    kosong, atau bila tanggal SK-nya lebih akhir (Kanwil merekam SK yang terbit di luar SIM-KGB sesudahnya).
 * 2. SK kenaikan pangkat atau PMK menang bila TMT-nya pada atau sesudah TMT SK itu dan TMT KGB sebelumnya, dan tidak
 *    sesudah TMT KGB yang dibuat. Di antara keduanya, yang TMT-nya paling akhir.
 */
export function susunLinimasaDasar(input: MasukanLinimasa): LinimasaDasarSk {
  const atas = tanggalKalender(input.tmtKgbBaru);
  const sesudahAtas = (tmt: string | null) => !!atas && !!tmt && waktu(tmt) > atas.getTime();
  const sk: SkGaji[] = [];

  // 1. SK KGB yang selesai. Yang berlaku sesudah KGB yang dibuat tetap tampil, sebagai "sesudah".
  const selesai = input.kgb.filter((k) => k.status === "selesai" && (!input.kgbId || k.id !== input.kgbId));
  const dariKgb = selesai.map((k, i): SkGaji => {
    const arsip = k.isArsip === true;
    const nomorSurat = terisi(k.surat?.nomorSurat);
    const nomorSK = nomorSurat ?? (arsip ? terisi(k.nomorSK) : null);
    const tmt = arsip && tanggalKalender(k.tmtSK) ? iso(k.tmtSK) : iso(k.tmtKgbBaru);
    return {
      kunci: `kgb:${k.id ?? i}`,
      jenis: "kgb",
      label: arsip ? `${LABEL_SK_GAJI.kgb} (arsip)` : LABEL_SK_GAJI.kgb,
      nomorSK,
      tanggalSK: nomorSurat ? iso(k.surat?.tanggalSurat) : arsip && nomorSK ? iso(k.tanggalSK) : null,
      tmt,
      penetap: null,
      rincian: input.hanyaDasar
        ? null
        : gabung(
            terisi(k.golonganBaru) && `Gol. ${terisi(k.golonganBaru)}`,
            typeof k.mkgTahunBaru === "number" && `${k.mkgTahunBaru} th ${k.mkgBulanBaru ?? 0} bln`,
            rupiah(k.gajiPokokBaru),
          ),
      asal: arsip ? "arsip" : "kgb",
      dataPegawai: false,
      peran: "tergantikan",
    };
  });
  // SK KGB terakhir sebelum KGB yang dibuat; record tanpa TMT yang sah tidak dihitung.
  let kgbTerakhir: SkGaji | null = null;
  for (const item of dariKgb) {
    const t = waktu(item.tmt);
    if (!Number.isNaN(t) && !sesudahAtas(item.tmt) && (!kgbTerakhir || t > waktu(kgbTerakhir.tmt))) kgbTerakhir = item;
  }
  if (!input.hanyaDasar) for (const item of dariKgb) item.penetap = penetapSkKgb(item.nomorSK, input.kgb, item === kgbTerakhir);
  sk.push(...dariKgb);

  // 2. SK kenaikan pangkat dan PMK.
  for (const [i, r] of (input.pangkat ?? []).entries()) {
    sk.push({
      kunci: `kp:${r.id ?? i}`,
      jenis: "kp",
      label: labelKenaikanPangkat(r.jenisKp),
      nomorSK: terisi(r.nomorSK),
      tanggalSK: iso(r.tanggalSK),
      tmt: iso(r.tmt),
      penetap: terisi(r.penetapSK),
      rincian: input.hanyaDasar
        ? null
        : gabung(
            terisi(r.golonganBaru) &&
              (terisi(r.golonganLama) ? `Gol. ${terisi(r.golonganLama)} → ${terisi(r.golonganBaru)}` : `Gol. ${terisi(r.golonganBaru)}`),
            rupiah(r.gajiPokokBaru),
          ),
      asal: "kp",
      dataPegawai: false,
      peran: "tergantikan",
    });
  }
  for (const [i, r] of (input.pmk ?? []).entries()) {
    const tambah = typeof r.tambahBulan === "number" && r.tambahBulan > 0 ? r.tambahBulan : null;
    sk.push({
      kunci: `pmk:${r.id ?? i}`,
      jenis: "pmk",
      label: LABEL_SK_GAJI.pmk,
      nomorSK: terisi(r.nomorSK),
      tanggalSK: iso(r.tanggalSK),
      tmt: iso(r.tmt),
      penetap: terisi(r.penetapSK),
      rincian: input.hanyaDasar ? null : gabung(tambah !== null && `masa kerja +${Math.floor(tambah / 12)} th ${tambah % 12} bln`, rupiah(r.gajiPokokBaru)),
      asal: "pmk",
      dataPegawai: false,
      peran: "tergantikan",
    });
  }

  // 3. SK dasar Data Pegawai. SK yang sama dengan salah satu di atas dipadukan ke sana; selain itu berdiri sendiri.
  const p = input.pegawai;
  const tmtSebelumnya = iso(input.tmtKgbSebelumnya ?? p?.tmtKgbTerakhir);
  const k = kgbTerakhir;
  let dariData: SkGaji | null = null;
  const nomorP = terisi(p?.nomorSkDasar);
  const tanggalP = iso(p?.tanggalSkDasar);
  // Riwayat SIM-KGB didahulukan, kecuali SK dasar Data Pegawai bertanggal lebih akhir (ADR-057).
  const dataLebihBaru = !!k && !!tanggalP && !!k.tanggalSK && tanggalP > k.tanggalSK;
  if (p && (nomorP || tanggalP)) {
    const kunciP = kunciNomor(nomorP);
    const sama =
      (kunciP && sk.find((s) => kunciNomor(s.nomorSK) === kunciP)) ||
      (tanggalP && sk.find((s) => s.tanggalSK === tanggalP && (!nomorP || !s.nomorSK))) ||
      null;
    if (sama) {
      sama.dataPegawai = true;
      sama.nomorSK = nomorP ?? sama.nomorSK;
      sama.tanggalSK = tanggalP ?? sama.tanggalSK;
      sama.penetap = terisi(p.penetapSkDasar) ?? sama.penetap;
    } else {
      // Masa kerja golongan 0 tahun 0 bulan berarti belum pernah KGB: SK dasarnya SK CPNS (lib/usulanPegawai.ts).
      const jenis: JenisSkGaji = (p.mkgTahun ?? 0) === 0 && (p.mkgBulan ?? 0) === 0 ? "cpns" : "kgb";
      // TMT-nya TMT KGB terakhir pegawai, kecuali riwayat SIM-KGB sudah lebih baru: SK itu lalu tergantikan dan
      // TMT-nya tidak diketahui lagi, sebab TMT KGB terakhir pegawai sudah bergeser ke KGB sesudahnya.
      dariData = {
        kunci: "data-pegawai",
        jenis,
        label: LABEL_SK_GAJI[jenis],
        nomorSK: nomorP,
        tanggalSK: tanggalP,
        tmt: !k || dataLebihBaru ? tmtSebelumnya : null,
        penetap: terisi(p.penetapSkDasar),
        rincian: null,
        asal: "data-pegawai",
        dataPegawai: true,
        peran: "tergantikan",
      };
      sk.push(dariData);
    }
  }

  // 4. Pemilihan dasar.
  const dasarKgb = !k || (dataLebihBaru && dariData) ? (dariData ?? k) : k;
  const bawahDasar = waktu(dasarKgb?.tmt ?? null);
  const bawahSebelum = waktu(tmtSebelumnya);
  const bawah = Math.max(Number.isNaN(bawahDasar) ? -Infinity : bawahDasar, Number.isNaN(bawahSebelum) ? -Infinity : bawahSebelum);

  let unggul: SkGaji | null = null;
  for (const s of sk) {
    if (s.asal !== "kp" && s.asal !== "pmk") continue;
    const t = waktu(s.tmt);
    // SK yang lebih lama daripada SK KGB terakhir sudah terwakili oleh SK KGB itu; yang sesudah KGB yang dibuat
    // belum menetapkan gaji yang dinaikkan KGB itu.
    if (Number.isNaN(t) || t < bawah || sesudahAtas(s.tmt)) continue;
    if (unggul && t <= waktu(unggul.tmt)) continue;
    unggul = s;
  }
  const dasar = unggul ?? (dasarKgb && !sesudahAtas(dasarKgb.tmt) ? dasarKgb : null);

  for (const s of sk) s.peran = s === dasar ? "dasar" : sesudahAtas(s.tmt) ? "sesudah" : "tergantikan";

  // KGB terakhir pegawai yang lebih baru daripada dasar yang ditemukan, tanpa SK tercatat.
  const tmtDasar = waktu(dasar?.tmt ?? null);
  const kgbTanpaSk =
    tmtSebelumnya && !sesudahAtas(tmtSebelumnya) && (Number.isNaN(tmtDasar) || waktu(tmtSebelumnya) > tmtDasar) ? tmtSebelumnya : null;

  sk.sort((a, b) => {
    const ta = waktu(a.tmt);
    const tb = waktu(b.tmt);
    if (Number.isNaN(ta) !== Number.isNaN(tb)) return Number.isNaN(ta) ? -1 : 1;
    if (Number.isNaN(ta)) return (a.tanggalSK ?? "").localeCompare(b.tanggalSK ?? "");
    return ta - tb || peringkat(a.jenis) - peringkat(b.jenis) || (a.tanggalSK ?? "").localeCompare(b.tanggalSK ?? "");
  });

  return { sk, dasar, kgbTanpaSk };
}
