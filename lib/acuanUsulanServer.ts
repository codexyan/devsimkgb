// Penyimpanan kolom SK acuan usulan (ADR-078) sebelum migrasinya dijalankan.
//
// Kolom golongan_acuan, mkg_tahun_acuan, dan mkg_bulan_acuan ditambahkan lewat migrasi manual
// (supabase/migrations/20261007120000_usulan_sk_acuan.sql). Kode dapat ter-deploy lebih dulu; penyimpanan yang berisi
// nilai acuan lalu ditolak PostgREST (PGRST204), dan rest() hanya melewati kolom yang belum ada bila nilainya kosong.
// Di sini simpanannya diulang tanpa acuan. Usulan tanpa acuan tetap sah: golongan dan masa kerja pada kolom utamanya
// adalah yang tertulis pada SK yang dilaporkan, dan dihitung seperti usulan lama (lib/dasarSkUsulan.ts).

//
// Kolom keadaan_kgb (ADR-080, migrasi 20261008090000_usulan_keadaan_kgb.sql) diperlakukan sama: bila belum ada,
// simpanannya diulang tanpa pilihan itu, dan keadaannya kembali ditebak dari masa kerja golongan.

import { GalatSupabase } from "./db/supabase/rest";
import { KOSONG_ACUAN, type AcuanUsulan } from "./usulanFormulir";

/** true bila galatnya karena kolom acuan belum ada di tabel usulan_pegawai. */
export function kolomAcuanBelumAda(e: unknown): boolean {
  return e instanceof GalatSupabase && e.kode === "PGRST204" && /_acuan'/.test(e.message);
}

/** true bila galatnya karena kolom keadaan_kgb belum ada di tabel usulan_pegawai. */
export function kolomKeadaanKgbBelumAda(e: unknown): boolean {
  return e instanceof GalatSupabase && e.kode === "PGRST204" && /'keadaan_kgb'/.test(e.message);
}

/** Tulis isian usulan; kolom yang belum dimigrasikan (acuan, keadaan KGB) dilepas lalu ditulis ulang. */
export async function tulisDenganAcuan<T extends Partial<AcuanUsulan> & { keadaanKgb?: string | null }>(
  isi: T,
  tulis: (isi: T) => Promise<unknown>,
): Promise<{ acuanTersimpan: boolean }> {
  let sekarang = isi;
  let acuanTersimpan = true;
  for (let coba = 0; ; coba++) {
    try {
      await tulis(sekarang);
      return { acuanTersimpan };
    } catch (e) {
      if (coba < 2 && kolomAcuanBelumAda(e)) {
        console.warn("[usulan] kolom SK acuan belum ada; usulan disimpan tanpa acuan. Jalankan migrasi 20261007120000_usulan_sk_acuan.sql.");
        sekarang = { ...sekarang, ...KOSONG_ACUAN };
        acuanTersimpan = false;
      } else if (coba < 2 && kolomKeadaanKgbBelumAda(e)) {
        console.warn("[usulan] kolom keadaan_kgb belum ada; pilihan pernah KGB tidak disimpan. Jalankan migrasi 20261008090000_usulan_keadaan_kgb.sql.");
        sekarang = { ...sekarang, keadaanKgb: null };
      } else throw e;
    }
  }
}

/** Seperti tulisDenganAcuan, untuk banyak baris sekaligus (unggah daftar). */
export async function tulisBanyakDenganAcuan<T extends Partial<AcuanUsulan>>(
  baris: T[],
  tulis: (baris: T[]) => Promise<unknown>,
): Promise<{ acuanTersimpan: boolean }> {
  try {
    await tulis(baris);
    return { acuanTersimpan: true };
  } catch (e) {
    if (!kolomAcuanBelumAda(e)) throw e;
    console.warn("[usulan] kolom SK acuan belum ada; unggahan disimpan tanpa acuan. Jalankan migrasi 20261007120000_usulan_sk_acuan.sql.");
    await tulis(baris.map((b) => ({ ...b, ...KOSONG_ACUAN })));
    return { acuanTersimpan: false };
  }
}
