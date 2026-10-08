// Cadangan otomatis seluruh basis data ke R2 (ADR-084). Dijalankan Cron Trigger dua kali sehari dan dapat diminta
// Super Admin kapan saja. Berbeda dengan cadangan bulanan per akun (ADR-018) yang berupa CSV untuk dibaca manusia,
// cadangan ini berisi baris Postgres apa adanya, sehingga dapat dikembalikan ke Supabase dengan
// scripts/pulihkan-cadangan.ts tanpa menebak jenis kolom.
//
// Bentuk berkas: JSON Lines yang dimampatkan gzip. Baris pertama kepala, lalu satu baris per baris tabel
// ({"t": tabel, "r": baris}), dan baris terakhir penutup berisi jumlah per tabel. Cadangan tanpa penutup berarti
// terputus saat disusun dan tidak boleh dipercaya utuh.

import { backendData, db, type Db } from "./db";
import { KOLOM_URUTAN, namaTabel } from "./db/supabase/nama";
import { rest } from "./db/supabase/rest";
import { ALL_DEFS } from "./sheets/tables";

export const AWALAN_CADANGAN = "cadangan/otomatis/";
/** Semua cadangan selama sekian hari terakhir disimpan. */
export const SIMPAN_HARIAN_HARI = 30;
/** Lebih lama dari itu, hanya cadangan pertama tiap bulan yang disimpan, selama sekian bulan. */
export const SIMPAN_BULANAN_BULAN = 12;
/** Cadangan terbaru sebanyak ini tidak pernah dibuang, apa pun tanggalnya. */
const SIMPAN_TERBARU = 3;
const VERSI = 1;
const UKURAN_HALAMAN = 1000;

/**
 * Kolom yang tidak ikut dicadangkan. Sandi akun (hash) tidak pernah keluar dari basis data, sama dengan cadangan
 * bulanan (ADR-018), karena berkas ini dapat diunduh Super Admin. Akun yang dipulihkan dari cadangan diberi sandi baru.
 */
const KOLOM_RAHASIA: Readonly<Record<string, readonly string[]>> = { users: ["password"] };

type Baris = Record<string, unknown>;

export interface SumberCadangan {
  /** "postgres": baris mentah Supabase (snake_case); "aplikasi": record lapisan data (camelCase), untuk uji lokal. */
  bentuk: "postgres" | "aplikasi";
  tabel: readonly string[];
  /** Baris satu tabel, per halaman. */
  baca(tabel: string): AsyncIterable<Baris[]>;
}

export interface HasilSusun {
  isi: Uint8Array;
  jumlah: Record<string, number>;
  total: number;
  ukuranMentah: number;
}

/** Nama tabel Postgres seluruh tabel aplikasi, sesuai urutan definisinya. */
export function tabelAplikasi(): string[] {
  return ALL_DEFS.map((d) => namaTabel(d.tab));
}

/** Sumber baris dari Supabase lewat Data API, per halaman 1000 menurut urutan baris dimasukkan. */
export function sumberSupabase(): SumberCadangan {
  return {
    bentuk: "postgres",
    tabel: tabelAplikasi(),
    async *baca(tabel: string) {
      for (let offset = 0; ; offset += UKURAN_HALAMAN) {
        const res = await rest(`${tabel}?select=*&order=${KOLOM_URUTAN}.asc&offset=${offset}&limit=${UKURAN_HALAMAN}`);
        const halaman = (await res.json()) as Baris[];
        if (halaman.length > 0) yield halaman;
        if (halaman.length < UKURAN_HALAMAN) return;
      }
    },
  };
}

/**
 * Nama tabel Postgres → kunci repository di `db`. Kunci db mengikuti nama tab (User → user, RiwayatKGB → riwayatKGB),
 * jadi dicocokkan tanpa memedulikan huruf besar.
 */
