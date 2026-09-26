import { test } from "node:test";
import assert from "node:assert/strict";
import { indeksKolom } from "./table";

test("kolom dicari menurut header, lalu menurut posisi bila headernya belum ada", () => {
  const header = ["id", "status", "alasanTolak"];
  assert.equal(indeksKolom(header, "status", 1), 1);
  // Urutan header berbeda dengan definisi: tetap menurut nama.
  assert.equal(indeksKolom(["status", "id"], "id", 0), 1);
  // Kolom baru di ujung kanan yang headernya belum ditambahkan tetap terbaca menurut posisinya.
  assert.equal(indeksKolom(header, "pathSkCpns", 3), 3);
  assert.equal(indeksKolom([...header, ""], "pathSkCpns", 3), 3);
  // Posisi itu berisi header lain: susunan sheet berbeda, kolomnya dianggap tidak ada.
  assert.equal(indeksKolom([...header, "kolomLain"], "pathSkCpns", 3), -1);
});
