// Jalankan: node --import tsx --test lib/linimasaKpTetapTampil.test.ts
// ADR-120: SK kenaikan pangkat tetap tercantum di linimasa (kartu Dasar KGB) ketika dasarnya sudah bergeser.

import assert from "node:assert/strict";
import { test } from "node:test";
import { susunLinimasaDasar } from "./linimasaDasarSk";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const kgb2024 = { id: "k1", status: "selesai", isArsip: true, tmtKgbBaru: d("2024-12-01"), nomorSK: "W.19.PAS.15.KP.04.03-1261", tanggalSK: d("2024-10-15"), tmtSK: d("2024-12-01") };
const kp2025 = { id: "p1", nomorSK: "WP.19-79.SA.12 TAHUN 2025", tanggalSK: d("2025-05-06"), tmt: d("2025-06-01"), jenisKp: "reguler", golonganLama: "III/b", golonganBaru: "III/c" };

test("KP menjadi dasar KGB Des 2026, SK KGB 2024 tetap tercantum sebagai tergantikan", () => {
  const { sk, dasar } = susunLinimasaDasar({ kgb: [kgb2024], pangkat: [kp2025], tmtKgbSebelumnya: d("2024-12-01"), tmtKgbBaru: d("2026-12-01") });
  assert.equal(dasar?.kunci, "kp:p1");
  assert.deepEqual(sk.map((x) => [x.kunci, x.peran]), [["kgb:k1", "tergantikan"], ["kp:p1", "dasar"]]);
});

test("sesudah KGB Des 2026 selesai, dasar berpindah ke SK KGB itu dan KP tetap tercantum", () => {
  const kgb2026 = { id: "k2", status: "selesai", isArsip: false, tmtKgbBaru: d("2026-12-01"), nomorSK: "WP.19-79.SA.12 TAHUN 2025", tmtSK: d("2026-12-01"), surat: { nomorSurat: "W.19.PAS.15.KP.04.03-2001", tanggalSurat: d("2026-11-20") } };
  const { sk, dasar } = susunLinimasaDasar({ kgb: [kgb2024, kgb2026], pangkat: [kp2025], tmtKgbSebelumnya: d("2026-12-01"), tmtKgbBaru: d("2028-12-01") });
  assert.equal(dasar?.kunci, "kgb:k2");
  const kp = sk.find((x) => x.kunci === "kp:p1");
  assert.ok(kp, "KP masih ada di linimasa");
  assert.equal(kp?.peran, "tergantikan");
  assert.equal(sk.length, 3);
});
