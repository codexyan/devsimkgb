// SK sesudah SK KGB terakhir pada formulir UPT (ADR-065, ADR-078), dipakai bersama formulir perorangan dan Usul KGB
// Kolektif.
//
// SK KGB terakhir (atau SK CPNS) tetap acuan jadwal KGB. SK kenaikan pangkat, penyesuaian ijazah, atau PMK yang
// terbit sesudahnya dilaporkan lewat satu pertanyaan wajib, dan SK paling baru di antara keduanya menjadi Atas
// dasar SK KGB berikutnya (ADR-020).
//
// Formulir memisahkan dua keadaan sesuai urutan SK-nya (ADR-078): bagian atas memuat golongan dan masa kerja golongan
// pada SK acuan, bagian SK memuat golongan dan masa kerja yang tertulis pada SK yang dilaporkan. Hitungannya memakai
// fungsi yang sama dengan persetujuan Kanwil (lib/dasarSkUsulan.ts).

import { TANPA_SK_BARU } from "@/lib/dasarBaruUsulan";
import { cocokMkgSk, hitungSkDilaporkan, type MasaKerja } from "@/lib/dasarSkUsulan";
export { mkgPadaSkTercatat } from "@/lib/dasarSkUsulan";
import { isGolonganDikenal, mkgAwalGolongan } from "@/lib/tabelGaji";
import { hitungUsulan, pernahKgb, type HitunganUsulan } from "@/lib/usulanPegawai";
import type { PratinjauAtasDasar } from "@/lib/linimasaDasarSk";
import { formatTanggalId, tanggalKalender } from "@/lib/waktu";
import { saranPenetapDariNomor } from "@/lib/penetapSk";

export interface IsianSkBaru {
  jenis: string;
  jenisKp: string;
  nomorSk: string;
  tanggalSk: string;
  tmt: string;
  penetap: string;
  /** Golongan/ruang baru menurut SK kenaikan pangkat (ADR-078). */
  golongan?: string;
  /** Masa kerja golongan pada TMT SK, seperti tertulis pada SK-nya (ADR-078). */
  mkgTahun?: string;
  mkgBulan?: string;
  /** Jenis SK terakhir yang dipilih sebelum UPT menjawab Tidak ada, agar dapat dipulihkan bila menjawab Ada lagi. */
  jenisAda?: string;
}

/**
 * Isian SK setelah UPT menjawab pertanyaannya. Ada: buka isian SK, dengan jenis yang terakhir dipilih atau kenaikan
 * pangkat. Tidak ada: isian SK tetap disimpan di formulir, supaya menjawab Ada lagi tidak menghapus yang sudah diketik;
 * server tidak menyimpannya selama jawabannya Tidak ada (lib/usulanFormulir.ts).
 */
export function jawabSkBaru<T extends IsianSkBaru>(dasar: T, ada: boolean): T {
  if (ada) {
    if (dasar.jenis === "kp" || dasar.jenis === "pmk") return dasar;
    return { ...dasar, jenis: dasar.jenisAda === "pmk" ? "pmk" : "kp" };
  }
  if (dasar.jenis === "koreksi") return dasar;
  return {
    ...dasar,
    jenis: TANPA_SK_BARU,
    jenisAda: dasar.jenis === "kp" || dasar.jenis === "pmk" ? dasar.jenis : dasar.jenisAda,
  };
}

/** Keadaan pada SK acuan sebagaimana diisi di bagian atas formulir; semuanya teks. */
export interface IsianAcuan {
  golonganRuang: string;
  mkgTahun: string;
  mkgBulan: string;
  tmtKgbTerakhir: string;
}

