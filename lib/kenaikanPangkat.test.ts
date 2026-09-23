import { test } from "node:test";
import assert from "node:assert/strict";
import { dampakKenaikanPangkatPadaKgb, hitungKenaikanPangkat, isJenisKp, peringkatGolongan } from "@/lib/kenaikanPangkat";
import { getGajiPokok } from "@/lib/tabelGaji";

test("pindah jenjang golongan memotong MKG sesuai Buku Saku KP", () => {
  // II/d → III/a: masa kerja golongan dikurangi 5 tahun
  const a = hitungKenaikanPangkat({ golonganLama: "II/d", mkgTahunLama: 20, mkgBulanLama: 0, golonganBaru: "III/a" });
  assert.equal(a.ok, true);
  if (!a.ok) return;
  assert.equal(a.hasil.mkgTahunBaru, 15);
  assert.equal(a.hasil.potonganMkgTahun, 5);
  assert.equal(a.hasil.gajiPokokBaru, getGajiPokok("III/a", 15, 0));
  assert.equal(a.hasil.pangkatBaru, "Penata Muda");

  // I/d → II/a: masa kerja golongan dikurangi 6 tahun
  const b = hitungKenaikanPangkat({ golonganLama: "I/d", mkgTahunLama: 18, mkgBulanLama: 4, golonganBaru: "II/a" });
  assert.equal(b.ok, true);
  if (!b.ok) return;
  assert.equal(b.hasil.mkgTahunBaru, 12);
  assert.equal(b.hasil.mkgBulanBaru, 4);
  assert.equal(b.hasil.potonganMkgTahun, 6);
});

test("kenaikan di dalam jenjang yang sama membawa MKG apa adanya", () => {
  const h = hitungKenaikanPangkat({ golonganLama: "III/a", mkgTahunLama: 8, mkgBulanLama: 0, golonganBaru: "III/b" });
  assert.equal(h.ok, true);
  if (!h.ok) return;
  assert.equal(h.hasil.mkgTahunBaru, 8);
  assert.equal(h.hasil.potonganMkgTahun, 0);
  assert.equal(h.hasil.gajiPokokBaru, getGajiPokok("III/b", 8, 0));
});

test("MKG tidak pernah menjadi negatif", () => {
  const h = hitungKenaikanPangkat({ golonganLama: "II/d", mkgTahunLama: 3, mkgBulanLama: 0, golonganBaru: "III/a" });
  assert.equal(h.ok, true);
  if (!h.ok) return;
  assert.equal(h.hasil.mkgTahunBaru, 0);
});

test("golongan harus naik dan dikenal", () => {
  assert.equal(hitungKenaikanPangkat({ golonganLama: "III/b", mkgTahunLama: 10, mkgBulanLama: 0, golonganBaru: "III/a" }).ok, false);
  assert.equal(hitungKenaikanPangkat({ golonganLama: "III/b", mkgTahunLama: 10, mkgBulanLama: 0, golonganBaru: "III/b" }).ok, false);
  assert.equal(hitungKenaikanPangkat({ golonganLama: "III/b", mkgTahunLama: 10, mkgBulanLama: 0, golonganBaru: "V/a" }).ok, false);
  assert.equal(peringkatGolongan("IV/e") > peringkatGolongan("I/a"), true);
});

test("jenis KP hanya yang ada di Buku Saku", () => {
  assert.equal(isJenisKp("reguler"), true);
  assert.equal(isJenisKp("penyesuaian_ijazah"), true);
  assert.equal(isJenisKp("karangan"), false);
});

test("KGB berjalan dipisahkan: placeholder diselaraskan, yang sudah dikerjakan ditinjau", () => {
  const d = dampakKenaikanPangkatPadaKgb([
    { id: "a", status: "belum_diproses" },
    { id: "b", status: "sedang_diproses" },
    { id: "c", status: "menunggu_keuangan" },
    { id: "d", status: "selesai" },
    { id: "e", status: "ditolak" },
    { id: "f", status: "menunggu_keuangan", isArsip: true },
  ]);
  assert.deepEqual(d.diselaraskan.map((k) => k.id), ["a"]);
  assert.deepEqual(d.perluDitinjau.map((k) => k.id), ["b", "c"]);
});
