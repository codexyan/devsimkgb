// Template surat KGB: isian otomatis, validasi, dan pemilihan versi menurut tanggal surat.
//
// Jalankan: node --import tsx --test lib/templateSurat.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TEMPLATE_BAWAAN,
  isiPenanda,
  keadaanVersi,
  mmKePt,
  normalisasiTemplate,
  penandaTakDikenal,
  periksaTemplate,
  pilihVersi,
  potongSurel,
  potongTebal,
  templateUntuk,
  type VersiTemplate,
} from "./templateSurat";

test("templat bawaan meniru ukuran surat lama (A4, margin dalam poin)", () => {
  const t = TEMPLATE_BAWAAN;
  assert.ok(Math.abs(mmKePt(t.kertas.lebarMm) - 595.28) < 0.01);
  assert.ok(Math.abs(mmKePt(t.kertas.tinggiMm) - 841.89) < 0.01);
  // Nilai milimeter dibulatkan ke 0,1 mm (ptKeMm), jadi selisihnya paling jauh sekitar 0,15 pt.
  assert.ok(Math.abs(mmKePt(t.margin.atasMm) - 116) < 0.2);
  assert.ok(Math.abs(mmKePt(t.margin.kiriMm) - 62) < 0.2);
  assert.ok(Math.abs(mmKePt(t.kop.garisAtasMm) - 108.1) < 0.2);
  assert.ok(Math.abs(t.huruf.ukuranPt * t.huruf.spasi - 13.87) < 0.01);
  assert.deepEqual(periksaTemplate(t), []);
});

test("isian otomatis diisi; yang tidak dikenal dibiarkan dan dilaporkan", () => {
  assert.equal(isiPenanda("Yth. KPPN {kppn}, a.n. {nama}", { kppn: "Banjarmasin", nama: "Siti" }), "Yth. KPPN Banjarmasin, a.n. Siti");
  assert.equal(isiPenanda("{gaji_barru}", {}), "{gaji_barru}");
  assert.deepEqual(penandaTakDikenal("{nama} {gaji_barru} {gaji_barru}"), ["gaji_barru"]);
});

test("penanda tebal dan surel dipotong untuk dicetak", () => {
  assert.deepEqual(potongTebal("a.n. **Siti**"), [{ teks: "a.n. ", tebal: false }, { teks: "Siti", tebal: true }]);
  assert.deepEqual(potongSurel("Pos-el : kanwil@gmail.com"), [
    { teks: "Pos-el : ", surel: false },
    { teks: "kanwil@gmail.com", surel: true },
  ]);
});

test("isi tersimpan yang tidak lengkap dilengkapi dari templat bawaan", () => {
  const t = normalisasiTemplate({ kertas: { lebarMm: 215, tinggiMm: 330 }, kepala: { hal: "KGB" } });
  assert.equal(t.kertas.tinggiMm, 330);
  assert.equal(t.kepala.hal, "KGB");
  assert.equal(t.kepala.sifat, "Segera");
  assert.equal(t.tembusan.length, 5);
  assert.deepEqual(normalisasiTemplate("bukan objek"), normalisasiTemplate({}));
});

test("validasi menolak ukuran tidak wajar dan isian tak dikenal", () => {
  const t = normalisasiTemplate({ kertas: { lebarMm: 50, tinggiMm: 297 }, paragraf: { penutup: "{pp}" } });
  const galat = periksaTemplate(t);
  assert.ok(galat.some((g) => g.includes("Ukuran kertas")));
  assert.ok(galat.some((g) => g.includes("{pp}")));
  assert.ok(periksaTemplate(normalisasiTemplate({ kop: { logo: "../rahasia.png" } })).some((g) => g.includes("Logo")));
  assert.deepEqual(periksaTemplate(normalisasiTemplate({ kop: { logo: "template/logo_1.png" } })), []);
});

const versi = (id: string, n: number, mulai: string): VersiTemplate => ({
  id, versi: n, berlakuMulai: new Date(mulai), isi: normalisasiTemplate({ kepala: { hal: id } }),
});

test("SK memakai versi yang berlaku pada tanggal suratnya", () => {
  const daftar = [versi("v1", 1, "2026-10-01T00:00:00+08:00"), versi("v2", 2, "2027-01-01T00:00:00+08:00")];
  assert.equal(pilihVersi(daftar, new Date("2026-09-30T10:00:00+08:00")), null);
  assert.equal(templateUntuk(daftar, new Date("2026-09-30T10:00:00+08:00")), TEMPLATE_BAWAAN);
  assert.equal(pilihVersi(daftar, new Date("2026-10-01T00:00:00+08:00"))?.id, "v1");
  assert.equal(pilihVersi(daftar, new Date("2026-12-31T23:00:00+08:00"))?.id, "v1");
  assert.equal(pilihVersi(daftar, new Date("2027-03-05T08:00:00+08:00"))?.id, "v2");
  // Dua versi pada hari yang sama: nomor versi terbesar.
  assert.equal(pilihVersi([...daftar, versi("v3", 3, "2027-01-01T00:00:00+08:00")], new Date("2027-02-01"))?.id, "v3");
});

test("keadaan versi terhadap hari ini", () => {
  const daftar = [versi("lama", 1, "2026-01-01"), versi("kini", 2, "2026-09-01"), versi("nanti", 3, "2027-01-01")];
  const k = keadaanVersi(daftar, new Date("2026-09-27"));
  assert.equal(k.get("lama"), "riwayat");
  assert.equal(k.get("kini"), "aktif");
  assert.equal(k.get("nanti"), "terjadwal");
});
