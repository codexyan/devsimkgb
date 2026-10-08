// Repository generik di atas satu tabel Cloudflare D1 (ADR-085), dengan perilaku yang sama seperti SupabaseTable
// (lib/db/supabase/table.ts) dan Table Sheets: urutan bawaan mengikuti urutan data dimasukkan (urutan_sisip), update dan
// delete menyasar record pertama yang cocok, dan string kosong disimpan sebagai null.

import type { ColumnType, TableDef } from "../../sheets/table";
import type { OrderBy, Repo, Where } from "../repo";
import { keKondisi, type Kondisi } from "../supabase/filter";
import { KOLOM_URUTAN, keSnake, namaTabel } from "../supabase/nama";
import { keJson } from "../supabase/nilai";
import { BATAS_PARAMETER_D1, klienD1, type PernyataanD1 } from "./klien";
import { keSql, type PotonganSql } from "./sql";

type Row = Record<string, unknown>;

/** Pernyataan per batch D1 saat menulis banyak baris; tiap pernyataan dihitung sebagai satu kueri. */
const UKURAN_BATCH = 100;

interface InfoKolom {
  nama: string;
  snake: string;
  type: ColumnType;
}

/** Nilai aplikasi → nilai kolom D1. */
export function keD1(nilai: unknown, type: ColumnType): unknown {
  const v = keJson(nilai, type);
  if (v === null) return null;
  if (type === "boolean") return v ? 1 : 0;
  return v;
}

/** Nilai kolom D1 → nilai aplikasi (sama dengan dariJson Supabase untuk jenis yang dipakai aplikasi). */
export function dariD1(mentah: unknown, type: ColumnType): unknown {
  if (mentah === undefined || mentah === null) return null;
  switch (type) {
    case "datetime":
      return new Date(String(mentah));
    case "int":
      return typeof mentah === "number" ? Math.trunc(mentah) : Number.parseInt(String(mentah), 10);
    case "float":
      return typeof mentah === "number" ? mentah : Number.parseFloat(String(mentah));
    case "boolean":
      return mentah === 1 || mentah === true || mentah === "1" || mentah === "true";
    case "json":
      if (typeof mentah !== "string") return mentah;
      try {
        return JSON.parse(mentah);
      } catch {
        return mentah;
      }
    default: {
      const teks = typeof mentah === "string" ? mentah : String(mentah);
      return teks === "" ? null : teks;
    }
  }
}

export class D1Table<T extends object = Row> implements Repo<T> {
  readonly tabel: string;
  private readonly kolom: InfoKolom[];
  private readonly snakeDari: Map<string, string>;
  private readonly jenisSnake: Map<string, ColumnType>;

  constructor(def: TableDef) {
    this.tabel = namaTabel(def.tab);
    this.kolom = def.columns.map((c) => ({ nama: c.name, snake: keSnake(c.name), type: c.type }));
    this.snakeDari = new Map(this.kolom.map((k) => [k.nama, k.snake]));
    this.jenisSnake = new Map(this.kolom.map((k) => [k.snake, k.type]));
  }

  keRecord(baris: Row): T {
    const record: Row = {};
    for (const k of this.kolom) record[k.nama] = dariD1(baris[k.snake], k.type);
    return record as T;
  }

  /** Data aplikasi → kolom D1; kunci undefined dilewati, atau dikosongkan bila `kosongkanUndefined`. */
  keBaris(data: Partial<T>, kosongkanUndefined: boolean): Row {
    const baris: Row = {};
    for (const k of this.kolom) {
      if (!Object.prototype.hasOwnProperty.call(data, k.nama)) continue;
      const nilai = (data as Row)[k.nama];
      if (nilai === undefined && !kosongkanUndefined) continue;
      baris[k.snake] = keD1(nilai, k.type);
    }
    return baris;
  }

  private kondisi(where: Where | undefined): Kondisi {
    return keKondisi(where, (nama) => this.snakeDari.get(nama) ?? null);
  }

  private where(k: Kondisi): PotonganSql {
    const hasil = keSql(k, (kolom) => this.jenisSnake.get(kolom));
    return hasil;
  }

  private urutan(orderBy?: OrderBy<T>): string {
    const snake = orderBy ? this.snakeDari.get(orderBy.field) : undefined;
    if (!orderBy || !snake) return `${KOLOM_URUTAN} ASC`;
    return `${snake} ${orderBy.dir === "desc" ? "DESC" : "ASC"} NULLS LAST, ${KOLOM_URUTAN} ASC`;
  }

  private async siapkan(sql: string, nilai: unknown[]): Promise<PernyataanD1> {
    if (nilai.length > BATAS_PARAMETER_D1) {
      throw new Error(`Kueri ${this.tabel} memakai ${nilai.length} parameter, melebihi batas D1 (${BATAS_PARAMETER_D1}).`);
    }
    const db = await klienD1();
    const p = db.prepare(sql);
    return nilai.length > 0 ? p.bind(...nilai) : p;
  }

  private async pilih(select: string, k: Kondisi, order: string, batas?: number): Promise<Row[]> {
    if (k.jenis === "salah" || (batas !== undefined && batas <= 0)) return [];
    const w = this.where(k);
    const limit = batas !== undefined && Number.isFinite(batas) ? ` LIMIT ${Math.floor(batas)}` : "";
    const p = await this.siapkan(`SELECT ${select} FROM ${this.tabel} WHERE ${w.sql} ORDER BY ${order}${limit}`, w.nilai);
    return (await p.all<Row>()).results;
  }

  async findMany(opts?: { where?: Where; orderBy?: OrderBy<T>; batas?: number }): Promise<T[]> {
    const baris = await this.pilih("*", this.kondisi(opts?.where), this.urutan(opts?.orderBy), opts?.batas);
    return baris.map((b) => this.keRecord(b));
  }

