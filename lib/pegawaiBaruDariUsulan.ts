// Baris pegawai yang dibentuk dari usulan pegawai baru UPT.
//
// Dipakai dua tempat dengan hasil yang harus identik: persetujuan Kanwil (lib/setujuiUsulan.ts) dan pembuatan langsung
// begitu draf pegawai baru lengkap (lib/terdatakanPegawaiBaru.ts, ADR-112). Hitungannya (masa kerja golongan, gaji pokok,
// dan jadwal KGB menurut SK sesudah SK KGB terakhir) murni, jadi dapat diuji tanpa lapisan data.

import { getGajiPokok, getPangkat } from "./tabelGaji";
import { SATKER } from "./satker";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";
import { hitungSkPegawaiBaru } from "./dasarSkUsulan";
import { penetapSesudahUsulan } from "./penetapSk";
import { perubahanPegawai } from "./usulanPegawai";

export type SkBaruUsulan = ReturnType<typeof hitungSkPegawaiBaru>;

export type HasilSusunPegawaiBaru =
  | {
      ok: true;
      pegawai: PegawaiRow;
      /** Hitungan SK sesudah SK KGB terakhir; dipakai persetujuan untuk mencatat riwayat KP atau PMK. */
      skBaru: SkBaruUsulan;
      /** Keadaan pada SK KGB terakhir (ADR-078); null bila tidak ada SK sesudahnya. */
      acuan: Extract<SkBaruUsulan, { berlaku: true; ok: true }>["acuan"] | null;
    }
  | { ok: false; pesan: string };

/**
 * Susun baris pegawai dari usulan pegawai baru. Gaji pokok dihitung dari tabel PP 5/2024 bila UPT tidak mengisinya, dan
 * SK kenaikan pangkat, penyesuaian ijazah, atau PMK sesudah SK KGB terakhir (ADR-065) menentukan golongan, masa kerja,
 * gaji pokok, dan jadwal KGB berikutnya. SK dasar yang diketik UPT menjadi SK dasar Input KGB pertama (ADR-010).
 */
