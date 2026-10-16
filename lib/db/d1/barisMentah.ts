// Baris mentah (Postgres lewat PostgREST, atau D1) → baris kolom D1 (ADR-085): waktu ISO UTC, boolean 0/1, jsonb
// sebagai teks. Dipakai alat pemulihan cadangan, termasuk cadangan bentuk Postgres dari masa Supabase; tanpa ketergantungan lain supaya dapat
// diimpor skrip Node.

import { SKEMA_D1, type JenisKolomD1 } from "./skema";

type Baris = Record<string, unknown>;

export function nilaiD1(v: unknown, jenis: JenisKolomD1): unknown {
  if (v === undefined || v === null) return null;
  switch (jenis) {
    case "waktu": {
      const t = v instanceof Date ? v : new Date(String(v));
      return Number.isNaN(t.getTime()) ? String(v) : t.toISOString();
    }
    case "boolean":
      return v === true || v === 1 || v === "true" || v === "1" ? 1 : 0;
    case "bilangan": {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "json":
      return typeof v === "string" ? v : JSON.stringify(v);
    default:
      return typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
}

/** Baris mentah (Postgres atau D1) → baris kolom D1. Kolom yang tidak ada di sumber dilewati (nilai bawaan D1). */
export function barisKeD1(tabel: string, mentah: Baris): Baris {
  const skema = SKEMA_D1[tabel];
  if (!skema) throw new Error(`Tabel ${tabel} tidak ada di skema D1`);
  const hasil: Baris = {};
  for (const [kolom, jenis] of Object.entries(skema)) {
    if (Object.prototype.hasOwnProperty.call(mentah, kolom)) hasil[kolom] = nilaiD1(mentah[kolom], jenis);
  }
  return hasil;
}
