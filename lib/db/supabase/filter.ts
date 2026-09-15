// Menerjemahkan filter gaya Prisma (`Where`) ke filter PostgREST. Hasilnya harus sama dengan
// pencocokan JavaScript di lib/sheets/table.ts, termasuk untuk nilai null: di SQL, perbandingan
// dengan NULL tidak pernah benar, jadi beberapa operator perlu tambahan `is.null`.
//
// Terjemahan dibuat dua langkah: Where → Kondisi (pohon logika) → parameter query. Pohon yang
// sama dipakai tes untuk membandingkan hasilnya dengan pencocokan lapisan Sheets.

import { matches } from "../../sheets/table";
import type { Where } from "../repo";

export type NilaiFilter = string | number | boolean | Date;

export type Kondisi =
  | { jenis: "benar" }
  | { jenis: "salah" }
  | { jenis: "dan"; isi: Kondisi[] }
  | { jenis: "atau"; isi: Kondisi[] }
  | { jenis: "banding"; kolom: string; op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte"; nilai: NilaiFilter }
  | { jenis: "kosong"; kolom: string; kosong: boolean }
  | { jenis: "dalam"; kolom: string; nilai: NilaiFilter[]; negasi: boolean }
  | { jenis: "mirip"; kolom: string; pola: string };

export const BENAR: Kondisi = { jenis: "benar" };
export const SALAH: Kondisi = { jenis: "salah" };

export function dan(isi: Kondisi[]): Kondisi {
  const sisa: Kondisi[] = [];
  for (const k of isi) {
    if (k.jenis === "salah") return SALAH;
    if (k.jenis === "benar") continue;
    if (k.jenis === "dan") sisa.push(...k.isi);
    else sisa.push(k);
  }
  if (sisa.length === 0) return BENAR;
  return sisa.length === 1 ? sisa[0] : { jenis: "dan", isi: sisa };
}

export function atau(isi: Kondisi[]): Kondisi {
  const sisa: Kondisi[] = [];
  for (const k of isi) {
    if (k.jenis === "benar") return BENAR;
    if (k.jenis === "salah") continue;
    if (k.jenis === "atau") sisa.push(...k.isi);
    else sisa.push(k);
  }
  if (sisa.length === 0) return SALAH;
  return sisa.length === 1 ? sisa[0] : { jenis: "atau", isi: sisa };
}

const isObjekOperator = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);

/** Nilai yang bisa dibandingkan. Tanggal tidak valid dan NaN tidak pernah cocok di lapisan Sheets. */
function isNilai(v: unknown): v is NilaiFilter {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === "number") return !Number.isNaN(v);
  return typeof v === "string" || typeof v === "boolean";
}

const kosong = (kolom: string, nilai: boolean): Kondisi => ({ jenis: "kosong", kolom, kosong: nilai });

/** Kesetaraan `{ kolom: nilai }`. */
function sama(kolom: string, v: unknown): Kondisi {
  if (v === null) return kosong(kolom, true);
  return isNilai(v) ? { jenis: "banding", kolom, op: "eq", nilai: v } : SALAH;
}

/** Pola ILIKE untuk contains/startsWith. %, _, dan \ di teks dicari apa adanya. */
function polaMirip(v: unknown, awalan: boolean): string {
  const teks = String(v ?? "").toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  return awalan ? `${teks}%` : `%${teks}%`;
}

