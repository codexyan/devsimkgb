// Jalankan: node --import tsx --test lib/mkgMenurutSk.test.ts
// ADR-123: masa kerja menurut SK kenaikan pangkat sesudah KGB terakhir, hanya untuk ditampilkan.

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkgPadaSkTercatat } from "./dasarSkUsulan";
import { mkgPadaSkDasar } from "./prosesKgb";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

test("tersimpan 7/0 pada KGB terakhir 1 Des 2024, KP 1 Apr 2026 menulis 8 thn 4 bln di SK", () => {
  const hasil = mkgPadaSkTercatat({ mkgTahun: 7, mkgBulan: 0, tmtKgbTerakhir: d("2024-12-01") }, { jenis: "kp", tmt: d("2026-04-01") });
  assert.deepEqual(hasil?.mkg, { tahun: 8, bulan: 4 });
  assert.equal(hasil?.jenis, "kp");
});

test("SK KGB, SK CPNS, atau SK yang tidak sesudah KGB terakhir tidak menampilkan angka lain", () => {
  const data = { mkgTahun: 7, mkgBulan: 0, tmtKgbTerakhir: d("2024-12-01") };
  assert.equal(mkgPadaSkTercatat(data, { jenis: "kgb", tmt: d("2024-12-01") }), null);
  assert.equal(mkgPadaSkTercatat(data, { jenis: "cpns", tmt: d("2020-01-01") }), null);
  assert.equal(mkgPadaSkTercatat(data, { jenis: "kp", tmt: d("2024-12-01") }), null);
});

test("angka tampilan sejalan dengan hitungan KGB: 8/4 + 8 bulan = 7/0 + 24 bulan = 9/0 di Des 2026", () => {
  assert.deepEqual(
    mkgPadaSkDasar({ tmtSK: d("2026-04-01"), tmtKgbBaru: d("2026-12-01"), mkgTahunLama: 7, mkgBulanLama: 0, mkgTahunBaru: 9, mkgBulanBaru: 0 }),
    { tahun: 8, bulan: 4 },
    "SK KGB mencetak 8 thn 4 bln pada baris SK dasar, sama dengan angka yang tampil di Data Kepegawaian",
  );
});
