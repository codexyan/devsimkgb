// Berkas pendukung usulan UPT di R2: penyimpanan dan penghapusannya. Dipakai bersama oleh rute
// penyimpanan draf, penyuntingan draf, dan pembatalan usulan, agar aturan ukuran dan pemeriksaan
// bentuk PDF-nya satu tempat saja.

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BERKAS_USULAN } from "./usulanPegawai";
import { adaPenandaPdf } from "./prosesKgb";

/**
 * Batas ukuran tiap berkas. Satu lembar SK yang dipindai sebagai dokumen berukuran ratusan kilobyte;
 * yang melampaui satu megabyte hampir selalu foto kamera beresolusi penuh yang dibungkus PDF. Batas ini
 * menahan berkas semacam itu sejak awal, sebab operator UPT mengunggah lewat data seluler dan unggahan
 * besar yang putus di tengah jalan jauh lebih menyakitkan daripada ditolak sejak awal.
 */
export const BATAS_BERKAS_BYTE = 1024 * 1024;
export const PESAN_TERLALU_BESAR =
  "Ukuran tiap berkas paling besar 1 MB. Pindai SK sebagai dokumen hitam putih, atau perkecil berkasnya, lalu unggah kembali.";

export type KunciBerkasUsulan = (typeof BERKAS_USULAN)[number]["kunci"];
type Bucket = { delete(keys: string | string[]): Promise<void> };

/**
 * Simpan berkas PDF yang disertakan formulir. Hanya berkas yang benar-benar dikirim yang disimpan,
 * sehingga penyuntingan draf tanpa mengunggah ulang tidak menghapus berkas yang sudah ada.
 */
export async function simpanBerkasUsulan(
  form: FormData,
  kode: string,
): Promise<{ jalur: Partial<Record<KunciBerkasUsulan, string>> } | { galat: NextResponse }> {
  const jalur: Partial<Record<KunciBerkasUsulan, string>> = {};
  for (const berkas of BERKAS_USULAN) {
    const isi = form.get(berkas.medan);
    if (!(isi instanceof File) || isi.size === 0) continue;
    if (isi.type !== "application/pdf")
      return { galat: NextResponse.json({ error: `${berkas.label} harus berupa PDF` }, { status: 400 }) };
    if (isi.size > BATAS_BERKAS_BYTE)
      return { galat: NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 }) };
    if (!adaPenandaPdf(new Uint8Array(await isi.slice(0, 1024).arrayBuffer())))
      return { galat: NextResponse.json({ error: `${berkas.label} bukan PDF yang valid` }, { status: 400 }) };
    const kunciObjek = `usulan/${kode}_${berkas.medan}_${Date.now()}.pdf`;
    try {
      const { env } = await getCloudflareContext({ async: true });
      await env.SK_BUCKET.put(kunciObjek, await isi.arrayBuffer(), { httpMetadata: { contentType: "application/pdf" } });
    } catch {
      return { galat: NextResponse.json({ error: `Gagal menyimpan ${berkas.label}. Coba lagi.` }, { status: 500 }) };
    }
    jalur[berkas.kunci] = kunciObjek;
  }
  return { jalur };
}

/**
 * Hapus objek berkas usulan. Best effort: kegagalannya tidak membatalkan perubahan basis data, karena
 * berkas yatim di R2 tidak terlihat pengguna dan tidak menghalangi apa pun.
 */
export async function hapusBerkasUsulan(jalur: readonly string[]): Promise<void> {
  const daftar = jalur.filter(Boolean);
  if (daftar.length === 0) return;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as unknown as { SK_BUCKET?: Bucket }).SK_BUCKET;
    if (bucket) await bucket.delete([...daftar]);
  } catch {
    // Diabaikan dengan sengaja; lihat keterangan di atas.
  }
}
