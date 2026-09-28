// Peninjauan masa kerja: tambahan MKG, gaji pokok baru, dan usulan jadwal KGB berikutnya.
//
// Jalankan: node --import tsx --test lib/pmk.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { hitungPmk } from "./pmk";
import { getGajiPokok, kalkulasiKGB } from "./tabelGaji";
import { isoTanggalLokal } from "./waktu";

// III/a, KGB terakhir TMT 1 Des 2024 dengan MKG 2 tahun; KGB berikutnya semula 1 Des 2026 (MKG 4).
const pegawai = { golonganRuang: "III/a", mkgTahun: 2, mkgBulan: 0, tmtKgbTerakhir: "2024-12-01" };

test("PMK satu tahun memajukan KGB berikutnya dan menaikkan gaji sesuai MKG baru", () => {
  // TMT PMK 1 Jul 2025: MKG sebelumnya 2 th 7 bl, SK PMK menetapkan 3 th 7 bl.
  const h = hitungPmk({ ...pegawai, tmtPmk: "2025-07-01", mkgTahunSk: 3, mkgBulanSk: 7 });
  assert.equal(h.ok, true);
  if (!h.ok) return;
  assert.equal(h.hasil.tambahBulan, 12);
  assert.deepEqual(h.hasil.mkgSebelumPadaTmt, { tahun: 2, bulan: 7 });
  assert.deepEqual([h.hasil.mkgTahunDasar, h.hasil.mkgBulanDasar], [3, 0]);
  assert.equal(h.hasil.gajiPokokBaru, getGajiPokok("III/a", 3, 7));
  // MKG 4 tahun tercapai 5 bulan sesudah TMT PMK, bukan 1 Des 2026.
  assert.equal(isoTanggalLokal(h.hasil.tmtKgbBerikutnyaUsulan), "2025-12-01");
  // Kalkulasi KGB dari data pegawai yang baru sampai tepat di MKG 4 tahun pada tanggal itu.
  const kgb = kalkulasiKGB({
    golonganRuang: "III/a",
    mkgTahun: h.hasil.mkgTahunDasar,
    mkgBulan: h.hasil.mkgBulanDasar,
    tmtKgbBerikutnya: h.hasil.tmtKgbBerikutnyaUsulan,
    tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
    hariIni: new Date(2025, 8, 1),
  });
  assert.deepEqual([kgb.mkgTahunBaru, kgb.mkgBulanBaru], [4, 0]);
});

test("PMK dua tahun penuh tidak menggeser jadwal, hanya menaikkan gaji", () => {
  const h = hitungPmk({ ...pegawai, tmtPmk: "2025-07-01", mkgTahunSk: 4, mkgBulanSk: 7 });
  assert.equal(h.ok, true);
  if (!h.ok) return;
  assert.equal(isoTanggalLokal(h.hasil.tmtKgbBerikutnyaUsulan), "2026-12-01");
  assert.equal(h.hasil.gajiPokokBaru, getGajiPokok("III/a", 4, 0));
});

test("PMK ditolak bila TMT-nya sebelum KGB terakhir atau MKG-nya tidak bertambah", () => {
  const awal = hitungPmk({ ...pegawai, tmtPmk: "2024-06-01", mkgTahunSk: 5, mkgBulanSk: 0 });
  assert.equal(awal.ok, false);
  if (!awal.ok) assert.match(awal.pesan, /lebih awal dari TMT KGB terakhir/);
  const tidakBertambah = hitungPmk({ ...pegawai, tmtPmk: "2025-07-01", mkgTahunSk: 2, mkgBulanSk: 7 });
  assert.equal(tidakBertambah.ok, false);
  if (!tidakBertambah.ok) assert.match(tidakBertambah.pesan, /2 tahun 7 bulan/);
  assert.equal(hitungPmk({ ...pegawai, tmtKgbTerakhir: null, tmtPmk: "2025-07-01", mkgTahunSk: 5, mkgBulanSk: 0 }).ok, false);
  assert.equal(hitungPmk({ ...pegawai, tmtPmk: "2025-07-01", mkgTahunSk: 5, mkgBulanSk: 12 }).ok, false);
});
