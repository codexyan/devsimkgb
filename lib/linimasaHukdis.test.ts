// Linimasa perhitungan hukdis untuk formulir Catat Kanwil (ADR-116).
//
// Jalankan: node --import tsx --test lib/linimasaHukdis.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonLinimasaHukdis, susunLinimasaHukdis, type MasukanLinimasa } from "./linimasaHukdis";
import { getGajiPokok } from "./tabelGaji";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(Date.UTC(tahun, bulan - 1, hari));
const bulanIso = (d: Date) => d.toISOString().slice(0, 7);
const mkg = (t: { mkgTahun: number; mkgBulan: number }) => `${t.mkgTahun}th${t.mkgBulan}b`;

/** Skenario pemilik: KGB 1 April 2024 MKG 10 th (III/b), jadwal berikutnya April 2026, hukdis menunda 12 bulan. */
const skenario = (ubah: Partial<MasukanLinimasa> = {}): MasukanLinimasa => ({
  dasar: { golonganRuang: "III/b", mkgTahun: 10, mkgBulan: 0, gajiPokok: getGajiPokok("III/b", 10, 0), tmtKgbTerakhir: tgl(2024, 4) },
  acuanBerjalan: false,
  tmtSebelum: tgl(2026, 4),
  tmtBaru: tgl(2027, 4),
  bulan: 12,
  hukuman: { mulai: tgl(2025, 6), berakhir: tgl(2026, 5, 31) },
  ...ubah,
});

test("skenario pemilik: jalur semula 2026 dan 2028, jalur sesudah dicatat 2027 dan 2028, MKG sejajar masa kerja nyata", () => {
  const l = susunLinimasaHukdis(skenario());
  assert.ok(l);
  assert.deepEqual(l.semula.map((t) => [bulanIso(t.tmt), mkg(t)]), [["2026-04", "12th0b"], ["2028-04", "14th0b"]]);
  assert.deepEqual(l.sesudah.map((t) => [bulanIso(t.tmt), mkg(t)]), [["2027-04", "13th0b"], ["2028-04", "14th0b"]], "penundaan dihitung penuh; bukan 2029");
  assert.equal(l.sesudah[0].gaji, getGajiPokok("III/b", 13, 0));
  assert.equal(l.sesudah[1].gaji, l.semula[1].gaji, "gaji pada KGB yang kembali ke jalur sama dengan tanpa hukuman");
  assert.equal(l.sejajar, true);
  assert.equal(l.bulan, 12);
  assert.equal(bulanIso(l.acuan.tmt), "2024-04");
  assert.equal(l.acuan.gaji, getGajiPokok("III/b", 10, 0));
});

test("penundaan 6 bulan: KGB tertunda 6 bulan sesudah jadwal, lalu kembali ke jalur dengan MKG nyata", () => {
  const l = susunLinimasaHukdis(skenario({ tmtBaru: tgl(2026, 10), bulan: 6 }));
  assert.ok(l);
  assert.deepEqual(l.sesudah.map((t) => [bulanIso(t.tmt), mkg(t)]), [["2026-10", "12th6b"], ["2028-04", "14th0b"]]);
  assert.equal(l.sejajar, true);
});

test("CPNS II/a: KGB pertama 12 bulan yang tertunda kembali ke jalurnya", () => {
  const l = susunLinimasaHukdis({
    dasar: { golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, gajiPokok: getGajiPokok("II/a", 0, 0), tmtKgbTerakhir: tgl(2025, 6) },
    acuanBerjalan: false,
    tmtSebelum: tgl(2026, 6),
    tmtBaru: tgl(2027, 6),
    bulan: 12,
    hukuman: { mulai: tgl(2026, 1) },
  });
  assert.ok(l);
  assert.deepEqual(l.semula.map((t) => bulanIso(t.tmt)), ["2026-06", "2028-06"]);
  assert.deepEqual(l.sesudah.map((t) => bulanIso(t.tmt)), ["2027-06", "2028-06"]);
  assert.equal(l.sejajar, true);
  assert.equal(l.hukuman.berakhir, null, "tanpa masa berakhir");
});

test("dasar KGB yang sedang berjalan: acuan ditandai berjalan dan siklus sesudahnya yang bergeser", () => {
  const l = susunLinimasaHukdis(
    skenario({
      dasar: { golonganRuang: "III/b", mkgTahun: 12, mkgBulan: 0, gajiPokok: getGajiPokok("III/b", 12, 0), tmtKgbTerakhir: tgl(2026, 4) },
      acuanBerjalan: true,
      tmtSebelum: tgl(2028, 4),
      tmtBaru: tgl(2029, 4),
      hukuman: { mulai: tgl(2026, 8), berakhir: tgl(2027, 7, 31) },
    }),
  );
  assert.ok(l);
  assert.equal(l.acuanBerjalan, true);
  assert.deepEqual(l.sesudah.map((t) => [bulanIso(t.tmt), mkg(t)]), [["2029-04", "15th0b"], ["2030-04", "16th0b"]]);
  assert.equal(l.sejajar, true);
});

test("tanggal mulai tidak valid atau golongan tidak dikenal: tanpa linimasa, tanpa melempar", () => {
  assert.equal(susunLinimasaHukdis(skenario({ hukuman: { mulai: null } })), null);
  assert.equal(susunLinimasaHukdis(skenario({ dasar: { ...skenario().dasar, golonganRuang: "Z/z" } })), null);
});

test("bentuk JSON memakai tanggal kalender", () => {
  const json = jsonLinimasaHukdis(susunLinimasaHukdis(skenario())!);
  assert.equal(json.acuan.tmt, "2024-04-01T00:00:00.000Z");
  assert.equal(json.sesudah[0].tmt, "2027-04-01T00:00:00.000Z");
  assert.equal(json.hukuman.berakhir, "2026-05-31T00:00:00.000Z");
  assert.equal(json.sejajar, true);
});