export function kunciDbTabel(): Map<string, keyof Db> {
  const kunciDb = new Map((Object.keys(db) as (keyof Db)[]).map((k) => [k.toLowerCase(), k]));
  const hasil = new Map<string, keyof Db>();
  for (const d of ALL_DEFS) {
    const kunci = kunciDb.get(d.tab.toLowerCase());
    if (kunci) hasil.set(namaTabel(d.tab), kunci);
  }
  return hasil;
}

/** Sumber baris dari lapisan data aplikasi (penyimpanan lokal atau Sheets); bentuknya record aplikasi. */
export function sumberAplikasi(): SumberCadangan {
  const kunciDb = kunciDbTabel();
  return {
    bentuk: "aplikasi",
    tabel: tabelAplikasi(),
    async *baca(tabel: string) {
      const kunci = kunciDb.get(tabel);
      if (!kunci) return;
      const semua = (await (db[kunci] as { findMany(): Promise<unknown[]> }).findMany()) as Baris[];
      if (semua.length > 0) yield semua;
    },
  };
}

export function sumberBawaan(): SumberCadangan {
  return backendData() === "supabase" ? sumberSupabase() : sumberAplikasi();
}

function tanpaRahasia(tabel: string, baris: Baris): Baris {
  const rahasia = KOLOM_RAHASIA[tabel];
  if (!rahasia) return baris;
  const salinan = { ...baris };
  // Kolom rahasia di sini satu kata, jadi namanya sama di baris Postgres maupun record aplikasi.
  for (const k of rahasia) delete salinan[k];
  return salinan;
}

/**
 * Susun seluruh tabel menjadi satu berkas JSON Lines bergzip. Ditulis per halaman ke aliran gzip, sehingga yang
 * tertahan di memori hanya satu halaman mentah dan hasil mampatannya.
 */
export async function susunCadangan(sumber: SumberCadangan, waktu: Date): Promise<HasilSusun> {
  const gzip = new CompressionStream("gzip");
  const penulis = gzip.writable.getWriter();
  const potongan: Uint8Array[] = [];
  // Dibaca bersamaan dengan penulisan; tanpa itu aliran gzip tertahan begitu penampungnya penuh.
  const pembacaan = (async () => {
    const pembaca = gzip.readable.getReader();
    for (;;) {
      const { done, value } = await pembaca.read();
      if (done) return;
      potongan.push(value);
    }
  })();
  const enc = new TextEncoder();
  let ukuranMentah = 0;
  const tulis = async (teks: string) => {
    const b = enc.encode(teks);
    ukuranMentah += b.byteLength;
    await penulis.write(b);
  };

  const jumlah: Record<string, number> = {};
  try {
    await tulis(
      JSON.stringify({ jenis: "kepala", aplikasi: "SIM-KGB", versi: VERSI, bentuk: sumber.bentuk, dibuat: waktu.toISOString(), tabel: sumber.tabel }) + "\n",
    );
    for (const tabel of sumber.tabel) {
      jumlah[tabel] = 0;
      for await (const halaman of sumber.baca(tabel)) {
        let teks = "";
        for (const b of halaman) teks += JSON.stringify({ t: tabel, r: tanpaRahasia(tabel, b) }) + "\n";
        jumlah[tabel] += halaman.length;
        await tulis(teks);
      }
    }
    const total = Object.values(jumlah).reduce((a, b) => a + b, 0);
    await tulis(JSON.stringify({ jenis: "akhir", jumlah, total }) + "\n");
    await penulis.close();
  } catch (e) {
    await penulis.abort(e).catch(() => {});
    await pembacaan.catch(() => {});
    throw e;
  }
  await pembacaan;

  const panjang = potongan.reduce((a, p) => a + p.byteLength, 0);
  const isi = new Uint8Array(panjang);
  let posisi = 0;
  for (const p of potongan) {
    isi.set(p, posisi);
    posisi += p.byteLength;
  }
  return { isi, jumlah, total: Object.values(jumlah).reduce((a, b) => a + b, 0), ukuranMentah };
}

