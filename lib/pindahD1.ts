// Pemindahan data Supabase → Cloudflare D1 (ADR-085). Baris mentah Postgres dibaca lewat Data API, diubah ke bentuk
// kolom D1 (waktu ISO UTC, boolean 0/1, jsonb sebagai teks), lalu ditulis ke D1 dalam satu batch: seluruhnya
// berhasil, atau D1 tidak berubah sama sekali.
//
//   salin   : D1 dikosongkan lalu diisi ulang dari Supabase. Hanya selama Supabase masih basis data aktif.
//   susulan : hanya baris yang ada di Supabase tetapi belum ada di D1 (mis. tertulis tepat saat peralihan).
//   banding : jumlah baris dan selisih id per tabel di kedua sisi.

import { backendData } from "./db";
import { KOLOM_URUTAN } from "./db/supabase/nama";
import { rest } from "./db/supabase/rest";
import { klienD1, type KlienD1, type PernyataanD1 } from "./db/d1/klien";
import { SKEMA_D1 } from "./db/d1/skema";
import { barisKeD1 } from "./db/d1/barisMentah";

type Baris = Record<string, unknown>;

/** Urutan salin: tabel yang dirujuk foreign key lebih dulu. jejak_data terakhir (lihat salinSemua). */
export const URUTAN_SALIN = [
  "users", "profile_change_request", "regulasi", "hukdis_jenis", "hukdis_konfigurasi", "konfigurasi_kanwil",
  "penandatangan", "template_surat", "pegawai", "riwayat_kgb", "surat_kgb", "serah_terima", "review_sk_upt",
  "riwayat_hukdis", "riwayat_pangkat", "riwayat_pmk", "riwayat_mutasi", "laporan_mutasi", "laporan_hukdis",
  "usulan_pegawai", "notifikasi", "audit_log", "pengumuman_dilihat", "rekon_bulanan", "jejak_data",
] as const;

/** Ukuran kira-kira satu parameter JSON per pernyataan sisip; batas D1 untuk satu nilai 2 MB. */
const UKURAN_POTONGAN_BYTE = 300_000;
const UKURAN_HALAMAN = 1000;

/** Sumber baris mentah satu tabel; bawaannya Supabase. Uji memberi sumber tiruan. */
export type SumberMentah = (tabel: string) => Promise<Baris[]>;

export const sumberSupabaseMentah: SumberMentah = async (tabel) => {
  const urut = tabel === "jejak_data" ? "id" : KOLOM_URUTAN;
  const semua: Baris[] = [];
  for (let offset = 0; ; offset += UKURAN_HALAMAN) {
    const res = await rest(`${tabel}?select=*&order=${urut}.asc&offset=${offset}&limit=${UKURAN_HALAMAN}`);
    const halaman = (await res.json()) as Baris[];
    semua.push(...halaman);
    if (halaman.length < UKURAN_HALAMAN) return semua;
  }
};

/**
 * Pernyataan sisip banyak baris sekaligus: seluruh potongan dikirim sebagai satu parameter JSON dan dibongkar
 * json_each, karena D1 membatasi 100 parameter per pernyataan.
 */
function pernyataanSisip(db: KlienD1, tabel: string, baris: Baris[], abaikanYangAda: boolean): PernyataanD1[] {
  if (baris.length === 0) return [];
  const kolom = Object.keys(SKEMA_D1[tabel]).filter((k) => baris.some((b) => k in b));
  const sql =
    `INSERT ${abaikanYangAda ? "OR IGNORE " : ""}INTO ${tabel} (${kolom.join(", ")}) ` +
    `SELECT ${kolom.map((k) => `json_extract(value, '$.${k}')`).join(", ")} FROM json_each(?)`;
  const hasil: PernyataanD1[] = [];
  let potongan: Baris[] = [];
  let ukuran = 0;
  const kirim = () => {
    if (potongan.length === 0) return;
    hasil.push(db.prepare(sql).bind(JSON.stringify(potongan)));
    potongan = [];
    ukuran = 0;
  };
  for (const b of baris) {
    const u = JSON.stringify(b).length;
    if (ukuran + u > UKURAN_POTONGAN_BYTE) kirim();
    potongan.push(b);
    ukuran += u;
  }
  kirim();
  return hasil;
}

