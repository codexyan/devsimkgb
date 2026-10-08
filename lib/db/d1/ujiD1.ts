// Tiruan D1 untuk uji (ADR-085): SQLite di memori (node:sqlite) yang menjalankan d1/migrations, dengan API yang
// dipakai lapisan data (prepare/bind/all/run/first/batch). Hanya diimpor berkas uji.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { KlienD1, PernyataanD1 } from "./klien";

type NilaiSqlite = null | number | bigint | string | Uint8Array;

/** Bagian node:sqlite yang dipakai; @types/node proyek ini belum memuat modul itu. */
export interface DatabaseSqlite {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...nilai: NilaiSqlite[]): unknown[];
    run(...nilai: NilaiSqlite[]): { changes: number | bigint };
    get(...nilai: NilaiSqlite[]): unknown;
  };
}

const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as {
  DatabaseSync: new (lokasi: string) => DatabaseSqlite;
};

export type D1Uji = KlienD1 & { db: DatabaseSqlite; jumlahKueri: number };

export function buatD1Uji(folderMigrasi = path.join(process.cwd(), "d1", "migrations")): D1Uji {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const f of readdirSync(folderMigrasi).filter((x) => x.endsWith(".sql")).sort()) {
    db.exec(readFileSync(path.join(folderMigrasi, f), "utf8"));
  }
  const klien: D1Uji = {
    db,
    jumlahKueri: 0,
    prepare: (sql: string) => pernyataan(sql, []),
    async batch(daftar: PernyataanD1[]) {
      db.exec("BEGIN");
      try {
        const hasil = [];
        for (const p of daftar) hasil.push(await p.run());
        db.exec("COMMIT");
        return hasil;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  function pernyataan(sql: string, nilai: unknown[]): PernyataanD1 {
    const v = nilai as NilaiSqlite[];
    return {
      bind: (...baru: unknown[]) => {
        for (const x of baru) if (x === undefined || typeof x === "boolean") throw new Error(`D1 menolak nilai ${String(x)}`);
        return pernyataan(sql, baru);
      },
      async all<T>() {
        klien.jumlahKueri++;
        return { results: db.prepare(sql).all(...v) as T[], meta: {} };
      },
      async run() {
        klien.jumlahKueri++;
        return { meta: { changes: Number(db.prepare(sql).run(...v).changes) } };
      },
      async first<T>() {
        klien.jumlahKueri++;
        return (db.prepare(sql).get(...v) as T | undefined) ?? null;
      },
    };
  }
  return klien;
}