/** Kunci objek cadangan: urut menurut waktu bila diurutkan sebagai teks. */
export function kunciCadangan(waktu: Date): string {
  return `${AWALAN_CADANGAN}${waktu.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-")}.jsonl.gz`;
}

export interface ObjekCadangan {
  key: string;
  uploaded: Date;
}

/**
 * Cadangan yang sudah boleh dibuang: semua yang berumur sampai SIMPAN_HARIAN_HARI disimpan, yang lebih tua
 * hanya cadangan pertama tiap bulan selama SIMPAN_BULANAN_BULAN bulan, dan SIMPAN_TERBARU cadangan terbaru selalu
 * disimpan.
 */
export function cadanganDibuang(daftar: readonly ObjekCadangan[], sekarang: Date): string[] {
  const urut = [...daftar].sort((a, b) => a.uploaded.getTime() - b.uploaded.getTime());
  const terbaru = new Set(urut.slice(-SIMPAN_TERBARU).map((o) => o.key));
  const batasHarian = sekarang.getTime() - SIMPAN_HARIAN_HARI * 86_400_000;
  const batasBulanan = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - SIMPAN_BULANAN_BULAN, 1));
  const bulanTerpakai = new Set<string>();
  const buang: string[] = [];
  for (const o of urut) {
    const bulan = o.uploaded.toISOString().slice(0, 7);
    const pertamaDiBulannya = !bulanTerpakai.has(bulan);
    bulanTerpakai.add(bulan);
    if (terbaru.has(o.key) || o.uploaded.getTime() >= batasHarian) continue;
    if (pertamaDiBulannya && o.uploaded >= batasBulanan) continue;
    buang.push(o.key);
  }
  return buang;
}

/** Bagian R2Bucket yang dipakai di sini, agar dapat diuji dengan tiruan. */
export interface BucketCadangan {
  put(key: string, value: Uint8Array, opsi?: R2PutOptions): Promise<unknown>;
  list(opsi: R2ListOptions): Promise<{ objects: { key: string; uploaded: Date; size: number; customMetadata?: Record<string, string> }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string | string[]): Promise<void>;
}

export interface RingkasCadangan {
  kunci: string;
  dibuat: string;
  ukuran: number;
  total: number;
  jumlah: Record<string, number>;
}

/** Susun lalu simpan satu cadangan ke R2. */
export async function buatCadangan(bucket: BucketCadangan, sumber: SumberCadangan, waktu = new Date()): Promise<RingkasCadangan> {
  const hasil = await susunCadangan(sumber, waktu);
  const kunci = kunciCadangan(waktu);
  await bucket.put(kunci, hasil.isi, {
    httpMetadata: { contentType: "application/gzip" },
    customMetadata: { total: String(hasil.total), bentuk: sumber.bentuk, jumlah: JSON.stringify(hasil.jumlah).slice(0, 1800) },
  });
  return { kunci, dibuat: waktu.toISOString(), ukuran: hasil.isi.byteLength, total: hasil.total, jumlah: hasil.jumlah };
}

/** Seluruh objek di bawah satu awalan. */
export async function daftarObjek(bucket: BucketCadangan, awalan: string) {
  const semua: Awaited<ReturnType<BucketCadangan["list"]>>["objects"] = [];
  let cursor: string | undefined;
  do {
    const hasil = await bucket.list({ prefix: awalan, cursor, include: ["customMetadata"] } as R2ListOptions);
    semua.push(...hasil.objects);
    cursor = hasil.truncated ? hasil.cursor : undefined;
  } while (cursor);
  return semua;
}

/** Buang cadangan yang sudah melewati masa simpan; mengembalikan jumlah yang dibuang. */
export async function pangkasCadangan(bucket: BucketCadangan, sekarang = new Date()): Promise<number> {
  const buang = cadanganDibuang(await daftarObjek(bucket, AWALAN_CADANGAN), sekarang);
  for (let i = 0; i < buang.length; i += 1000) await bucket.delete(buang.slice(i, i + 1000));
  return buang.length;
}
