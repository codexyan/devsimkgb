// Repository generik di atas satu tabel Supabase, dengan perilaku yang sama seperti Table di
// lib/sheets/table.ts: urutan bawaan mengikuti urutan data dimasukkan, update dan delete
// menyasar record pertama yang cocok, dan update meniru penggabungan objek di spreadsheet.

import type { ColumnType, TableDef } from "../../sheets/table";
import type { OrderBy, Repo, Where } from "../repo";
import { keKondisi, keParameter, type Kondisi } from "./filter";
import { KOLOM_URUTAN, keSnake, namaTabel } from "./nama";
import { dariJson, keJson } from "./nilai";
import { rest, totalDariContentRange } from "./rest";

type Row = Record<string, unknown>;

/** Baris per request; Data API Supabase membatasi 1000 baris per respons secara bawaan. */
const UKURAN_HALAMAN = 1000;
const UKURAN_BATCH = 500;

/** Filter yang mencakup semua baris, supaya UPDATE dan DELETE tetap punya WHERE. */
const SEMUA_BARIS: Kondisi = { jenis: "kosong", kolom: KOLOM_URUTAN, kosong: false };

const sesuaiId = (id: string): Kondisi => ({ jenis: "banding", kolom: "id", op: "eq", nilai: id });

interface InfoKolom {
  nama: string;
  snake: string;
  type: ColumnType;
}

export class SupabaseTable<T extends object = Row> implements Repo<T> {
  /** Nama tabel Postgres. */
  readonly tabel: string;
  private readonly kolom: InfoKolom[];
  private readonly snakeDari: Map<string, string>;

  constructor(def: TableDef) {
    this.tabel = namaTabel(def.tab);
    this.kolom = def.columns.map((c) => ({ nama: c.name, snake: keSnake(c.name), type: c.type }));
    this.snakeDari = new Map(this.kolom.map((k) => [k.nama, k.snake]));
  }

  /** Baris JSON dari PostgREST → record aplikasi (camelCase, tipe JS). */
  keRecord(baris: Row): T {
    const record: Row = {};
    for (const k of this.kolom) record[k.nama] = dariJson(baris[k.snake], k.type);
    return record as T;
  }

  /**
   * Data aplikasi → baris JSON untuk Postgres; kunci di luar definisi kolom diabaikan.
   * Dengan `kosongkanUndefined`, kunci yang ada tetapi bernilai undefined dikirim sebagai null,
   * sama seperti update di spreadsheet. Tanpanya kunci itu dilewati, sehingga default kolom berlaku.
   */
  keBaris(data: Partial<T>, kosongkanUndefined: boolean): Row {
    const baris: Row = {};
    for (const k of this.kolom) {
      if (!Object.prototype.hasOwnProperty.call(data, k.nama)) continue;
      const nilai = (data as Row)[k.nama];
      if (nilai === undefined && !kosongkanUndefined) continue;
      baris[k.snake] = keJson(nilai, k.type);
    }
    return baris;
  }

  private kondisi(where: Where | undefined): Kondisi {
    return keKondisi(where, (nama) => this.snakeDari.get(nama) ?? null);
  }

  private path(kondisi: Kondisi, parameter: Record<string, string>): string {
    const bagian = Object.entries(parameter).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    const filter = keParameter(kondisi);
    if (filter) bagian.push(filter);
    return `${this.tabel}?${bagian.join("&")}`;
  }

  /** Urutan PostgREST; urutan data dimasukkan selalu jadi penentu terakhir, seperti sort stabil di spreadsheet. */
  private urutan(orderBy?: OrderBy<T>): string {
    const bawaan = `${KOLOM_URUTAN}.asc`;
    const snake = orderBy ? this.snakeDari.get(orderBy.field) : undefined;
    if (!orderBy || !snake) return bawaan;
    return `${snake}.${orderBy.dir === "desc" ? "desc" : "asc"}.nullslast,${bawaan}`;
  }

  async findMany(opts?: { where?: Where; orderBy?: OrderBy<T> }): Promise<T[]> {
    const kondisi = this.kondisi(opts?.where);
    if (kondisi.jenis === "salah") return [];
    const order = this.urutan(opts?.orderBy);
    const hasil: Row[] = [];
    let total: number | null = null;
    for (;;) {
      const res = await rest(
        this.path(kondisi, { select: "*", order, offset: String(hasil.length), limit: String(UKURAN_HALAMAN) }),
        { prefer: total === null ? ["count=exact"] : [] },
      );
      if (total === null) total = totalDariContentRange(res.headers.get("content-range"));
      const halaman = (await res.json()) as Row[];
      hasil.push(...halaman);
      const selesai = total !== null ? hasil.length >= total : halaman.length < UKURAN_HALAMAN;
      if (halaman.length === 0 || selesai) break;
    }
    return hasil.map((baris) => this.keRecord(baris));
  }

