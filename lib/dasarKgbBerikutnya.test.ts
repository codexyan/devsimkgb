// SK yang menjadi dasar KGB berikutnya (ADR-020, ADR-030).
//
// Jalankan: node --import tsx --test lib/dasarKgbBerikutnya.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { dasarKgbBerikutnya } from "./dasarKgbBerikutnya";

// Tanggal kalender waktu setempat: dasarKgbBerikutnya membakukannya lewat tanggalKalender (WITA).
const tgl = (t: number, b: number, h = 1) => new Date(t, b - 1, h);

const kgbSelesai = [
  { status: "selesai", tmtKgbBaru: tgl(2024, 6), surat: { nomorSurat: "W.17-KP.04.03-100", tanggalSurat: tgl(2024, 5, 20) } },
  { status: "selesai", tmtKgbBaru: tgl(2026, 6), surat: { nomorSurat: "W.17-KP.04.03-529", tanggalSurat: tgl(2026, 5, 20) } },
  { status: "belum_diproses", tmtKgbBaru: tgl(2028, 6), surat: null },
];

test("tanpa kenaikan pangkat maupun PMK, dasarnya SK KGB terakhir yang selesai", () => {
  const d = dasarKgbBerikutnya({ kgb: kgbSelesai });
  assert.equal(d?.jenis, "kgb");
  assert.equal(d?.nomorSK, "W.17-KP.04.03-529");
  assert.equal(d?.tmt, tgl(2026, 6).toISOString());
});

test("SK kenaikan pangkat sesudah KGB terakhir menggantikan dasarnya", () => {
  const d = dasarKgbBerikutnya({
    kgb: kgbSelesai,
    pangkat: [{ nomorSK: "W.19-KP.03.01-9", tanggalSK: tgl(2026, 9, 2), tmt: tgl(2026, 10), jenisKp: "penyesuaian_ijazah" }],
  });
  assert.equal(d?.jenis, "kp");
  assert.equal(d?.label, "SK kenaikan pangkat (Pilihan: Penyesuaian Ijazah)");
  assert.equal(d?.nomorSK, "W.19-KP.03.01-9");
});

test("SK kenaikan pangkat sebelum KGB terakhir tidak dipakai, sebab sudah terwakili SK KGB itu", () => {
  const d = dasarKgbBerikutnya({
    kgb: kgbSelesai,
    pangkat: [{ nomorSK: "W.19-KP.03.01-1", tanggalSK: tgl(2023, 1, 5), tmt: tgl(2023, 4), jenisKp: "reguler" }],
  });
  assert.equal(d?.jenis, "kgb");
  assert.equal(d?.nomorSK, "W.17-KP.04.03-529");
});

test("di antara kenaikan pangkat dan PMK, yang TMT-nya paling baru yang menang", () => {
  const pangkat = [{ nomorSK: "KP-9", tmt: tgl(2026, 10), jenisKp: "reguler" }];
  const pmk = [{ nomorSK: "PMK-7", tmt: tgl(2027, 1) }];
  assert.equal(dasarKgbBerikutnya({ kgb: kgbSelesai, pangkat, pmk })?.nomorSK, "PMK-7");
  assert.equal(dasarKgbBerikutnya({ kgb: kgbSelesai, pangkat, pmk: [{ nomorSK: "PMK-7", tmt: tgl(2026, 7) }] })?.nomorSK, "KP-9");
});

test("pegawai yang belum pernah KGB di SIM-KGB memakai SK kenaikan pangkat bila ada, selain itu tidak ada dasar", () => {
  assert.equal(dasarKgbBerikutnya({ kgb: [] }), null);
  const d = dasarKgbBerikutnya({ kgb: [], pangkat: [{ nomorSK: "KP-1", tmt: tgl(2025, 4), jenisKp: "reguler" }] });
  assert.equal(d?.jenis, "kp");
});

test("KGB arsip memakai nomor SK yang diarsipkan, bukan surat SIM-KGB", () => {
  const d = dasarKgbBerikutnya({
    kgb: [{ status: "selesai", isArsip: true, tmtKgbBaru: tgl(2025, 3), nomorSK: "ARSIP-12", tanggalSK: tgl(2025, 2, 1), tmtSK: tgl(2025, 3), surat: null }],
  });
  assert.equal(d?.nomorSK, "ARSIP-12");
  assert.equal(d?.tanggalSK, tgl(2025, 2, 1).toISOString());
});
