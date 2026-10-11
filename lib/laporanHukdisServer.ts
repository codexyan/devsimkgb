// Bagian server modul laporan hukdis UPT (ADR-016): pindaian SK di R2 dan penanda tabel yang belum
// dimigrasikan. Dipisah dari lib/laporanHukdis.ts, yang harus tetap murni untuk peramban dan uji.

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BATAS_BERKAS_BYTE, PESAN_TERLALU_BESAR, hapusBerkasUsulan } from "./berkasUsulan";
import { kunciBerkasUsulan } from "./usulanPegawai";
import { adaPenandaPdf } from "./prosesKgb";

/** Nama field berkas pada formulir, sekaligus penanda jenis berkas di kunci objeknya. */
export const MEDAN_SK_HUKDIS = "skHukdis";

/** Pesan bagi pengguna selama tabel laporan_hukdis belum dibuat di basis data. */
export const PESAN_BELUM_AKTIF =
  "Modul laporan hukuman disiplin belum aktif: tabel laporan_hukdis belum dibuat di basis data. Minta pengelola menjalankan migrasinya.";

// Dipakai bersama tabel baru lain; tetap diekspor dari sini agar pemanggil lama tidak berubah.
export { tabelBelumAda } from "./db/tabelBelumAda";

/**
 * Simpan pindaian SK hukuman disiplin bila formulir menyertakannya. Pemeriksaannya sama dengan berkas
 * usulan (PDF sungguhan, paling besar 500 KB), dan kuncinya memakai folder serta pola nama yang sama agar
 * rute pembuka berkas dan pembaca nama aslinya dapat dipakai ulang.
 */
export async function simpanSkHukdis(
  form: FormData,
  kode: string,
): Promise<{ jalur: string | null } | { galat: NextResponse }> {
  const isi = form.get(MEDAN_SK_HUKDIS);
  if (!(isi instanceof File) || isi.size === 0) return { jalur: null };
  if (isi.type !== "application/pdf")
    return { galat: NextResponse.json({ error: "SK hukuman disiplin harus berupa PDF" }, { status: 400 }) };
  if (isi.size > BATAS_BERKAS_BYTE) return { galat: NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 }) };
  if (!adaPenandaPdf(new Uint8Array(await isi.slice(0, 1024).arrayBuffer())))
    return { galat: NextResponse.json({ error: "SK hukuman disiplin bukan PDF yang valid" }, { status: 400 }) };
  const kunciObjek = kunciBerkasUsulan(kode, MEDAN_SK_HUKDIS, Date.now(), isi.name);
  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.SK_BUCKET.put(kunciObjek, await isi.arrayBuffer(), { httpMetadata: { contentType: "application/pdf" } });
  } catch {
    return { galat: NextResponse.json({ error: "Gagal menyimpan pindaian SK. Coba lagi." }, { status: 500 }) };
  }
  return { jalur: kunciObjek };
}

/** Hapus pindaian SK laporan yang dibatalkan atau digantikan; best effort seperti berkas usulan. */
export async function hapusSkHukdis(jalur: string | null | undefined): Promise<void> {
  if (jalur) await hapusBerkasUsulan([jalur]);
}
