// Lapisan repository generik di atas satu tab Google Sheets.
//
// Konsep: baris 1 tab = HEADER (nama kolom). Baris 2..n = data. Tiap kolom
// punya tipe agar nilai sel (selalu string di Sheets) di-coerce ke tipe JS yang
// benar dan sebaliknya. Filter (`where`) dan urut (`orderBy`) dijalankan DI JS
// setelah menarik seluruh tab, sebab Sheets tidak punya WHERE/ORDER BY.
//
// CATATAN JUJUR soal batasan (sengaja tidak disembunyikan):
//   • Tanpa transaksi/lock: operasi update = read-modify-write, rawan bentrok
//     bila dua pengguna menulis baris yang sama nyaris bersamaan.
//   • findMany menarik seluruh tab tiap panggilan, jadi makin banyak baris makin berat.

import {
  appendRows,
  clearValues,
  getValues,
  updateValues,
} from "./client";

export type ColumnType = "string" | "int" | "float" | "boolean" | "datetime" | "json";

export interface ColumnDef {
  name: string;
  type: ColumnType;
}

export interface TableDef {
  tab: string;
  columns: ColumnDef[];
}

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

/** Ubah indeks kolom 0-based → huruf kolom A1 (0→A, 26→AA). */
function colLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Posisi kolom `nama` pada baris sheet. Dicari menurut header; bila header di posisi definisinya masih
 * kosong, posisi definisi yang dipakai. Penulisan baris posisional dan kolom baru selalu ditambahkan di
 * ujung kanan, jadi kolom yang belum sempat diberi header (sinkronHeader belum dijalankan) tetap terbaca,
 * alih-alih nilainya tertulis tetapi hilang saat dibaca. Header lain di posisi itu berarti susunan sheet
 * berbeda, dan kolomnya dianggap tidak ada.
 */
export function indeksKolom(header: readonly (string | undefined)[], nama: string, posisi: number): number {
  const idx = header.indexOf(nama);
  if (idx >= 0) return idx;
  return (header[posisi] ?? "").trim() === "" ? posisi : -1;
}

function parseCell(raw: string | undefined, type: ColumnType): unknown {
  if (raw === undefined || raw === "") return null;
  switch (type) {
    case "int":
      return Number.parseInt(raw, 10);
    case "float":
      return Number.parseFloat(raw);
    case "boolean":
      return raw === "true" || raw === "TRUE" || raw === "1";
    case "datetime":
      return new Date(raw);
    case "json":
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    default:
      return raw;
  }
}

function serializeCell(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined) return "";
  switch (type) {
    case "datetime":
      return value instanceof Date ? value.toISOString() : String(value);
    case "boolean":
      return value ? "true" : "false";
    case "json":
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

function toComparable(v: unknown): number | string | boolean | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    // Perlakukan string yang jelas tanggal ISO sebagai waktu agar bisa dibanding.
    if (!Number.isNaN(t) && /\d{4}-\d{2}-\d{2}T/.test(v)) return t;
    return v;
  }
  return v as number | boolean;
}

/** Terapkan satu operator (contains/lt/in/...) pada nilai record. */
function applyOperator(rv: unknown, op: string, arg: unknown): boolean {
  switch (op) {
    case "equals":
      return matchesValue(rv, arg);
    case "not":
      return !matchesValue(rv, arg);
    case "contains":
      return String(rv ?? "").toLowerCase().includes(String(arg ?? "").toLowerCase());
    case "startsWith":
      return String(rv ?? "").toLowerCase().startsWith(String(arg ?? "").toLowerCase());
    case "in":
      return Array.isArray(arg) && arg.some((a) => matchesValue(rv, a));
    case "notIn":
      return Array.isArray(arg) && !arg.some((a) => matchesValue(rv, a));
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const a = toComparable(rv);
      const b = toComparable(arg);
      if (a === null || b === null) return false;
      if (op === "lt") return a < b;
      if (op === "lte") return a <= b;
      if (op === "gt") return a > b;
      return a >= b;
    }
    case "mode":
      return true; // penanda case-insensitive Prisma; contains sudah insensitif.
    default:
      return false;
  }
}

function matchesValue(rv: unknown, v: unknown): boolean {
  if (v instanceof Date) {
    return rv instanceof Date && rv.getTime() === v.getTime();
  }
  if (rv instanceof Date && typeof v === "string") {
    return rv.getTime() === new Date(v).getTime();
  }
  return rv === v;
}

/**
 * Cocokkan record terhadap `where`. Mendukung subset gaya Prisma:
 *   { nama: "x" }                         → kesetaraan
 *   { nama: { contains: "x" } }           → operator
 *   { aktif: true, status: { in: [...] }} → AND antar field
 *   { OR: [ {..}, {..} ] }                → salah satu benar
 *   { AND: [ {..}, {..} ] }               → semua benar
 */