  async findKolom<K extends keyof T & string>(kolom: readonly K[], opts?: { where?: Where }): Promise<Pick<T, K>[]> {
    const info = this.kolom.filter((k) => (kolom as readonly string[]).includes(k.nama));
    if (info.length === 0) return [];
    const baris = await this.pilih(info.map((k) => k.snake).join(", "), this.kondisi(opts?.where), this.urutan());
    return baris.map((b) => {
      const record: Row = {};
      for (const k of info) record[k.nama] = dariD1(b[k.snake], k.type);
      return record as Pick<T, K>;
    });
  }

  async findUnique(where: Where): Promise<T | null> {
    const [baris] = await this.pilih("*", this.kondisi(where), this.urutan(), 1);
    return baris ? this.keRecord(baris) : null;
  }

  async count(where?: Where): Promise<number> {
    const k = this.kondisi(where);
    if (k.jenis === "salah") return 0;
    const w = this.where(k);
    const p = await this.siapkan(`SELECT count(*) AS n FROM ${this.tabel} WHERE ${w.sql}`, w.nilai);
    return Number((await p.first<{ n: number }>())?.n ?? 0);
  }

  /** INSERT satu baris; kolom yang tidak disebut memakai nilai bawaan tabel. */
  private async pernyataanSisip(data: Partial<T>, upsert: boolean): Promise<PernyataanD1 | null> {
    const baris = this.keBaris(data, upsert);
    const kolom = Object.keys(baris);
    if (kolom.length === 0) return null;
    const konflik =
      upsert && kolom.includes("id")
        ? ` ON CONFLICT(id) DO UPDATE SET ${kolom.filter((k) => k !== "id").map((k) => `${k} = excluded.${k}`).join(", ") || "id = excluded.id"}`
        : "";
    return this.siapkan(
      `INSERT INTO ${this.tabel} (${kolom.join(", ")}) VALUES (${kolom.map(() => "?").join(", ")})${konflik} RETURNING *`,
      kolom.map((k) => baris[k]),
    );
  }

  async create(data: T): Promise<T> {
    const p = await this.pernyataanSisip(data, false);
    const db = await klienD1();
    const baris = p ? await p.first<Row>() : await db.prepare(`INSERT INTO ${this.tabel} DEFAULT VALUES RETURNING *`).first<Row>();
    return { ...data, ...this.keRecord(baris ?? {}) };
  }

  async createMany(rows: T[]): Promise<number> {
    await this.tulisBanyak(rows, false);
    return rows.length;
  }

  /** Tulis banyak record; record dengan id yang sudah ada ditimpa kolom yang disebut. Dipakai skrip salin data. */
  async upsertMany(rows: T[]): Promise<number> {
    await this.tulisBanyak(rows, true);
    return rows.length;
  }

  private async tulisBanyak(rows: T[], upsert: boolean): Promise<void> {
    const db = await klienD1();
    for (let i = 0; i < rows.length; i += UKURAN_BATCH) {
      const daftar: PernyataanD1[] = [];
      for (const r of rows.slice(i, i + UKURAN_BATCH)) {
        const p = await this.pernyataanSisip(r, upsert);
        if (p) daftar.push(p);
      }
      if (daftar.length > 0) await db.batch(daftar);
    }
  }

  async update(where: Where, data: Partial<T>): Promise<T | null> {
    const id = await this.idPertama(where);
    if (id === null) return null;
    const baris = this.keBaris(data, true);
    const kolom = Object.keys(baris);
    if (kolom.length === 0) {
      const record = await this.findUnique({ id });
      return record ? ({ ...data, ...record } as T) : null;
    }
    const p = await this.siapkan(
      `UPDATE ${this.tabel} SET ${kolom.map((k) => `${k} = ?`).join(", ")} WHERE id = ? RETURNING *`,
      [...kolom.map((k) => baris[k]), id],
    );
    const hasil = await p.first<Row>();
    return hasil ? ({ ...data, ...this.keRecord(hasil) } as T) : null;
  }

  async updateMany(where: Where, data: Partial<T>): Promise<number> {
    const k = this.kondisi(where);
    if (k.jenis === "salah") return 0;
    const baris = this.keBaris(data, true);
    const kolom = Object.keys(baris);
    if (kolom.length === 0) return this.count(where);
    const w = this.where(k);
    const p = await this.siapkan(`UPDATE ${this.tabel} SET ${kolom.map((x) => `${x} = ?`).join(", ")} WHERE ${w.sql}`, [
      ...kolom.map((x) => baris[x]),
      ...w.nilai,
    ]);
    return (await p.run()).meta.changes ?? 0;
  }

  async delete(where: Where): Promise<boolean> {
    const id = await this.idPertama(where);
    if (id === null) return false;
    const p = await this.siapkan(`DELETE FROM ${this.tabel} WHERE id = ?`, [id]);
    return ((await p.run()).meta.changes ?? 0) > 0;
  }

  async deleteMany(where: Where): Promise<number> {
    const k = this.kondisi(where);
    if (k.jenis === "salah") return 0;
    const w = this.where(k);
    const p = await this.siapkan(`DELETE FROM ${this.tabel} WHERE ${w.sql}`, w.nilai);
    return (await p.run()).meta.changes ?? 0;
  }

  /** id record pertama yang cocok. Tanpa kueri bila where hanya berisi `{ id: "..." }`. */
  private async idPertama(where: Where): Promise<string | null> {
    const kunci = Object.keys(where);
    if (kunci.length === 1 && kunci[0] === "id" && typeof where.id === "string") return where.id;
    const [baris] = await this.pilih("id", this.kondisi(where), this.urutan(), 1);
    return baris ? String(baris.id) : null;
  }
}