const angkaIsian = (teks: string | null | undefined) => {
  const n = Number(String(teks ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Keadaan sesudah SK yang dilaporkan, sebagaimana akan dicatat Kanwil. */
export type HitunganSesudahSk =
  | { ok: false; pesan: string }
  | {
      ok: true;
      jenis: "kp" | "pmk";
      golongan: string;
      pangkat: string;
      /** Masa kerja golongan pada TMT KGB terakhir, yang disimpan di data pegawai. */
      mkg: MasaKerja;
      /** Masa kerja golongan pada TMT SK menurut hitungan sistem. */
      mkgPadaTmtSk: MasaKerja | null;
      /** Kenaikan pangkat: cocok tidaknya masa kerja yang tertulis pada SK dengan hitungan sistem. */
      cocok: ReturnType<typeof cocokMkgSk>;
      gajiPokok: number;
      tmtKgbBerikutnya: Date | null;
      penjelasan: string;
    };

export interface HitunganFormulir {
  /** Menurut SK acuan pada bagian atas. */
  acuan: HitunganUsulan;
  /** Sesudah SK yang dilaporkan; null bila tidak ada SK, atau isiannya belum cukup untuk dihitung. */
  sesudahSk: HitunganSesudahSk | null;
}

/**
 * Hitungan yang tampil di formulir: keadaan menurut SK acuan, dan keadaan sesudah SK kenaikan pangkat atau PMK yang
 * dilaporkan. Yang kedua memakai hitungan persetujuan Kanwil (hitungSkDilaporkan): kenaikan pangkat memotong masa kerja
 * menurut lompatan golongan, PMK menambah masa kerja; keduanya tidak menggeser jadwal KGB (ADR-080).
 *
 * `tmtKgbBerikutnyaTercatat`: jadwal pegawai yang sudah tercatat, yang dipertahankan Kanwil pada kenaikan pangkat.
 */
export function hitungFormulirUsulan(
  atas: IsianAcuan,
  dasar: Pick<IsianSkBaru, "jenis" | "tmt" | "golongan" | "mkgTahun" | "mkgBulan">,
  tmtKgbBerikutnyaTercatat?: string | null,
): HitunganFormulir {
  const acuan = hitungUsulan({
    golonganRuang: atas.golonganRuang,
    mkgTahun: atas.mkgTahun,
    mkgBulan: atas.mkgBulan,
    tmtKgbTerakhir: atas.tmtKgbTerakhir || null,
  });
  const jenis = dasar.jenis;
  if (jenis !== "kp" && jenis !== "pmk") return { acuan, sesudahSk: null };

  const golonganSk = (dasar.golongan ?? "").trim();
  const mkgSkDiisi = (dasar.mkgTahun ?? "") !== "" || (dasar.mkgBulan ?? "") !== "";
  const tmtSk = tanggalKalender(dasar.tmt);
  if ((jenis === "kp" && !golonganSk) || (jenis === "pmk" && !mkgSkDiisi) || !tmtSk) return { acuan, sesudahSk: null };
  if (!isGolonganDikenal(atas.golonganRuang))
    return { acuan, sesudahSk: { ok: false, pesan: "Isi golongan/ruang pada SK KGB terakhir di bagian atas lebih dulu." } };
  const tmtTerakhir = tanggalKalender(atas.tmtKgbTerakhir);
  if (tmtTerakhir && tmtSk < tmtTerakhir)
    return {
      acuan,
      sesudahSk: {
        ok: false,
        pesan: `TMT SK ini lebih awal dari TMT KGB terakhir (${formatTanggalId(tmtTerakhir)}), jadi bukan SK sesudah SK KGB terakhir. Periksa kembali kedua tanggalnya.`,
      },
    };

  const mkgTahun = angkaIsian(atas.mkgTahun);
  const mkgBulan = angkaIsian(atas.mkgBulan);
  const h = hitungSkDilaporkan(
    {
      golonganRuang: atas.golonganRuang,
      mkgTahun,
      mkgBulan,
      tmtKgbTerakhir: tmtTerakhir,
      tmtKgbBerikutnya: tanggalKalender(tmtKgbBerikutnyaTercatat) ?? acuan.tmtKgbBerikutnya,
    },
    {
      jenis,
      golonganBaru: jenis === "kp" ? golonganSk : atas.golonganRuang,
      mkgTahunSk: angkaIsian(dasar.mkgTahun),
      mkgBulanSk: angkaIsian(dasar.mkgBulan),
      tmt: tmtSk,
    },
  );
  if (!h.ok) return { acuan, sesudahSk: { ok: false, pesan: `${h.pesan.replace(/\.$/, "")}.` } };

  const mkgSk = mkgSkDiisi ? { tahun: angkaIsian(dasar.mkgTahun), bulan: angkaIsian(dasar.mkgBulan) } : { tahun: null, bulan: null };
  const cocok = jenis === "kp" ? cocokMkgSk(h.mkgPadaTmtSk, mkgSk) : null;
  const mkg = (m: MasaKerja) => `${m.tahun} tahun ${m.bulan} bulan`;
  const penjelasan =
    jenis === "kp"
      ? `${atas.golonganRuang} ${mkgTahun} tahun ${mkgBulan} bulan pada TMT KGB terakhir menjadi ${h.golonganRuang} ` +
        (h.kp && h.kp.potonganMkgTahun > 0
          ? `dengan masa kerja dipotong ${h.kp.potonganMkgTahun} tahun karena pindah jenjang golongan: ${mkg({ tahun: h.mkgTahun, bulan: h.mkgBulan })}`
          : `dengan masa kerja tetap ${mkg({ tahun: h.mkgTahun, bulan: h.mkgBulan })}`) +
        (h.mkgPadaTmtSk ? `, atau ${mkg(h.mkgPadaTmtSk)} pada TMT SK ${formatTanggalId(tmtSk)}. ` : ". ") +
        "Kenaikan pangkat tidak menggeser jadwal KGB."
      : `Tambahan masa kerja ${h.pmk ? `${Math.floor(h.pmk.tambahBulan / 12)} tahun ${h.pmk.tambahBulan % 12} bulan` : "-"}; ` +
        `masa kerja ${mkg({ tahun: h.mkgTahun, bulan: h.mkgBulan })} pada TMT KGB terakhir. PMK tidak menggeser jadwal KGB.`;
  return {
    acuan,
    sesudahSk: {
      ok: true,
      jenis,
      golongan: h.golonganRuang,
      pangkat: h.pangkat,
      mkg: { tahun: h.mkgTahun, bulan: h.mkgBulan },
      mkgPadaTmtSk: h.mkgPadaTmtSk,
      cocok,
      gajiPokok: h.gajiPokok,
      tmtKgbBerikutnya: h.tmtKgbBerikutnya,
      penjelasan,
    },
  };
}

/** Golongan dan masa kerja golongan menurut SK yang dilaporkan, sebagai isian teks. */
export interface IsianMenurutSk {
  golongan: string;
  mkgTahun: string;
  mkgBulan: string;
}

/**
 * Isian awal formulir dari draf atau data tercatat (ADR-078): keadaan pada SK acuan untuk bagian atas, golongan dan masa
 * kerja menurut SK yang dilaporkan untuk bagian SK.
 *
 * Draf yang menyimpan keadaan acuan dipisahkan apa adanya. Draf lama menyalin golongan dan masa kerja SK yang dilaporkan
 * ke isian utama: pada pegawai tercatat, bagian atas diisi data tercatat; pada pegawai baru, keadaan pada SK KGB
 * terakhirnya tidak diketahui sehingga dikosongkan untuk diisi.
 */
export function pisahkanIsianSk(input: {
  nilai: Record<string, string>;
  jenisSk: string | null | undefined;
  acuan: IsianMenurutSk | null | undefined;
  /** Data pegawai yang tercatat; null pada pegawai baru. */
  tercatat: Record<string, string> | null | undefined;
}): { atas: Record<string, string>; sk: IsianMenurutSk } {
  const { nilai, jenisSk, acuan, tercatat } = input;
  const kosong: IsianMenurutSk = { golongan: "", mkgTahun: "", mkgBulan: "" };
  if (jenisSk !== "kp" && jenisSk !== "pmk") return { atas: { ...nilai }, sk: kosong };

  const menurutSk: IsianMenurutSk = {
    golongan: jenisSk === "kp" ? nilai.golonganRuang ?? "" : "",
    mkgTahun: nilai.mkgTahun ?? "",
    mkgBulan: nilai.mkgBulan ?? "",
  };
  // Keadaan sebelum SK yang disimpan bersama SK-nya, termasuk yang dibetulkan UPT dari data tercatat (ADR-078, ADR-079).
  if (acuan) return { atas: { ...nilai, golonganRuang: acuan.golongan, mkgTahun: acuan.mkgTahun, mkgBulan: acuan.mkgBulan }, sk: menurutSk };
  if (tercatat) {
    const atas = { ...nilai, golonganRuang: tercatat.golonganRuang ?? "", mkgTahun: tercatat.mkgTahun ?? "", mkgBulan: tercatat.mkgBulan ?? "", tmtGolongan: tercatat.tmtGolongan ?? nilai.tmtGolongan ?? "" };
    // Draf lama kenaikan pangkat tidak memuat masa kerja menurut SK: isiannya sama dengan data tercatat.
    const mkgSama = (nilai.mkgTahun ?? "") === (tercatat.mkgTahun ?? "") && (nilai.mkgBulan ?? "") === (tercatat.mkgBulan ?? "");
    return { atas, sk: jenisSk === "kp" && mkgSama ? { ...menurutSk, mkgTahun: "", mkgBulan: "" } : menurutSk };
  }
  return {
    atas: { ...nilai, golonganRuang: jenisSk === "pmk" ? nilai.golonganRuang ?? "" : "", mkgTahun: "", mkgBulan: "" },
    sk: menurutSk,
  };
}

/**
 * Isian utama dan keadaan acuan yang dikirim ke server (ADR-078). Tanpa SK yang dilaporkan, isian utama adalah keadaan
 * pada SK acuan dan acuannya kosong. Dengan SK, isian utama adalah golongan dan masa kerja menurut SK itu (PMK tidak
 * mengubah golongan), dan keadaan pada SK acuan dikirim terpisah.
 */
export function isianUntukDisimpan(
  atas: Record<string, string>,
  dasar: Pick<IsianSkBaru, "jenis" | "golongan" | "mkgTahun" | "mkgBulan">,
): { nilai: Record<string, string>; acuan: { golonganAcuan: string; mkgTahunAcuan: string; mkgBulanAcuan: string } } {
  if (dasar.jenis !== "kp" && dasar.jenis !== "pmk")
    return { nilai: { ...atas }, acuan: { golonganAcuan: "", mkgTahunAcuan: "", mkgBulanAcuan: "" } };
  return {
    nilai: {
      ...atas,
      golonganRuang: dasar.jenis === "kp" ? dasar.golongan ?? "" : atas.golonganRuang ?? "",
      mkgTahun: dasar.mkgTahun ?? "",
      mkgBulan: dasar.mkgBulan ?? "",
    },
    acuan: { golonganAcuan: atas.golonganRuang ?? "", mkgTahunAcuan: atas.mkgTahun ?? "", mkgBulanAcuan: atas.mkgBulan ?? "" },
  };
}

/** Kalimat asal pratinjau Atas dasar. */
export function asalAtasDasar(p: PratinjauAtasDasar, skAcuan: string): string {
  if (p.asal === "laporan") return "Dari SK yang Anda laporkan; berlaku setelah usulan disetujui Kanwil.";
  if (p.asal === "tercatat") return "Sudah tercatat di SIM-KGB, jadi tidak perlu dilaporkan lagi.";
  return `${skAcuan} pada isian di atas.`;
}

/** Satu baris Atas dasar: label, nomor, dan TMT. */
export function teksAtasDasar(p: PratinjauAtasDasar): string {
  return `${p.label}${p.nomorSK ? ` ${p.nomorSK}` : ""}${p.tmt ? `, TMT ${formatTanggalId(p.tmt)}` : ""}`;
}

/**
 * Isian bagian atas yang berbeda dari data tercatat selagi SK sesudahnya dilaporkan: koreksi keadaan sebelum SK, yang
 * dihitung Kanwil bersama SK itu (ADR-079). Kosong bila sama.
 */
export function koreksiAtas(
  atas: Record<string, string>,
  tercatat: Record<string, string> | null | undefined,
): { label: string; lama: string; baru: string }[] {
  if (!tercatat) return [];
  const mkg = (t?: string, b?: string) => `${Number(t || 0)} thn ${Number(b || 0)} bln`;
  const tgl = (v?: string) => (v ? formatTanggalId(v) : "-");
  const hasil: { label: string; lama: string; baru: string }[] = [];
  if ((atas.golonganRuang ?? "") !== (tercatat.golonganRuang ?? ""))
    hasil.push({ label: "golongan", lama: tercatat.golonganRuang || "-", baru: atas.golonganRuang || "-" });
  if (Number(atas.mkgTahun || 0) * 12 + Number(atas.mkgBulan || 0) !== Number(tercatat.mkgTahun || 0) * 12 + Number(tercatat.mkgBulan || 0))
    hasil.push({ label: "masa kerja", lama: mkg(tercatat.mkgTahun, tercatat.mkgBulan), baru: mkg(atas.mkgTahun, atas.mkgBulan) });
  if ((atas.tmtKgbTerakhir ?? "") !== (tercatat.tmtKgbTerakhir ?? ""))
    hasil.push({ label: "TMT KGB terakhir", lama: tgl(tercatat.tmtKgbTerakhir), baru: tgl(atas.tmtKgbTerakhir) });
  if ((atas.tmtGolongan ?? "") !== (tercatat.tmtGolongan ?? ""))
    hasil.push({ label: "TMT golongan", lama: tgl(tercatat.tmtGolongan), baru: tgl(atas.tmtGolongan) });
  return hasil;
}

/**
 * Masa kerja golongan CPNS yang belum pernah KGB: langkah awal tabel golongannya, mis. 3 tahun bagi II/c (ADR-080).
 * Tombol "Belum pernah KGB" dan penggantian golongan selama belum pernah KGB mengisinya.
 */
export function isianMkgAwal(golongan: string): { mkgTahun: string; mkgBulan: string } {
  const awal = mkgAwalGolongan(golongan);
  return { mkgTahun: String(awal.tahun), mkgBulan: String(awal.bulan) };
}

/**
 * Keadaan awal "sudah pernah KGB" di formulir (ADR-080): pilihan yang tersimpan pada draf; selain itu SK KGB yang tercatat
 * sebagai dasar berarti sudah pernah; selain itu tebakan dari masa kerja golongan dan langkah awal tabelnya.
 */
export function pernahKgbAwal(
  keadaanKgb: string | null | undefined,
  dasarKgb: { jenis: string } | null | undefined,
  isian: { golonganRuang?: string; mkgTahun?: string; mkgBulan?: string },
): boolean {
  if (keadaanKgb === "pernah") return true;
  if (keadaanKgb === "belum") return false;
  return dasarKgb?.jenis === "kgb" || pernahKgb(isian.mkgTahun, isian.mkgBulan, isian.golonganRuang);
}

/**
 * Dampak SK yang dilaporkan pada KGB pegawai yang sedang berjalan (dipindah dari Lapor KP/PI/PMK, ADR-081). Laporan SK
 * mengubah golongan atau masa kerja: KGB yang sedang diproses dihitung ulang saat disetujui dan SK-nya dibuat ulang Tim SDM;
 * KGB yang SK-nya sudah ditandatangani dan diunggah tidak dapat diubah, jadi laporannya tertahan sampai Kanwil membatalkan
 * KGB itu. Tidak menghalangi penyimpanan atau pengiriman.
 */
export function peringatanDampakKgb(
  statusKgb: string | null | undefined,
  tmtKgb: string | null | undefined,
): { nada: "kuning" | "merah"; teks: string } | null {
  const tmt = tmtKgb ? ` TMT ${formatTanggalId(tmtKgb)}` : "";
  if (statusKgb === "sedang_diproses")
    return {
      nada: "kuning",
      teks:
        `KGB${tmt} sedang diproses Kanwil. Bila SK ini disetujui, hitungannya diperbarui dan SK KGB yang sudah dibuat ` +
        "perlu dibuat ulang oleh Tim SDM.",
    };
  if (statusKgb === "menunggu_keuangan")
    return {
      nada: "merah",
      teks:
        `SK KGB${tmt} sudah ditandatangani dan diunggah, sehingga golongan dan masa kerjanya tidak dapat diubah lagi. ` +
        "SK ini baru dapat diterapkan setelah Tim SDM Kanwil membatalkan KGB itu; hubungi mereka lebih dulu agar tidak tertahan.",
    };
  return null;
}

/**
 * Isian "Oleh" SK acuan sesudah nomornya diubah (ADR-086): isian yang kosong atau masih berupa saran dari nomor lama
 * diganti saran dari nomor baru; yang dipilih atau diketik sendiri dibiarkan.
 */
export function penetapSesudahNomor(penetap: string, nomorLama: string, nomorBaru: string): string {
  const saranLama = saranPenetapDariNomor(nomorLama) ?? "";
  if (penetap.trim() && penetap !== saranLama) return penetap;
  return saranPenetapDariNomor(nomorBaru) ?? "";
}

/** Keterangan di bawah isian "Oleh" SK acuan. */
export function petunjukPenetapAcuan(penetap: string, nomor: string): string {
  const saran = saranPenetapDariNomor(nomor);
  return saran && penetap === saran
    ? "Disarankan dari awalan nomor SK. Samakan dengan pejabat yang tertulis pada SK; ganti bila berbeda."
    : 'Pejabat yang menetapkan SK itu, sesuai tulisan pada SK. Menjadi baris "Oleh" pada SK KGB berikutnya.';
}