  async findUnique(where: Where): Promise<T | null> {
    const kondisi = this.kondisi(where);
    if (kondisi.jenis === "salah") return null;
    const res = await rest(this.path(kondisi, { select: "*", order: this.urutan(), limit: "1" }));
    const [baris] = (await res.json()) as Row[];
    return baris ? this.keRecord(baris) : null;
  }

  async count(where?: Where): Promise<number> {
    const kondisi = this.kondisi(where);
    if (kondisi.jenis === "salah") return 0;
    const res = await rest(this.path(kondisi, { select: "id", limit: "1" }), { prefer: ["count=exact"] });
    await res.text();
    return totalDariContentRange(res.headers.get("content-range")) ?? 0;
  }

  async create(data: T): Promise<T> {
    const res = await rest(this.tabel, {
      method: "POST",
      body: this.keBaris(data, false),
      prefer: ["return=representation"],
    });
    const [baris] = (await res.json()) as Row[];
    return { ...data, ...this.keRecord(baris) };
  }

  async createMany(rows: T[]): Promise<number> {
    await this.kirimBanyak(rows, false);
    return rows.length;
  }

  /**
   * Tulis banyak record; record dengan id yang sudah ada ditimpa seluruh kolomnya.
   * Dipakai skrip salin data, bukan oleh route.
   */
  async upsertMany(rows: T[]): Promise<number> {
    await this.kirimBanyak(rows, true);
    return rows.length;
  }

  private async kirimBanyak(rows: T[], upsert: boolean): Promise<void> {
    for (let i = 0; i < rows.length; i += UKURAN_BATCH) {
      const batch = rows.slice(i, i + UKURAN_BATCH).map((r) => this.keBaris(r, upsert));
      const kolom = [...new Set(batch.flatMap((b) => Object.keys(b)))];
      // Baris tanpa kolom apa pun juga dilewati saat dibaca dari spreadsheet.
      if (kolom.length === 0) continue;
      const parameter = [`columns=${encodeURIComponent(kolom.join(","))}`];
      if (upsert) parameter.push("on_conflict=id");
      await rest(`${this.tabel}?${parameter.join("&")}`, {
        method: "POST",
        body: batch,
        prefer: upsert
          ? ["return=minimal", "resolution=merge-duplicates", "missing=default"]
          : ["return=minimal", "missing=default"],
      });
    }
  }

  async update(where: Where, data: Partial<T>): Promise<T | null> {
    const id = await this.idPertama(where);
    if (id === null) return null;
    const baris = this.keBaris(data, true);
    if (Object.keys(baris).length === 0) {
      const record = await this.findUnique({ id });
      return record ? ({ ...data, ...record } as T) : null;
    }
    const res = await rest(this.path(sesuaiId(id), { select: "*" }), {
      method: "PATCH",
      body: baris,
      prefer: ["return=representation"],
    });
    const [hasil] = (await res.json()) as Row[];
    return hasil ? ({ ...data, ...this.keRecord(hasil) } as T) : null;
  }

  async updateMany(where: Where, data: Partial<T>): Promise<number> {
    const kondisi = this.kondisi(where);
    if (kondisi.jenis === "salah") return 0;
    const baris = this.keBaris(data, true);
    if (Object.keys(baris).length === 0) return this.count(where);
    const res = await rest(this.path(kondisi.jenis === "benar" ? SEMUA_BARIS : kondisi, { select: "id" }), {
      method: "PATCH",
      body: baris,
      prefer: ["return=representation"],
    });
    return ((await res.json()) as unknown[]).length;
  }

  async delete(where: Where): Promise<boolean> {
    const id = await this.idPertama(where);
    if (id === null) return false;
    const res = await rest(this.path(sesuaiId(id), { select: "id" }), {
      method: "DELETE",
      prefer: ["return=representation"],
    });
    return ((await res.json()) as unknown[]).length > 0;
  }

  async deleteMany(where: Where): Promise<number> {
    const kondisi = this.kondisi(where);
    if (kondisi.jenis === "salah") return 0;
    const res = await rest(this.path(kondisi.jenis === "benar" ? SEMUA_BARIS : kondisi, { select: "id" }), {
      method: "DELETE",
      prefer: ["return=representation"],
    });
    return ((await res.json()) as unknown[]).length;
  }

  /** id record pertama yang cocok. Tanpa request bila where hanya berisi `{ id: "..." }`. */
  private async idPertama(where: Where): Promise<string | null> {
    const kunci = Object.keys(where);
    if (kunci.length === 1 && kunci[0] === "id" && typeof where.id === "string") return where.id;
    const kondisi = this.kondisi(where);
    if (kondisi.jenis === "salah") return null;
    const res = await rest(this.path(kondisi, { select: "id", order: this.urutan(), limit: "1" }));
    const [baris] = (await res.json()) as { id: string }[];
    return baris?.id ?? null;
  }
}
