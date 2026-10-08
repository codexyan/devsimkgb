// Skema D1 (ADR-085) harus sejalan dengan tiga hal: migrasi d1/migrations, lib/db/d1/skema.ts, dan definisi kolom
// aplikasi (lib/sheets/tables.ts). Selama Supabase masih dipakai, setiap kolom di supabase/migrations juga wajib ada
// di D1, supaya tidak ada kolom yang hanya ditambahkan ke salah satu basis data.
//
// Jalankan: node --import tsx --test lib/db/d1/skema.test.ts

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ALL_DEFS } from "../../sheets/tables";
import { keSnake, namaTabel } from "../supabase/nama";
import { SKEMA_D1, TABEL_DIJEJAK, TABEL_JEJAK_HAPUS_SAJA, type JenisKolomD1 } from "./skema";
import { buatD1Uji } from "./ujiD1";

const COCOK: Record<string, JenisKolomD1[]> = {
  string: ["teks", "bilangan"],
  datetime: ["waktu"],
  int: ["bilangan"],
  float: ["bilangan"],
  boolean: ["boolean"],
  json: ["json", "teks"],
};

test("kolom di migrasi D1 sama persis dengan SKEMA_D1", () => {
  const { db } = buatD1Uji();
  const tabel = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
    .map((t) => t.name)
    .sort();
  assert.deepEqual(tabel, Object.keys(SKEMA_D1).sort());
  for (const t of tabel) {
    const kolom = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((k) => k.name).sort();
    assert.deepEqual(kolom, Object.keys(SKEMA_D1[t]).sort(), `kolom ${t}`);
  }
});

test("setiap kolom aplikasi ada di D1 dengan jenis yang sesuai", () => {
  for (const def of ALL_DEFS) {
    const t = namaTabel(def.tab);
    assert.ok(SKEMA_D1[t], `tabel ${t}`);
    for (const c of def.columns) {
      const jenis = SKEMA_D1[t][keSnake(c.name)];
      assert.ok(jenis, `${t}.${keSnake(c.name)} belum ada di D1`);
      assert.ok(COCOK[c.type].includes(jenis), `${t}.${keSnake(c.name)}: ${c.type} vs ${jenis}`);
    }
  }
});

test("setiap kolom di migrasi Supabase juga ada di D1", () => {
  const folder = path.join(process.cwd(), "supabase", "migrations");
  const sql = readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(folder, f), "utf8").replace(/\r\n/g, "\n"))
    .join("\n");
  for (const cocok of sql.matchAll(/create table (?:if not exists )?public\.(\w+) \(\n([\s\S]*?)\n\);/g)) {
    for (const baris of cocok[2].split("\n").map((b) => b.trim())) {
      if (!baris || baris.startsWith("--") || /^(check|constraint|primary|unique|foreign)\b/i.test(baris)) continue;
      const kolom = baris.split(/\s+/)[0];
      assert.ok(SKEMA_D1[cocok[1]]?.[kolom], `${cocok[1]}.${kolom} ada di Supabase tetapi belum di D1`);
    }
  }
  for (const cocok of sql.matchAll(/alter table public\.(\w+) add column (?:if not exists )?(\w+)/g)) {
    assert.ok(SKEMA_D1[cocok[1]]?.[cocok[2]], `${cocok[1]}.${cocok[2]} ada di Supabase tetapi belum di D1`);
  }
});

test("trigger jejak perubahan terpasang di setiap tabel yang dijejak", () => {
  const { db } = buatD1Uji();
  const trigger = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as { name: string }[]).map((t) => t.name));
  for (const t of TABEL_DIJEJAK) {
    assert.ok(trigger.has(`jejak_data_ubah_${t}`), `ubah ${t}`);
    assert.ok(trigger.has(`jejak_data_hapus_${t}`), `hapus ${t}`);
  }
  for (const t of TABEL_JEJAK_HAPUS_SAJA) {
    assert.ok(trigger.has(`jejak_data_hapus_${t}`), `hapus ${t}`);
    assert.ok(!trigger.has(`jejak_data_ubah_${t}`), `${t} tidak menjejak perubahan`);
  }
  assert.equal(trigger.size, TABEL_DIJEJAK.length * 2 + TABEL_JEJAK_HAPUS_SAJA.length);
});

test("trigger jejak mencatat setiap kolom tabelnya, termasuk kolom yang ditambahkan migrasi sesudahnya", () => {
  const { db } = buatD1Uji();
  const sqlTrigger = new Map(
    (db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger'").all() as { name: string; sql: string }[]).map((t) => [t.name, t.sql]),
  );
  for (const t of [...TABEL_DIJEJAK, ...TABEL_JEJAK_HAPUS_SAJA]) {
    const nama = [`jejak_data_hapus_${t}`, ...(TABEL_DIJEJAK.includes(t) ? [`jejak_data_ubah_${t}`] : [])];
    for (const n of nama) {
      const sql = sqlTrigger.get(n) ?? "";
      for (const kolom of Object.keys(SKEMA_D1[t])) {
        assert.ok(sql.includes(`'${kolom}', OLD.${kolom}`), `${n} belum mencatat ${kolom}: buat ulang triggernya di migrasi D1`);
      }
    }
  }
});

test("berkas migrasi D1 berakhir baris LF: D1 menolak trigger yang memuat CR", () => {
  const folder = path.join(process.cwd(), "d1", "migrations");
  for (const f of readdirSync(folder).filter((x) => x.endsWith(".sql"))) {
    assert.ok(!readFileSync(path.join(folder, f), "utf8").includes("\r"), `${f} memuat CR; simpan dengan akhir baris LF`);
  }
});
