// Penyimpanan lokal pengganti Google Sheets (DATA_BACKEND=lokal) untuk pengembangan.
//
// Jalankan: node --import tsx --test lib/sheets/klienLokal.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { uraiRange } from "./klienLokal";

test("range A1 yang dipakai lib/sheets diuraikan menjadi tab dan baris", () => {
  assert.deepEqual(uraiRange("Pegawai!A1:Z"), { tab: "Pegawai", awal: 1, akhir: null });
  assert.deepEqual(uraiRange("User!1:1"), { tab: "User", awal: 1, akhir: 1 });
  assert.deepEqual(uraiRange("RiwayatKGB!A5:Z5"), { tab: "RiwayatKGB", awal: 5, akhir: 5 });
  assert.deepEqual(uraiRange("User!A1"), { tab: "User", awal: 1, akhir: null });
  assert.deepEqual(uraiRange("'Tab Spasi'!A2:C"), { tab: "Tab Spasi", awal: 2, akhir: null });
});

test("repository Sheets berjalan di atas berkas lokal: buat, cari, ubah, hapus", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-lokal-"));
  const simpan = { backend: process.env.DATA_BACKEND, berkas: process.env.DATA_LOKAL_BERKAS };
  process.env.DATA_BACKEND = "lokal";
  process.env.DATA_LOKAL_BERKAS = path.join(folder, "uji.json");
  try {
    const { Table } = await import("./table");
    const { sinkronkanHeader } = await import("./sinkronHeader");
    const def = { tab: "Uji", columns: [{ name: "id", type: "string" }, { name: "nama", type: "string" }, { name: "umur", type: "int" }] } as const;
    await sinkronkanHeader([def as never], true);
    const tabel = new Table<{ id: string; nama: string; umur: number }>(def as never);

    await tabel.createMany([
      { id: "a", nama: "Andi", umur: 30 },
      { id: "b", nama: "Budi", umur: 41 },
      { id: "c", nama: "Citra", umur: 25 },
    ]);
    assert.equal((await tabel.findUnique({ id: "b" }))?.nama, "Budi");

    await tabel.update({ id: "b" }, { umur: 42 });
    assert.equal((await tabel.findUnique({ id: "b" }))?.umur, 42);

    assert.equal(await tabel.delete({ id: "a" }), true);
    await tabel.create({ id: "d", nama: "Dewi", umur: 35 });
    const semua = await tabel.findMany({ orderBy: { field: "nama" } });
    assert.deepEqual(semua.map((r) => r.id), ["b", "c", "d"]);

    // Tulis serentak tidak saling timpa
    await Promise.all([1, 2, 3, 4, 5].map((n) => tabel.create({ id: `x${n}`, nama: `X${n}`, umur: n })));
    assert.equal(await tabel.count(), 8);
  } finally {
    if (simpan.backend === undefined) delete process.env.DATA_BACKEND;
    else process.env.DATA_BACKEND = simpan.backend;
    if (simpan.berkas === undefined) delete process.env.DATA_LOKAL_BERKAS;
    else process.env.DATA_LOKAL_BERKAS = simpan.berkas;
    await rm(folder, { recursive: true, force: true });
  }
});
