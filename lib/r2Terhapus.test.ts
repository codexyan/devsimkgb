// Berkas R2 yang dihapus disimpan dulu di terhapus/ (ADR-084).
//
// Jalankan: node --import tsx --test lib/r2Terhapus.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { AWALAN_TERHAPUS, kunciTerhapus, pangkasTerhapus, pindahkanKeTerhapus } from "./r2Terhapus";

interface Objek {
  isi: ArrayBuffer;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

function bucketTiruan(opsi: { gagalPut?: string } = {}) {
  const objek = new Map<string, Objek>();
  const bucket = {
    async get(key: string) {
      const o = objek.get(key);
      return o ? { arrayBuffer: async () => o.isi, httpMetadata: o.httpMetadata } : null;
    },
    async put(key: string, value: ArrayBuffer, p?: R2PutOptions) {
      if (opsi.gagalPut && key.includes(opsi.gagalPut)) throw new Error("R2 sedang gangguan");
      objek.set(key, {
        isi: value,
        uploaded: new Date(),
        httpMetadata: p?.httpMetadata as R2HTTPMetadata,
        customMetadata: p?.customMetadata as Record<string, string>,
      });
      return null;
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objek.delete(k);
    },
    async list(p: R2ListOptions) {
      return {
        objects: [...objek.entries()].filter(([k]) => k.startsWith(p.prefix ?? "")).map(([key, o]) => ({ key, uploaded: o.uploaded })),
        truncated: false,
      };
    },
  };
  return { bucket, objek };
}

const pdf = (teks: string) => new TextEncoder().encode(`%PDF-1.7 ${teks}`).buffer as ArrayBuffer;

test("berkas dipindahkan ke terhapus/ beserta jenis isinya, lalu aslinya dihapus", async () => {
  const { bucket, objek } = bucketTiruan();
  objek.set("usulan/lpp/sk-terakhir/1_sk.pdf", { isi: pdf("a"), uploaded: new Date(), httpMetadata: { contentType: "application/pdf" } });
  const hasil = await pindahkanKeTerhapus(bucket, ["usulan/lpp/sk-terakhir/1_sk.pdf", "", "usulan/tidak-ada.pdf"], new Date("2026-10-08T05:00:00Z"));
  assert.deepEqual(hasil, { dipindah: 1, gagal: [] });
  assert.ok(!objek.has("usulan/lpp/sk-terakhir/1_sk.pdf"));
  const salinan = objek.get(kunciTerhapus("usulan/lpp/sk-terakhir/1_sk.pdf"));
  assert.equal(new TextDecoder().decode(salinan!.isi), "%PDF-1.7 a");
  assert.equal(salinan!.httpMetadata?.contentType, "application/pdf");
  assert.deepEqual(salinan!.customMetadata, { kunciAsal: "usulan/lpp/sk-terakhir/1_sk.pdf", dihapusAt: "2026-10-08T05:00:00.000Z" });
});

test("berkas yang gagal disalin tidak dihapus", async () => {
  const { bucket, objek } = bucketTiruan({ gagalPut: "b.pdf" });
  objek.set("sk/a.pdf", { isi: pdf("a"), uploaded: new Date() });
  objek.set("sk/b.pdf", { isi: pdf("b"), uploaded: new Date() });
  const hasil = await pindahkanKeTerhapus(bucket, ["sk/a.pdf", "sk/b.pdf"]);
  assert.deepEqual(hasil, { dipindah: 1, gagal: ["sk/b.pdf"] });
  assert.ok(objek.has("sk/b.pdf"), "aslinya tetap ada");
  assert.ok(!objek.has("sk/a.pdf"));
});

test("berkas di terhapus/ dibuang sesudah 90 hari, yang lain tidak disentuh", async () => {
  const { bucket, objek } = bucketTiruan();
  const sekarang = new Date("2026-10-08T00:00:00Z");
  objek.set(`${AWALAN_TERHAPUS}sk/lama.pdf`, { isi: pdf("1"), uploaded: new Date("2026-07-01T00:00:00Z") });
  objek.set(`${AWALAN_TERHAPUS}sk/baru.pdf`, { isi: pdf("2"), uploaded: new Date("2026-09-01T00:00:00Z") });
  objek.set("sk/aktif.pdf", { isi: pdf("3"), uploaded: new Date("2020-01-01T00:00:00Z") });
  assert.equal(await pangkasTerhapus(bucket, sekarang), 1);
  assert.deepEqual([...objek.keys()].sort(), ["sk/aktif.pdf", `${AWALAN_TERHAPUS}sk/baru.pdf`]);
});
