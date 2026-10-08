// SQL pemulihan untuk Cloudflare D1 (ADR-084, ADR-085), dijalankan di skema D1 sungguhan pada SQLite di memori.
//
// Jalankan: node --import tsx --test lib/pulihkanD1.test.ts

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { pasangKlienD1 } from "./db/d1/klien";
import { d1 } from "./db/d1/tables";
import { buatD1Uji, type D1Uji } from "./db/d1/ujiD1";
import { sqlKembalikanBarisD1, sqlPulihkanD1, sqlPulihkanJejakD1, waktuJejak } from "./pulihkanCadangan";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

let uji: D1Uji;
beforeEach(() => {
  uji = buatD1Uji();
  pasangKlienD1(uji);
});
afterEach(() => pasangKlienD1(null));

const usulan = (id: string, isi: Partial<UsulanPegawaiRow> = {}) =>
  ({ id, satker: "lapas-perempuan-martapura", status: "draf", jenis: "baru", diajukanOleh: "UPT", nama: `PEGAWAI ${id}`, hukdisAda: false, ...isi }) as UsulanPegawaiRow;

const mentah = (tabel: string) => (uji.db.prepare(`SELECT * FROM ${tabel} ORDER BY urutan_sisip`).all() as object[]).map((b) => ({ ...b }));

test("usulan yang dihapus UPT dikembalikan persis dari jejak, sekali jalan atau diulang", async () => {
  await d1.usulanPegawai.create(usulan("u1", { catatanUpt: "berkas O'Neil", tmtKgbTerakhir: new Date("2024-12-01T00:00:00Z") }));
  await d1.usulanPegawai.create(usulan("u2", { penetapSkTerakhir: "Kepala Kantor Wilayah Kementerian Hukum dan HAM Kalimantan Selatan" }));
  await d1.usulanPegawai.create(usulan("u3"));
  const sebelum = mentah("usulan_pegawai");
  const mulai = new Date(Date.now() - 60_000).toISOString();
  await d1.usulanPegawai.deleteMany({ id: { in: ["u1", "u2"] } });
  assert.equal(await d1.usulanPegawai.count(), 1);

  const sql = sqlPulihkanJejakD1("usulan_pegawai", { dari: mulai, sampai: new Date(Date.now() + 60_000).toISOString() });
  uji.db.exec(sql);
  assert.deepEqual(mentah("usulan_pegawai"), sebelum, "isi dan urutan sama persis");
  uji.db.exec(sql);
  assert.equal(await d1.usulanPegawai.count(), 3, "diulang tidak menggandakan");
});

test("isi satu baris dikembalikan ke keadaan sebelum perubahan tertentu", async () => {
  const p = await d1.pegawai.create({ nip: "199001012020121001", nama: "NAMA ASLI", golonganRuang: "II/b", mkgTahun: 7 } as PegawaiRow);
  await d1.pegawai.update({ id: p.id }, { nama: "NAMA KELIRU", golonganRuang: "III/a", mkgTahun: null as never });
  const { id } = uji.db.prepare("SELECT id FROM jejak_data WHERE tabel = 'pegawai' AND aksi = 'ubah'").get() as { id: number };
  uji.db.exec(sqlKembalikanBarisD1("pegawai", id));
  const kembali = await d1.pegawai.findUnique({ id: p.id });
  assert.equal(kembali?.nama, "NAMA ASLI");
  assert.equal(kembali?.golonganRuang, "II/b");
  assert.equal(kembali?.mkgTahun, 7);
  assert.throws(() => sqlKembalikanBarisD1("pegawai", 0), /bilangan bulat positif/);
});

test("cadangan D1 dikembalikan ke tabel yang dikosongkan; nomor urut yang sudah terpakai diberi nomor baru", async () => {
  for (const id of ["u1", "u2", "u3"]) await d1.usulanPegawai.create(usulan(id));
  const cadangan = mentah("usulan_pegawai");
  await d1.usulanPegawai.deleteMany({});
  await d1.usulanPegawai.create(usulan("baru")); // mendapat urutan_sisip 4
  uji.db.exec("UPDATE usulan_pegawai SET urutan_sisip = 2 WHERE id = 'baru'"); // bentrok dengan u2
  uji.db.exec(sqlPulihkanD1("usulan_pegawai", cadangan));
  const kini = mentah("usulan_pegawai") as { id: string; urutan_sisip: number }[];
  assert.deepEqual(kini.map((b) => b.id).sort(), ["baru", "u1", "u2", "u3"]);
  assert.equal(kini.find((b) => b.id === "u1")?.urutan_sisip, 1);
  assert.ok((kini.find((b) => b.id === "u2")?.urutan_sisip ?? 0) > 3, "u2 diberi nomor baru di ujung");

  await d1.usulanPegawai.update({ id: "u1" }, { catatanUpt: "diubah sesudah cadangan" });
  uji.db.exec(sqlPulihkanD1("usulan_pegawai", cadangan));
  assert.equal((await d1.usulanPegawai.findUnique({ id: "u1" }))?.catatanUpt, "diubah sesudah cadangan", "tanpa --timpa dibiarkan");
  uji.db.exec(sqlPulihkanD1("usulan_pegawai", cadangan, { timpa: true }));
  assert.equal((await d1.usulanPegawai.findUnique({ id: "u1" }))?.catatanUpt, null, "--timpa memakai isi cadangan");
});

test("cadangan Supabase (bentuk Postgres) dapat dikembalikan ke D1, dan baris besar dipotong per pernyataan", async () => {
  const postgres = Array.from({ length: 120 }, (_, i) => ({
    id: `pg-${i}`, satker: "rutan-rantau", status: "disetujui", jenis: "perubahan", diajukan_oleh: "UPT",
    hukdis_ada: i % 2 === 0, diajukan_at: "2026-10-07T07:05:54.738123+00:00", catatan_upt: "x".repeat(900), urutan_sisip: i + 1,
  }));
  const sql = sqlPulihkanD1("usulan_pegawai", postgres);
  const pernyataan = sql.split(";\n").filter((x) => x.includes("INSERT"));
  assert.ok(pernyataan.length > 1, "dipotong");
  for (const p of pernyataan) assert.ok(p.length < 100_000, "tiap pernyataan di bawah 100 KB");
  uji.db.exec(sql);
  const u = await d1.usulanPegawai.findUnique({ id: "pg-3" });
  assert.equal(u?.hukdisAda, false);
  assert.equal((await d1.usulanPegawai.findUnique({ id: "pg-2" }))?.hukdisAda, true);
  assert.deepEqual(u?.diajukanAt, new Date("2026-10-07T07:05:54.738Z"));
  assert.equal(await d1.usulanPegawai.count(), 120);
});

test("waktu jejak: WITA dalam bentuk 'YYYY-MM-DD HH:MM', atau ISO", () => {
  assert.equal(waktuJejak("2026-10-08 13:00"), "2026-10-08T05:00:00.000Z");
  assert.equal(waktuJejak("2026-10-08T05:00:00Z"), "2026-10-08T05:00:00.000Z");
  assert.throws(() => waktuJejak("kemarin"), /tidak dikenal/);
  assert.throws(() => sqlPulihkanJejakD1("tabel; drop", { dari: "2026-10-08 13:00", sampai: "2026-10-08 14:00" }), /tidak ada di skema/);
});