async function idD1(db: KlienD1, tabel: string): Promise<Set<string>> {
  const { results } = await db.prepare(`SELECT id FROM ${tabel}`).all<{ id: unknown }>();
  return new Set(results.map((r) => String(r.id)));
}

export interface BandingTabel {
  tabel: string;
  supabase: number;
  d1: number;
  /** id yang ada di Supabase tetapi belum ada di D1. */
  belumDiD1: number;
  /** id yang hanya ada di D1 (ditulis sesudah peralihan). */
  hanyaDiD1: number;
}

export async function bandingkan(sumber: SumberMentah = sumberSupabaseMentah): Promise<BandingTabel[]> {
  const db = await klienD1();
  const hasil: BandingTabel[] = [];
  for (const tabel of URUTAN_SALIN) {
    const asal = await sumber(tabel);
    const idAsal = new Set(asal.map((b) => String(b.id)));
    const idTujuan = await idD1(db, tabel);
    hasil.push({
      tabel,
      supabase: idAsal.size,
      d1: idTujuan.size,
      belumDiD1: [...idAsal].filter((id) => !idTujuan.has(id)).length,
      hanyaDiD1: [...idTujuan].filter((id) => !idAsal.has(id)).length,
    });
  }
  return hasil;
}

export interface HasilSalin {
  mode: "salin" | "susulan";
  ditulis: Record<string, number>;
  total: number;
}

/**
 * Kosongkan D1 lalu isi dengan seluruh data Supabase, dalam satu transaksi. Trigger jejak ikut mencatat penghapusan
 * isi D1 yang lama, jadi jejak_data dikosongkan dan disalin paling akhir: isinya sama persis dengan jejak di Supabase.
 */
export async function salinSemua(sumber: SumberMentah = sumberSupabaseMentah): Promise<HasilSalin> {
  if (backendData() === "d1") {
    throw new Error("D1 sudah menjadi basis data aktif. Menyalin ulang seluruhnya akan menghapus data baru; pakai susulan.");
  }
  const db = await klienD1();
  const data = new Map<string, Baris[]>();
  for (const tabel of URUTAN_SALIN) data.set(tabel, (await sumber(tabel)).map((b) => barisKeD1(tabel, b)));

  const pernyataan: PernyataanD1[] = [db.prepare("PRAGMA defer_foreign_keys = ON")];
  for (const tabel of [...URUTAN_SALIN].reverse()) pernyataan.push(db.prepare(`DELETE FROM ${tabel}`));
  for (const tabel of URUTAN_SALIN) {
    if (tabel === "jejak_data") pernyataan.push(db.prepare("DELETE FROM jejak_data"));
    pernyataan.push(...pernyataanSisip(db, tabel, data.get(tabel)!, false));
  }
  await db.batch(pernyataan);
  const ditulis = Object.fromEntries([...data].map(([t, b]) => [t, b.length]));
  return { mode: "salin", ditulis, total: Object.values(ditulis).reduce((a, b) => a + b, 0) };
}

/** Tambahkan baris Supabase yang belum ada di D1, tanpa mengubah baris yang sudah ada. Aman dijalankan kapan saja. */
export async function salinSusulan(sumber: SumberMentah = sumberSupabaseMentah): Promise<HasilSalin> {
  const db = await klienD1();
  const pernyataan: PernyataanD1[] = [db.prepare("PRAGMA defer_foreign_keys = ON")];
  const ditulis: Record<string, number> = {};
  // jejak_data dilewati: nomor jejak di D1 dan Supabase berjalan sendiri-sendiri sesudah peralihan, jadi id-nya tidak
  // dapat dipakai untuk mengenali jejak yang sama.
  for (const tabel of URUTAN_SALIN.filter((t) => t !== "jejak_data")) {
    const ada = await idD1(db, tabel);
    const baru = (await sumber(tabel)).filter((b) => !ada.has(String(b.id))).map((b) => barisKeD1(tabel, b));
    // Nomor urutan dari Supabase bisa sudah terpakai baris baru di D1, jadi baris susulan diberi nomor baru di ujung.
    const bebas = baru.map((b) => ({ ...b, [KOLOM_URUTAN]: null }));
    ditulis[tabel] = bebas.length;
    pernyataan.push(...pernyataanSisip(db, tabel, bebas, true));
  }
  if (pernyataan.length > 1) await db.batch(pernyataan);
  return { mode: "susulan", ditulis, total: Object.values(ditulis).reduce((a, b) => a + b, 0) };
}
