// Konversi nilai antara aplikasi dan JSON PostgREST. Aturannya meniru lapisan Google Sheets
// (serializeCell lalu parseCell di lib/sheets/table.ts) supaya perilaku aplikasi tidak berubah
// saat penyimpanan diganti: string kosong dibaca sebagai null, dan boolean mengikuti truthy nilainya.

import type { ColumnType } from "../../sheets/table";

/** Nilai aplikasi → nilai JSON untuk kolom Postgres. */
export function keJson(nilai: unknown, type: ColumnType): unknown {
  if (nilai === undefined || nilai === null) return null;
  if (type === "boolean") return Boolean(nilai);
  if (nilai === "") return null;
  switch (type) {
    case "datetime": {
      const tanggal = nilai instanceof Date ? nilai : new Date(String(nilai));
      return Number.isNaN(tanggal.getTime()) ? null : tanggal.toISOString();
    }
    case "int": {
      const angka = typeof nilai === "number" ? Math.trunc(nilai) : Number.parseInt(String(nilai), 10);
      return Number.isFinite(angka) ? angka : null;
    }
    case "float": {
      const angka = typeof nilai === "number" ? nilai : Number.parseFloat(String(nilai));
      return Number.isFinite(angka) ? angka : null;
    }
    case "json":
      return nilai;
    default:
      return String(nilai);
  }
}

/** Nilai JSON dari PostgREST → nilai aplikasi. */
export function dariJson(mentah: unknown, type: ColumnType): unknown {
  if (mentah === undefined || mentah === null) return null;
  switch (type) {
    case "datetime":
      return new Date(String(mentah));
    case "int":
      return typeof mentah === "number" ? mentah : Number.parseInt(String(mentah), 10);
    case "float":
      return typeof mentah === "number" ? mentah : Number.parseFloat(String(mentah));
    case "boolean":
      return mentah === true || mentah === "true";
    case "json":
      return mentah;
    default: {
      const teks = typeof mentah === "string" ? mentah : String(mentah);
      return teks === "" ? null : teks;
    }
  }
}
