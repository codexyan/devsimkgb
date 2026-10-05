// Fungsi murni untuk form dan tampilan modal KGB.

import type { DataDasarSk, PegawaiKgb, RiwayatKgbItem } from "@/lib/kgbAksi";
import { kalkulasiKGB, type HasilKalkulasiKGB } from "@/lib/tabelGaji";
import { isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";
import { kunciNomorSk } from "@/lib/nomorSurat";
import type { SkGaji } from "@/lib/linimasaDasarSk";

/** Identitas pegawai yang ditampilkan di kepala modal. */
export interface RingkasPegawai {
  nama: string;
  nip?: string | null;
}

/** Nilai awal bagian Atas Dasar SK Terakhir; tanggal boleh berupa nilai tersimpan (ISO) atau "yyyy-mm-dd". */
export interface DasarSkAwal {
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  tmtSK?: NilaiTanggal;
  penetapSkDasar?: string | null;
}

export function subjudulPegawai(pegawai: RingkasPegawai): string {
  const nip = pegawai.nip?.trim();
  return nip ? `${pegawai.nama} · NIP ${nip}` : pegawai.nama;
}

/** Nilai input type=date ("yyyy-mm-dd") dari tanggal tersimpan, dibaca sebagai tanggal kalender WITA. */
export function nilaiInputTanggal(value: NilaiTanggal): string {
  const tanggal = tanggalKalender(value);
  return tanggal ? isoTanggalLokal(tanggal) : "";
}

/** Nomor SK tersimpan untuk isian form; "-" (penanda surat tanpa nomor) dianggap kosong. */
export function nomorSkTerisi(nilai: string | null | undefined): string {
  const teks = nilai?.trim() ?? "";
  return teks === "-" ? "" : teks;
}

/** Tahun dari nilai input tanggal "yyyy-mm-dd"; null bila formatnya lain. */
export function tahunTanggalInput(nilai: string | null | undefined): number | null {
  const cocok = /^(\d{4})-\d{2}-\d{2}$/.exec(nilai?.trim() ?? "");
  return cocok ? Number(cocok[1]) : null;
}

/** Isian awal bagian Atas Dasar SK Terakhir dari data tersimpan. */
export function isianDasarSk(awal?: DasarSkAwal | null): DataDasarSk {
  return {
    nomorSK: nomorSkTerisi(awal?.nomorSK),
    tanggalSK: nilaiInputTanggal(awal?.tanggalSK),
    tmtSK: nilaiInputTanggal(awal?.tmtSK),
    penetapSkDasar: awal?.penetapSkDasar?.trim() ?? "",
  };
}

/** Data kartu pipeline /dashboard untuk isian awal Input KGB (tanggal tersimpan dalam format ISO). */
export interface DataDasarKartuKgb {
  statusKGB: string | null;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtSK: string | null;
  penetapSkDasar: string | null;
  prevNomorSK: string | null;
  prevTanggalSK: string | null;
  prevTmtSK: string | null;
  prevPenetapSkDasar: string | null;
}

/**
 * Isian awal Atas Dasar SK Terakhir untuk Input KGB: data KGB yang dibatalkan (Input Ulang KGB) bila
 * nomor SK-nya tersimpan, selain itu SK KGB yang terakhir selesai. null bila tidak ada data tersimpan.
 * Jadwal Belum Diproses yang dibatalkan tidak punya nomor SK; tanggal SK dan TMT SK-nya berisi TMT KGB
 * baru, jadi tidak dipakai.
 */
export function dasarAwalInputKgb(k: DataDasarKartuKgb): DasarSkAwal | null {
  if (k.statusKGB === "ditolak" && nomorSkTerisi(k.nomorSK)) {
    return { nomorSK: k.nomorSK, tanggalSK: k.tanggalSK, tmtSK: k.tmtSK, penetapSkDasar: k.penetapSkDasar };
  }
  // TMT saja tanpa nomor maupun tanggal bukan SK yang dikenali; null membuat modal mencari sendiri di riwayat
  // dan data pegawai, alih-alih membuka isian yang hanya berisi TMT (ADR-056).
  if (!nomorSkTerisi(k.prevNomorSK) && !k.prevTanggalSK) return null;
  return { nomorSK: k.prevNomorSK, tanggalSK: k.prevTanggalSK, tmtSK: k.prevTmtSK, penetapSkDasar: k.prevPenetapSkDasar };
}

/** SK dasar pada data pegawai (Data Pegawai, kartu Dasar KGB: SK dasar dan Ditetapkan oleh). */
export type SkDasarPegawai = Pick<PegawaiKgb, "nomorSkDasar" | "tanggalSkDasar" | "penetapSkDasar" | "tmtKgbTerakhir">;

/**
 * Isian Atas Dasar SK Terakhir yang diselaraskan dengan SK dasar pada data pegawai, atau null bila tidak ada yang
 * perlu diubah (ADR-056).
 *
 * Isian awal Input KGB berasal dari salinan: data KGB yang ditolak (Input Ulang), KGB sebelumnya pada kartu
 * dasbor, atau jadwal Belum Diproses. Salinan itu tidak ikut berubah ketika operator membetulkan SK dasar di Data
 * Pegawai, misalnya menulis ulang pejabat penetapnya; akibatnya baris Oleh di SK KGB memakai tulisan lama. Data
 * pegawai karena itu diutamakan:
 * - SK yang sama (nomornya setara walau berbeda spasi atau huruf besar, atau tanggal SK-nya sama ketika salah
 *   satunya tidak bernomor): nomor, tanggal, dan pejabat penetap diambil dari data pegawai, yang kosong saja yang
 *   memakai salinan;
 * - SK dasar data pegawai lebih baru (tanggal SK-nya lebih akhir), atau salinannya tidak menyebut SK apa pun:
 *   SK dasar data pegawai dipakai seluruhnya;
 * - salinan menyebut SK yang lebih baru, yaitu SK KGB yang diterbitkan SIM-KGB sesudah SK dasar data pegawai:
 *   salinan dipertahankan, sebab pejabat penetapnya memang pejabat yang menandatangani SK itu.
 */
export function selaraskanDasarPegawai(isian: DataDasarSk, pegawai: SkDasarPegawai): DataDasarSk | null {
  const nomorP = nomorSkTerisi(pegawai.nomorSkDasar);
  const tanggalP = nilaiInputTanggal(pegawai.tanggalSkDasar);
  const penetapP = pegawai.penetapSkDasar?.trim() ?? "";
  if (!nomorP && !tanggalP && !penetapP) return null;

  const salinanKosong = !isian.nomorSK.trim() && !isian.tanggalSK;
  const nomorS = nomorSkTerisi(isian.nomorSK);
  // Tanggal yang sama saja tidak cukup bila keduanya bernomor: dua SK berbeda dapat terbit pada hari yang sama.
  const samaSk =
    (!!nomorP && !!nomorS && kunciNomorSk(nomorP) === kunciNomorSk(nomorS)) ||
    (!!tanggalP && tanggalP === isian.tanggalSK && (!nomorP || !nomorS));
  const pegawaiLebihBaru = !!tanggalP && (!isian.tanggalSK || tanggalP > isian.tanggalSK);

  let hasil: DataDasarSk;
  if (samaSk) {
    hasil = {
      nomorSK: nomorP || isian.nomorSK,
      tanggalSK: tanggalP || isian.tanggalSK,
      tmtSK: isian.tmtSK || nilaiInputTanggal(pegawai.tmtKgbTerakhir),
      penetapSkDasar: penetapP || isian.penetapSkDasar,
    };
  } else if (salinanKosong || (pegawaiLebihBaru && !!nomorP)) {
    hasil = {
      nomorSK: nomorP,
      tanggalSK: tanggalP,
      tmtSK: nilaiInputTanggal(pegawai.tmtKgbTerakhir) || isian.tmtSK,
      penetapSkDasar: penetapP || (salinanKosong ? isian.penetapSkDasar : ""),
    };
  } else {
    return null;
  }
  return JSON.stringify(hasil) === JSON.stringify(isian) ? null : hasil;
}

/** Isian Atas Dasar SK Terakhir dari SK pada linimasa SK penetap gaji (ADR-062). */
export function isianDariSkGaji(sk: Pick<SkGaji, "nomorSK" | "tanggalSK" | "tmt" | "penetap">): DataDasarSk {
  return {
    nomorSK: nomorSkTerisi(sk.nomorSK),
    tanggalSK: nilaiInputTanggal(sk.tanggalSK),
    tmtSK: nilaiInputTanggal(sk.tmt),
    penetapSkDasar: sk.penetap?.trim() ?? "",
  };
}

/** Hasil membandingkan isian Atas dasar dengan SK terbaru menurut linimasa (ADR-062). */
export type HasilBandingDasar =
  /** Isian sudah menyebut SK terbaru, dengan isian yang sama. */
  | { jenis: "sama" }
  /**
   * Isian menyebut SK terbaru, tetapi catatannya lebih lengkap atau berbeda (mis. penetap yang dibetulkan di Data
   * Pegawai). Ditawarkan, tidak ditimpa: isian Buat SK bisa sengaja disunting Tim SDM (ADR-058).
   */
  | { jenis: "isian-berbeda"; isian: DataDasarSk; beda: { label: string; lama: string; baru: string }[] }
  /** Isian menyebut SK yang lebih lama daripada SK terbaru, atau masih kosong. */
  | { jenis: "lebih-baru"; isian: DataDasarSk }
  /** Isian menyebut SK yang sama barunya atau lebih baru (mis. SK yang belum tercatat), atau dasarnya tidak diketahui. */
  | { jenis: "tetap" };

const peringkatSk = (jenis: SkGaji["jenis"] | null | undefined) => (jenis === "kp" || jenis === "pmk" ? 1 : 0);

/**
 * Bandingkan isian Atas dasar dengan SK terbaru yang menetapkan gaji pokok menurut linimasa. SK yang sama dikenali dari
 * nomornya (setara walau berbeda spasi atau huruf besar), atau tanggal SK-nya bila salah satunya tidak bernomor. SK lain
 * dibandingkan menurut TMT-nya; pada TMT yang sama SK kenaikan pangkat dan PMK lebih baru daripada SK KGB (ADR-020).
 */
export function bandingkanDasarSk(
  isian: DataDasarSk,
  linimasa: { sk: ReadonlyArray<SkGaji>; dasar: SkGaji | null },
): HasilBandingDasar {
  const dasar = linimasa.dasar;
  if (!dasar) return { jenis: "tetap" };
  const target = isianDariSkGaji(dasar);
  const nomorI = nomorSkTerisi(isian.nomorSK);
  const kunciI = nomorI ? kunciNomorSk(nomorI) : null;
  const samaDengan = (sk: Pick<SkGaji, "nomorSK" | "tanggalSK">) =>
    (!!kunciI && !!sk.nomorSK && kunciNomorSk(sk.nomorSK) === kunciI) ||
    (!!isian.tanggalSK && nilaiInputTanggal(sk.tanggalSK) === isian.tanggalSK && (!nomorI || !sk.nomorSK));

  if (samaDengan(dasar)) {
    // Hanya isian yang tercatat yang ditawarkan; catatan yang kosong tidak mengosongkan isian operator.
    const beda = (
      [
        ["Nomor", isian.nomorSK, target.nomorSK],
        ["Tanggal", isian.tanggalSK, target.tanggalSK],
        ["TMT", isian.tmtSK, target.tmtSK],
        ["Oleh", isian.penetapSkDasar, target.penetapSkDasar],
      ] as const
    )
      .filter(([, lama, baru]) => !!baru.trim() && baru.trim() !== lama.trim())
      .map(([label, lama, baru]) => ({ label, lama, baru }));
    if (beda.length === 0) return { jenis: "sama" };
    return {
      jenis: "isian-berbeda",
      isian: {
        nomorSK: target.nomorSK || isian.nomorSK,
        tanggalSK: target.tanggalSK || isian.tanggalSK,
        tmtSK: target.tmtSK || isian.tmtSK,
        penetapSkDasar: target.penetapSkDasar || isian.penetapSkDasar,
      },
      beda,
    };
  }

  if (!nomorI && !isian.tanggalSK) return { jenis: "lebih-baru", isian: target };
  // SK yang disebut isian, bila tercatat di linimasa: TMT dan jenisnya diambil dari sana.
  const cocok = linimasa.sk.find(samaDengan) ?? null;
  if (cocok?.peran === "sesudah") return { jenis: "lebih-baru", isian: target };
  const tmtI = cocok?.tmt ? nilaiInputTanggal(cocok.tmt) : isian.tmtSK;
  if (!tmtI || !target.tmtSK) return tmtI ? { jenis: "tetap" } : { jenis: "lebih-baru", isian: target };
  if (target.tmtSK > tmtI) return { jenis: "lebih-baru", isian: target };
  if (target.tmtSK === tmtI && peringkatSk(dasar.jenis) > peringkatSk(cocok?.jenis)) return { jenis: "lebih-baru", isian: target };
  return { jenis: "tetap" };
}

/** true bila keempat isian Atas Dasar SK Terakhir masih kosong. */
export function isianDasarKosong(isian: DataDasarSk): boolean {
  return !isian.nomorSK.trim() && !isian.tanggalSK && !isian.tmtSK && !isian.penetapSkDasar.trim();
}

/**
 * Isian awal Atas Dasar SK Terakhir dari riwayat KGB pegawai (GET /api/kgb?pegawaiId=): SK KGB yang
 * terakhir selesai menurut TMT, yaitu nomor dan tanggal SK baru beserta TMT-nya. Record arsip tanpa
 * nomor surat memakai kolom SK yang diarsipkan. Penetap diambil dari jadwal Belum Diproses (yang
 * dibuat dari penandatangan SK itu), atau dari record arsip. null bila tidak ada data.
 */
export function dasarAwalDariRiwayat(riwayat: ReadonlyArray<RiwayatKgbItem>): DasarSkAwal | null {
  let terakhir: RiwayatKgbItem | null = null;
  let tmtTerakhir: Date | null = null;
  for (const k of riwayat) {
    if (k.status !== "selesai") continue;
    const tmt = tanggalKalender(k.tmtKgbBaru);
    if (tmt && (!tmtTerakhir || tmt > tmtTerakhir)) {
      terakhir = k;
      tmtTerakhir = tmt;
    }
  }
  const penetapJadwal =
    riwayat.find((k) => k.status === "belum_diproses" && k.penetapSkDasar?.trim())?.penetapSkDasar?.trim() ?? null;
  if (!terakhir) return penetapJadwal ? { penetapSkDasar: penetapJadwal } : null;

  const nomorSurat = nomorSkTerisi(terakhir.surat?.nomorSurat);
  const arsip = terakhir.isArsip === true;
  const nomorSK = nomorSurat || (arsip ? nomorSkTerisi(terakhir.nomorSK) : "");
  const tanggalSK = nomorSurat ? terakhir.surat?.tanggalSurat : arsip && nomorSK ? terakhir.tanggalSK : null;
  return {
    nomorSK: nomorSK || null,
    tanggalSK: tanggalSK ?? null,
    tmtSK: arsip && tanggalKalender(terakhir.tmtSK) ? terakhir.tmtSK : terakhir.tmtKgbBaru,
    penetapSkDasar: penetapJadwal ?? (arsip ? terakhir.penetapSkDasar?.trim() || null : null),
  };
}

export function formatRupiah(nilai: number | null | undefined): string {
  if (typeof nilai !== "number" || !Number.isFinite(nilai)) return "-";
  return `Rp ${Math.round(nilai).toLocaleString("id-ID")}`;
}

export function formatMkg(tahun: number | null | undefined, bulan: number | null | undefined): string {
  if (typeof tahun !== "number" || !Number.isFinite(tahun)) return "-";
  return `${tahun} Tahun ${typeof bulan === "number" && Number.isFinite(bulan) ? bulan : 0} Bulan`;
}

/**
 * Pesan untuk bidang wajib yang masih kosong, misalnya "Lengkapi Nomor SK Terakhir dan Tanggal SK Terakhir."
 * Mengembalikan null bila semua terisi.
 */
export function pesanBidangWajib(
  bidang: ReadonlyArray<readonly [label: string, nilai: string | null | undefined]>,
): string | null {
  const kosong = bidang.filter(([, nilai]) => !nilai?.trim()).map(([label]) => label);
  if (kosong.length === 0) return null;
  if (kosong.length === 1) return `Lengkapi ${kosong[0]}.`;
  if (kosong.length === 2) return `Lengkapi ${kosong[0]} dan ${kosong[1]}.`;
  return `Lengkapi ${kosong.slice(0, -1).join(", ")}, dan ${kosong[kosong.length - 1]}.`;
}

/** Server hanya menerima berkas bertipe application/pdf. */
export function berkasPdfSah(berkas: { type: string } | null | undefined): boolean {
  return berkas?.type === "application/pdf";
}

export function formatUkuranBerkas(byte: number): string {
  if (!Number.isFinite(byte) || byte < 0) return "-";
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export type PerhitunganKgb = { ok: true; hasil: HasilKalkulasiKGB } | { ok: false; error: string };

/** Perhitungan KGB untuk pratinjau di modal, dengan rumus yang sama dengan POST /api/kgb. */
export function hitungKgbPegawai(
  pegawai: Pick<PegawaiKgb, "golonganRuang" | "mkgTahun" | "mkgBulan" | "tmtKgbBerikutnya" | "tmtKgbTerakhir">,
  hariIni?: Date,
): PerhitunganKgb {
  try {
    return {
      ok: true,
      hasil: kalkulasiKGB({
        golonganRuang: pegawai.golonganRuang,
        mkgTahun: Number(pegawai.mkgTahun),
        mkgBulan: Number(pegawai.mkgBulan),
        tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya,
        tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
        hariIni,
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Jadwal KGB pegawai tidak dapat dihitung" };
  }
}

/** Riwayat kenaikan pangkat pegawai (GET /api/pegawai/[id]/pangkat), sebatas yang dipakai sebagai SK dasar. */
export interface KenaikanPangkatDasar {
  /** "pmk" untuk SK peninjauan masa kerja (ADR-021); selain itu SK kenaikan pangkat. */
  jenis?: "kp" | "pmk";
  jenisLabel?: string | null;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtPangkat: string | null;
  penetapSK?: string | null;
}

/**
 * Atas dasar SK KGB adalah SK terbaru yang menetapkan gaji pokok (ADR-020). Bila SK kenaikan pangkat, termasuk
 * penyesuaian ijazah, ber-TMT pada atau sesudah TMT SK dasar yang ditemukan (SK KGB terakhir atau SK CPNS),
 * SK kenaikan pangkat itulah dasarnya. null bila tidak ada kenaikan pangkat yang lebih baru.
 *
 * Batasnya dua (ADR-056). Bawah: TMT SK dasar, atau TMT KGB terakhir pada data pegawai bila lebih akhir; tanpa itu
 * KP bertahun-tahun lalu terpilih bila riwayat KGB pegawai kosong, padahal KGB sesudahnya terjadi di luar SIM-KGB.
 * Atas: TMT KGB yang sedang diinput; SK yang baru berlaku sesudahnya belum menetapkan gaji yang dinaikkan KGB ini.
 */
export function dasarDariKenaikanPangkat(
  dasar: DasarSkAwal | null | undefined,
  riwayat: ReadonlyArray<KenaikanPangkatDasar>,
  batas: { tmtKgbTerakhir?: NilaiTanggal; tmtKgbBaru?: NilaiTanggal } = {},
): (DasarSkAwal & { kp: KenaikanPangkatDasar }) | null {
  const bawahDasar = tanggalKalender(dasar?.tmtSK);
  const bawahPegawai = tanggalKalender(batas.tmtKgbTerakhir);
  const bawah = bawahDasar && bawahPegawai ? (bawahDasar > bawahPegawai ? bawahDasar : bawahPegawai) : bawahDasar ?? bawahPegawai;
  const atas = tanggalKalender(batas.tmtKgbBaru);
  let kp: KenaikanPangkatDasar | null = null;
  let tmtKp: Date | null = null;
  for (const r of riwayat) {
    const t = tanggalKalender(r.tmtPangkat);
    if (!t || (bawah && t < bawah) || (atas && t > atas)) continue;
    if (!tmtKp || t > tmtKp) {
      kp = r;
      tmtKp = t;
    }
  }
  if (!kp || !tmtKp) return null;
  return { nomorSK: kp.nomorSK, tanggalSK: kp.tanggalSK, tmtSK: kp.tmtPangkat, penetapSkDasar: kp.penetapSK ?? null, kp };
}
