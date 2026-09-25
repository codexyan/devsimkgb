// Jalankan: node --import tsx --test lib/asetPublik.test.ts
// Menguji jalur Node (disk). Jalur Workers (binding ASSETS) hanya berjalan di Cloudflare.

import assert from "node:assert/strict";
import { test } from "node:test";
import { bacaAsetPublik, dataUrlAsetPublik } from "./asetPublik";

const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47];

test("bacaAsetPublik membaca berkas public/ dari disk di Node", async () => {
  const isi = await bacaAsetPublik("logo-imipas.png");
  assert.deepEqual([...isi.subarray(0, 4)], SIGNATURE_PNG);
});

test("bacaAsetPublik memakai cache untuk path yang sama", () => {
  assert.equal(bacaAsetPublik("fonts/arial.ttf"), bacaAsetPublik("fonts/arial.ttf"));
});

test("bacaAsetPublik tidak meng-cache kegagalan", async () => {
  const pertama = bacaAsetPublik("tidak-ada.bin");
  await assert.rejects(pertama);
  assert.notEqual(bacaAsetPublik("tidak-ada.bin"), pertama);
  await assert.rejects(bacaAsetPublik("tidak-ada.bin"));
});

test("dataUrlAsetPublik menghasilkan data URL base64 yang diterima @react-pdf", async () => {
  const url = await dataUrlAsetPublik("logo-imipas.png", "image/png");
  assert.match(url, /^data:image\/png;base64,/);
  const isi = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  assert.deepEqual([...isi.subarray(0, 4)], SIGNATURE_PNG);
});