export function matches(record: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") {
      return Array.isArray(v) && v.some((w) => matches(record, w as Where));
    }
    if (k === "AND") {
      return Array.isArray(v) && v.every((w) => matches(record, w as Where));
    }
    const rv = record[k];
    // Operator object (bukan Date, bukan array, bukan null).
    if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      return Object.entries(v as Record<string, unknown>).every(([op, arg]) =>
        applyOperator(rv, op, arg),
      );
    }
    return matchesValue(rv, v);
  });
}

export class Table<T extends object = Row> {
  constructor(private def: TableDef) {}

  private get lastCol(): string {
    return colLetter(this.def.columns.length - 1);
  }

  private get range(): string {
    return `${this.def.tab}!A1:${this.lastCol}`;
  }

  /** Baca seluruh tab → daftar record bertipe, sekaligus catat nomor baris fisik. */
  private async readAll(): Promise<{ record: T; rowNumber: number }[]> {
    const values = await getValues(this.range);
    if (values.length < 2) return [];
    const header = values[0];
    const out: { record: T; rowNumber: number }[] = [];
    for (let i = 1; i < values.length; i++) {
      const cells = values[i];
      // Lewati baris kosong (bekas hapus).
      if (!cells || cells.every((c) => c === "" || c === undefined)) continue;
      const record = {} as Row;
      this.def.columns.forEach((col, posisi) => {
        record[col.name] = parseCell(cells[indeksKolom(header, col.name, posisi)], col.type);
      });
      out.push({ record: record as T, rowNumber: i + 1 }); // 1-based, +1 utk header
    }
    return out;
  }

  private toCells(data: Partial<T>): string[] {
    return this.def.columns.map((col) =>
      serializeCell((data as Row)[col.name], col.type),
    );
  }

  async findMany(opts?: {
    where?: Where;
    orderBy?: { field: keyof T & string; dir?: "asc" | "desc" };
  }): Promise<T[]> {
    const rows = await this.readAll();
    let result = rows.map((r) => r.record).filter((r) => matches(r as Row, opts?.where));
    if (opts?.orderBy) {
      const { field, dir = "asc" } = opts.orderBy;
      result = [...result].sort((a, b) => {
        const av = a[field] as unknown;
        const bv = b[field] as unknown;
        let cmp = 0;
        if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
        else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv));
        return dir === "desc" ? -cmp : cmp;
      });
    }
    return result;
  }

  async findUnique(where: Where): Promise<T | null> {
    const rows = await this.readAll();
    return rows.find((r) => matches(r.record as Row, where))?.record ?? null;
  }

  async count(where?: Where): Promise<number> {
    const rows = await this.readAll();
    return rows.filter((r) => matches(r.record as Row, where)).length;
  }

  async create(data: T): Promise<T> {
    await appendRows(`${this.def.tab}!A1`, [this.toCells(data)]);
    return data;
  }

  /** Tambah banyak baris sekaligus (satu request append). */
  async createMany(rows: T[]): Promise<number> {
    if (rows.length === 0) return 0;
    await appendRows(`${this.def.tab}!A1`, rows.map((r) => this.toCells(r)));
    return rows.length;
  }

  /** Update record pertama yang cocok `where`. Mengembalikan record tergabung. */
  async update(where: Where, data: Partial<T>): Promise<T | null> {
    const rows = await this.readAll();
    const target = rows.find((r) => matches(r.record as Row, where));
    if (!target) return null;
    const merged = { ...target.record, ...data } as T;
    const rowRange = `${this.def.tab}!A${target.rowNumber}:${this.lastCol}${target.rowNumber}`;
    await updateValues(rowRange, [this.toCells(merged)]);
    return merged;
  }

  /** Update SEMUA record yang cocok `where`. Mengembalikan jumlah terpengaruh. */
  async updateMany(where: Where, data: Partial<T>): Promise<number> {
    const rows = await this.readAll();
    const targets = rows.filter((r) => matches(r.record as Row, where));
    for (const t of targets) {
      const merged = { ...t.record, ...data } as T;
      const rowRange = `${this.def.tab}!A${t.rowNumber}:${this.lastCol}${t.rowNumber}`;
      await updateValues(rowRange, [this.toCells(merged)]);
    }
    return targets.length;
  }

  /** "Hapus" = kosongkan baris fisik (baris kosong dilewati saat baca). */
  async delete(where: Where): Promise<boolean> {
    const rows = await this.readAll();
    const target = rows.find((r) => matches(r.record as Row, where));
    if (!target) return false;
    const rowRange = `${this.def.tab}!A${target.rowNumber}:${this.lastCol}${target.rowNumber}`;
    await clearValues(rowRange);
    return true;
  }

  /** Hapus SEMUA record yang cocok `where`. Mengembalikan jumlah terhapus. */
  async deleteMany(where: Where): Promise<number> {
    const rows = await this.readAll();
    const targets = rows.filter((r) => matches(r.record as Row, where));
    for (const t of targets) {
      const rowRange = `${this.def.tab}!A${t.rowNumber}:${this.lastCol}${t.rowNumber}`;
      await clearValues(rowRange);
    }
    return targets.length;
  }
}
