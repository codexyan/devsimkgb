// Kondisi (lib/db/kondisi.ts) → klausa WHERE SQLite untuk D1 (ADR-085). Aturan null dan operator sudah diselesaikan
// di pohon Kondisi, yang diuji sejalan dengan pencocokan JavaScript di lib/sheets/table.ts. Yang diatur di sini hanya
// bentuk SQL-nya dan jenis nilai yang dikirim.

import type { ColumnType } from "../../sheets/table";
import type { Kondisi, NilaiFilter } from "../kondisi";

export interface PotonganSql {
  sql: string;
  nilai: unknown[];
}

/**
 * Nilai filter → nilai SQLite menurut jenis kolom aplikasi. Waktu selalu ISO UTC seperti yang ditulis lapisan data,
 * sehingga perbandingan teks sama dengan perbandingan waktu. Boolean menjadi 0/1. Teks yang tidak dapat dibaca sebagai
 * waktu dibiarkan apa adanya (Postgres akan menolaknya; di sini tidak ada baris yang cocok).
 */
export function nilaiSql(v: NilaiFilter, type: ColumnType | undefined): unknown {
  if (type === "boolean") return v === true || v === "true" || v === 1 ? 1 : 0;
  if (type === "datetime") {
    const t = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(t.getTime()) ? String(v) : t.toISOString();
  }
  if (type === "int" || type === "float") {
    const angka = typeof v === "number" ? v : Number(v);
    return Number.isFinite(angka) ? angka : String(v);
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

const OPERATOR = { eq: "=", neq: "<>", lt: "<", lte: "<=", gt: ">", gte: ">=" } as const;

/** Kondisi → SQL dengan parameter. `jenis` memberi jenis kolom aplikasi menurut nama kolom SQL. */
export function keSql(k: Kondisi, jenis: (kolom: string) => ColumnType | undefined): PotonganSql {
  switch (k.jenis) {
    case "benar":
      return { sql: "1", nilai: [] };
    case "salah":
      return { sql: "0", nilai: [] };
    case "dan":
    case "atau": {
      const bagian = k.isi.map((x) => keSql(x, jenis));
      return {
        sql: `(${bagian.map((b) => b.sql).join(k.jenis === "dan" ? " AND " : " OR ")})`,
        nilai: bagian.flatMap((b) => b.nilai),
      };
    }
    case "banding":
      return { sql: `${k.kolom} ${OPERATOR[k.op]} ?`, nilai: [nilaiSql(k.nilai, jenis(k.kolom))] };
    case "kosong":
      return { sql: `${k.kolom} IS ${k.kosong ? "" : "NOT "}NULL`, nilai: [] };
    case "dalam": {
      // Seluruh daftar dikirim sebagai satu parameter JSON, karena D1 membatasi 100 parameter per pernyataan.
      const daftar = JSON.stringify(k.nilai.map((v) => nilaiSql(v, jenis(k.kolom))));
      return { sql: `${k.kolom} ${k.negasi ? "NOT IN" : "IN"} (SELECT value FROM json_each(?))`, nilai: [daftar] };
    }
    case "mirip":
      // Pola sudah huruf kecil dengan %, _, dan \ di-escape (polaMirip); sama dengan ILIKE Postgres untuk huruf ASCII.
      return { sql: `lower(${k.kolom}) LIKE ? ESCAPE '\\'`, nilai: [k.pola] };
  }
}