function operator(kolom: string, op: string, arg: unknown): Kondisi {
  switch (op) {
    case "equals":
      return sama(kolom, arg);
    case "not":
      if (arg === null) return kosong(kolom, false);
      // Kolom null juga "tidak sama dengan" nilai apa pun.
      return isNilai(arg) ? atau([{ jenis: "banding", kolom, op: "neq", nilai: arg }, kosong(kolom, true)]) : BENAR;
    case "contains":
    case "startsWith":
      if (String(arg ?? "") === "") return BENAR;
      return { jenis: "mirip", kolom, pola: polaMirip(arg, op === "startsWith") };
    case "in":
    case "notIn": {
      if (!Array.isArray(arg)) return SALAH;
      const nilai = arg.filter(isNilai);
      const adaNull = arg.some((a) => a === null);
      if (op === "in") {
        return atau([
          nilai.length > 0 ? { jenis: "dalam", kolom, nilai, negasi: false } : SALAH,
          adaNull ? kosong(kolom, true) : SALAH,
        ]);
      }
      if (nilai.length === 0) return adaNull ? kosong(kolom, false) : BENAR;
      const bukanDaftar: Kondisi = { jenis: "dalam", kolom, nilai, negasi: true };
      // NOT IN tidak benar untuk kolom null, padahal di JavaScript null memang tidak ada di daftar.
      return adaNull ? dan([bukanDaftar, kosong(kolom, false)]) : atau([bukanDaftar, kosong(kolom, true)]);
    }
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return isNilai(arg) ? { jenis: "banding", kolom, op, nilai: arg } : SALAH;
    case "mode":
      return BENAR;
    default:
      return SALAH;
  }
}

/**
 * Where → Kondisi. `kolom` memetakan nama kolom aplikasi ke nama kolom Postgres, atau null bila
 * kolom tidak didefinisikan.
 */
export function keKondisi(where: Where | null | undefined, kolom: (nama: string) => string | null): Kondisi {
  if (!where) return BENAR;
  const bagian: Kondisi[] = [];
  for (const [kunci, nilai] of Object.entries(where)) {
    if (kunci === "OR") {
      bagian.push(Array.isArray(nilai) ? atau(nilai.map((w) => keKondisi(w as Where, kolom))) : SALAH);
      continue;
    }
    if (kunci === "AND") {
      bagian.push(Array.isArray(nilai) ? dan(nilai.map((w) => keKondisi(w as Where, kolom))) : SALAH);
      continue;
    }
    const namaKolom = kolom(kunci);
    if (namaKolom === null) {
      // Kolom yang tidak didefinisikan selalu bernilai undefined, jadi hasilnya sama untuk semua baris.
      bagian.push(matches({}, { [kunci]: nilai }) ? BENAR : SALAH);
      continue;
    }
    bagian.push(
      isObjekOperator(nilai)
        ? dan(Object.entries(nilai).map(([op, arg]) => operator(namaKolom, op, arg)))
        : sama(namaKolom, nilai),
    );
  }
  return dan(bagian);
}

/** Nilai dalam tanda kutip PostgREST; kutip dan backslash di dalamnya di-escape. */
function kutip(nilai: NilaiFilter): string {
  const teks = nilai instanceof Date ? nilai.toISOString() : String(nilai);
  return `"${teks.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function keTeks(k: Kondisi): string {
  switch (k.jenis) {
    case "dan":
      return `and(${k.isi.map(keTeks).join(",")})`;
    case "atau":
      return `or(${k.isi.map(keTeks).join(",")})`;
    case "banding":
      return `${k.kolom}.${k.op}.${kutip(k.nilai)}`;
    case "kosong":
      return k.kosong ? `${k.kolom}.is.null` : `${k.kolom}.not.is.null`;
    case "dalam":
      return `${k.kolom}.${k.negasi ? "not.in" : "in"}.(${k.nilai.map(kutip).join(",")})`;
    case "mirip":
      return `${k.kolom}.ilike.${kutip(k.pola)}`;
    default:
      throw new Error(`Kondisi "${k.jenis}" tidak bisa dikirim sebagai filter`);
  }
}

/**
 * Kondisi → satu parameter query PostgREST (`and=(...)` atau `or=(...)`), atau null bila tanpa filter.
 * Kondisi yang selalu salah harus ditangani pemanggil tanpa mengirim request.
 */
export function keParameter(k: Kondisi): string | null {
  if (k.jenis === "benar") return null;
  if (k.jenis === "salah") throw new Error("Kondisi yang selalu salah tidak perlu dikirim ke Supabase");
  const [nama, isi] = k.jenis === "atau" ? ["or", k.isi] : ["and", k.jenis === "dan" ? k.isi : [k]];
  return `${nama}=${encodeURIComponent(`(${isi.map(keTeks).join(",")})`)}`;
}