export function susunPegawaiBaru(usulan: UsulanPegawaiRow, id: string, sekarang: Date): HasilSusunPegawaiBaru {
  const nilaiBaru = perubahanPegawai(usulan);
  const nip = usulan.nip ?? "";
  if (!/^\d{18}$/.test(nip)) return { ok: false, pesan: "Usulan pegawai baru tidak memuat NIP yang sah" };

  const golongan = String(nilaiBaru.golonganRuang ?? "");
  const skBaru = hitungSkPegawaiBaru(usulan);
  if (skBaru.berlaku && !skBaru.ok)
    return { ok: false, pesan: `SK sesudah SK KGB terakhir tidak dapat dihitung: periksa ${skBaru.pesan}.` };
  const menurutSk = skBaru.berlaku && skBaru.ok ? skBaru.nilai : null;
  // Keadaan pada SK KGB terakhir yang ditulis UPT bersama SK-nya (ADR-078); null pada usulan lama.
  const acuan = skBaru.berlaku && skBaru.ok ? skBaru.acuan : null;
  const mkgTahun = menurutSk ? menurutSk.mkgTahun : Number(nilaiBaru.mkgTahun ?? 0);
  const mkgBulan = menurutSk ? menurutSk.mkgBulan : Number(nilaiBaru.mkgBulan ?? 0);
  const tmtKgbBerikutnya = menurutSk ? menurutSk.tmtKgbBerikutnya : ((nilaiBaru.tmtKgbBerikutnya as Date | null) ?? null);
  const unitKerja = usulan.unitKerja ?? SATKER.find((s) => s.kode === usulan.satker)?.nama ?? "";

  const pegawai: PegawaiRow = {
    id,
    nip,
    nama: String(nilaiBaru.nama ?? ""),
    tempatLahir: (nilaiBaru.tempatLahir as string | null) ?? null,
    tanggalLahir: (nilaiBaru.tanggalLahir as Date | null) ?? null,
    jenisKelamin: (nilaiBaru.jenisKelamin as string | null) ?? null,
    pendidikanTerakhir: (nilaiBaru.pendidikanTerakhir as string | null) ?? null,
    jabatan: String(nilaiBaru.jabatan ?? ""),
    // Pangkat mengikuti golongan bila UPT tidak menuliskannya.
    pangkat: String(nilaiBaru.pangkat ?? getPangkat(golongan) ?? ""),
    golonganRuang: golongan,
    unitKerja,
    eselon: (nilaiBaru.eselon as string | null) ?? null,
    jenisJabatan: (nilaiBaru.jenisJabatan as string | null) ?? null,
    // TMT golongan pada usulan ber-acuan adalah TMT golongan pada SK KGB terakhir; golongan barunya berlaku sejak TMT
    // kenaikan pangkat, sama dengan Catat KP.
    tmtGolongan:
      acuan && skBaru.berlaku && skBaru.ok && skBaru.jenis === "kp" ? skBaru.tmtSk : ((nilaiBaru.tmtGolongan as Date | null) ?? null),
    mkgTahun,
    mkgBulan,
    // Gaji pokok dihitung dari tabel PP 5/2024 bila tidak diisi, sama dengan impor CSV.
    gajiPokok: menurutSk ? menurutSk.gajiPokok : Number(nilaiBaru.gajiPokok ?? 0) || getGajiPokok(golongan, mkgTahun, mkgBulan) || 0,
    tmtKgbTerakhir: (nilaiBaru.tmtKgbTerakhir as Date | null) ?? null,
    tmtKgbBerikutnya,
    statusHukdis: false,
    tanggalHukdisBerakhir: null,
    jenisHukdis: null,
    keteranganHukdis: null,
    aktif: true,
    createdAt: sekarang,
    updatedAt: sekarang,
    konfirmasiUptTmt: tmtKgbBerikutnya,
    konfirmasiUptAt: sekarang,
    konfirmasiUptOleh: usulan.diajukanOleh,
    satkerTugas: null,
    berhentiTmt: null,
    berhentiAlasan: null,
    // SK yang diketik UPT pada usulan (SK CPNS, atau SK KGB terakhir di luar SIM-KGB) menjadi SK dasar
    // Input KGB pertama, jadi Tim SDM tidak mengetiknya ulang (ADR-010).
    nomorSkDasar: usulan.nomorSkTerakhir?.trim() || null,
    tanggalSkDasar: usulan.tanggalSkTerakhir ?? null,
    // Pejabat penetap SK itu: isian UPT, atau saran dari awalan nomornya (ADR-086). Kosong diisi Kanwil saat Input KGB.
    penetapSkDasar: penetapSesudahUsulan(null, usulan) ?? null,
  };
  return { ok: true, pegawai, skBaru, acuan };
}

/**
 * Kolom yang ditulis ulang pada pegawai yang sudah terbentuk dari usulan yang sama, baik saat persetujuan melanjutkan
 * pegawai yang terbentuk lebih dulu (ADR-079) maupun saat draf disunting sebelum ditinjau (ADR-112). Yang dicatat Kanwil
 * sesudahnya dibiarkan: hukuman disiplin, mutasi dan pemberhentian, penanda aktif, dan penetap SK dasar.
 */
export function isiPembaruanPegawaiBaru(pegawai: PegawaiRow): Omit<
  PegawaiRow,
  | "id"
  | "createdAt"
  | "statusHukdis"
  | "tanggalHukdisBerakhir"
  | "jenisHukdis"
  | "keteranganHukdis"
  | "aktif"
  | "satkerTugas"
  | "berhentiTmt"
  | "berhentiAlasan"
  | "penetapSkDasar"
> {
  const {
    id: _id, createdAt: _dibuat, statusHukdis: _h1, tanggalHukdisBerakhir: _h2, jenisHukdis: _h3, keteranganHukdis: _h4,
    aktif: _aktif, satkerTugas: _tugas, berhentiTmt: _b1, berhentiAlasan: _b2, penetapSkDasar: _penetap, ...isi
  } = pegawai;
  return isi;
}
