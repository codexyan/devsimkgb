// Pemeriksaan keutuhan TTE pada SK bertanda tangan (ADR-096).
//
// Jalankan: node --import tsx --test lib/tteSk.test.ts
//
// PDF bertanda tangan di sini sintetis: strukturnya sama dengan tanda tangan PAdES (ByteRange, Contents berisi DER dengan
// atribut messageDigest), tanpa sertifikat sungguhan. Pemeriksaan pada 38 SK produksi dijalankan terpisah di komputer
// pengelola (9 utuh, 29 tanpa TTE, dan satu bit yang diubah terbaca rusak), bukan di repo, sebab SK memuat data pribadi.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { periksaTte, sha256Hex } from "./tteSk";

const enk = new TextEncoder();
const OID_MD = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x04];

/** DER tiruan CMS: atribut messageDigest (SET berisi OCTET STRING), diapit byte lain. */
function derDenganSidik(sidik: Buffer): Buffer {
  const oktet = [0x04, sidik.length, ...sidik];
  return Buffer.from([0x30, 0x03, 0x02, 0x01, 0x01, ...OID_MD, 0x31, oktet.length, ...oktet, 0x30, 0x00]);
}

/**
 * PDF bertanda tangan sintetis. `algoritma` menentukan panjang sidik; `subFilter` ETSI.RFC3161 meniru stempel waktu
 * dokumen; `tambahan` ditempel sesudah tanda tangan seperti revisi /DSS.
 */
function pdfBertandaTangan(opsi: { algoritma?: "sha256" | "sha384"; subFilter?: string; tambahan?: string } = {}): Uint8Array {
  const panjangHex = 200;
  const kepala = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n5 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /${opsi.subFilter ?? "ETSI.CAdES.detached"} /ByteRange [`;
  const placeholder = "0000000000 0000000000 0000000000 0000000000";
  const tengah = "] /Contents <";
  const ekor = `>\n>>\nendobj\nisi halaman SK\n%%EOF\n`;
  const awalContents = enk.encode(kepala + placeholder + tengah).length - 1; // posisi "<"
  const akhirContents = awalContents + 1 + panjangHex + 1; // sesudah ">"
  const totalTanpaTambahan = akhirContents + enk.encode(ekor.slice(1)).length;
  const br = [0, awalContents, akhirContents, totalTanpaTambahan - akhirContents];
  const brTeks = br.map((n) => String(n).padStart(10, "0")).join(" ");
  const sebelum = Buffer.from(enk.encode(kepala + brTeks + tengah.slice(0, -1)));
  const sesudah = Buffer.from(enk.encode(ekor.slice(1)));
  const sidik = createHash(opsi.algoritma ?? "sha256").update(Buffer.concat([sebelum, sesudah])).digest();
  const hex = derDenganSidik(sidik).toString("hex").padEnd(panjangHex, "0");
  return new Uint8Array(Buffer.concat([sebelum, Buffer.from(`<${hex}>`), sesudah, Buffer.from(opsi.tambahan ?? "")]));
}

test("TTE utuh: sidik bagian yang ditandatangani sama dengan messageDigest, juga dengan SHA-384", async () => {
  assert.deepEqual(await periksaTte(pdfBertandaTangan()), { keadaan: "utuh", jumlahTtd: 1 });
  assert.equal((await periksaTte(pdfBertandaTangan({ algoritma: "sha384" }))).keadaan, "utuh");
});

test("revisi sesudah tanda tangan (data validasi /DSS) tidak membuat TTE rusak", async () => {
  const pdf = pdfBertandaTangan({ tambahan: "6 0 obj\n<< /DSS << /Certs [] >> >>\nendobj\n%%EOF\n" });
  assert.equal((await periksaTte(pdf)).keadaan, "utuh");
});

test("satu bit yang berubah di bagian yang ditandatangani terbaca rusak", async () => {
  const pdf = pdfBertandaTangan();
  pdf[pdf.length - 20] ^= 0x01;
  assert.equal((await periksaTte(pdf)).keadaan, "rusak");
});

test("PDF tanpa tanda tangan digital: tanpa TTE", async () => {
  assert.deepEqual(await periksaTte(enk.encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n")), {
    keadaan: "tanpa",
    jumlahTtd: 0,
  });
});

test("stempel waktu dokumen (ETSI.RFC3161) tidak dinilai sebagai tanda tangan dokumen", async () => {
  // Sidiknya tersimpan di TSTInfo, bukan messageDigest; bila dinilai, hasilnya keliru menjadi rusak.
  const pdf = pdfBertandaTangan({ subFilter: "ETSI.RFC3161" });
  pdf[pdf.length - 20] ^= 0x01;
  assert.equal((await periksaTte(pdf)).keadaan, "tanpa");
});

test("tanda tangan yang isinya tidak memuat messageDigest: tidak dapat diperiksa, bukan rusak", async () => {
  const teks = "%PDF-1.7\n5 0 obj\n<< /Type /Sig /ByteRange [0 10 20 5] /Contents <3000> >>\nendobj\n%%EOF\n";
  assert.equal((await periksaTte(enk.encode(teks))).keadaan, "takTerperiksa");
});

test("sha256Hex: sidik berkas utuh untuk bukti berkas tersimpan sama dengan yang diunggah", async () => {
  const isi = enk.encode("%PDF-1.4 contoh");
  assert.equal(await sha256Hex(isi), createHash("sha256").update(isi).digest("hex"));
});
