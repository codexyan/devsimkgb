// Pratinjau SK KGB dari isian usulan UPT sebelum diajukan (ADR-078): angkanya sama dengan yang terjadi bila Kanwil
// menyetujui usulan lalu membuat SK.
//
// Jalankan: node --import tsx --test lib/pratinjauSkUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { dasarSkPratinjau, keadaanSesudahUsulan, rencanaKgbPratinjau } from "./pratinjauSkUsulan";
import { mkgPadaSkDasar } from "./prosesKgb";
import { getGajiPokok } from "./tabelGaji";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

// Skema Admin UPT: KGB terakhir 1 Des 2024 di II/b 7 tahun (SK W19.PAS17.KP.04.04-2611); PI TMT 1 Feb 2026 ke III/a,
// di SK 3 tahun 2 bulan.
const pegawai = {
  id: "p1", nip: "199001012015031001", nama: "PEGAWAI UJI", golonganRuang: "II/b", pangkat: "Pengatur Muda Tingkat I",
  mkgTahun: 7, mkgBulan: 0, gajiPokok: getGajiPokok("II/b", 7, 0), tmtGolongan: tgl(2022, 4),
  tmtKgbTerakhir: tgl(2024, 12), tmtKgbBerikutnya: tgl(2026, 12),
  nomorSkDasar: "W19.PAS17.KP.04.04-2611", tanggalSkDasar: tgl(2024, 10, 3), penetapSkDasar: "Kepala Kantor Wilayah",
} as PegawaiRow;

const usulanKp = {
  golonganRuang: "III/a", mkgTahun: 3, mkgBulan: 2, tmtKgbTerakhir: tgl(2024, 12),
  golonganAcuan: "II/b", mkgTahunAcuan: 7, mkgBulanAcuan: 0,
  nomorSkTerakhir: "W19.PAS17.KP.04.04-2611", tanggalSkTerakhir: tgl(2024, 10, 3),
  dasarBaruJenis: "kp", dasarBaruJenisKp: "penyesuaian_ijazah", dasarBaruNomorSk: "SEK-2156.SA.04.05",
  dasarBaruTanggalSk: tgl(2026, 1, 29), dasarBaruTmt: tgl(2026, 2), dasarBaruPenetap: "Sekretaris Jenderal",
} as Partial<UsulanPegawaiRow>;

test("pegawai tercatat: KGB berikutnya 1 Des 2026 di III/a atas dasar SK PI, masa kerja pada SK dasar 3 tahun 2 bulan", () => {
  const keadaan = keadaanSesudahUsulan(usulanKp, pegawai);
  assert.ok(keadaan.ok);
  assert.equal(keadaan.nilai.golonganRuang, "III/a");
  assert.deepEqual([keadaan.nilai.mkgTahun, keadaan.nilai.mkgBulan], [2, 0]);
  assert.deepEqual(keadaan.nilai.tmtKgbBerikutnya, tgl(2026, 12));

  const rencana = rencanaKgbPratinjau(keadaan.nilai, tgl(2026, 10, 7));
  assert.ok(rencana.ok);
  assert.deepEqual(rencana.nilai.tmtKgbBaru, tgl(2026, 12));
  assert.equal(rencana.nilai.gajiPokokLama, getGajiPokok("III/a", 2, 0));
  assert.deepEqual([rencana.nilai.mkgTahunBaru, rencana.nilai.mkgBulanBaru], [4, 0]);
  assert.equal(rencana.nilai.gajiPokokBaru, getGajiPokok("III/a", 4, 0));
  assert.deepEqual(rencana.nilai.tmtKgbBerikutnya, tgl(2028, 12));

  const dasar = dasarSkPratinjau({ usulan: usulanKp, pegawaiLama: pegawai, tmtKgbBaru: rencana.nilai.tmtKgbBaru });
  assert.equal(dasar?.nomorSK, "SEK-2156.SA.04.05", "SK PI yang dilaporkan menjadi Atas dasar");
  assert.equal(dasar?.penetap, "Sekretaris Jenderal");
  // Baris "Masa kerja golongan pada tanggal tersebut" di SK KGB.
  assert.deepEqual(
    mkgPadaSkDasar({ ...rencana.nilai, tmtSK: dasar?.tmt ?? null }),
    { tahun: 3, bulan: 2 },
  );
});

test("tanpa SK sesudahnya: Atas dasar SK KGB terakhir, dan pegawai baru dihitung dari isiannya", () => {
  const tanpaSk = { ...usulanKp, dasarBaruJenis: "tidak", golonganRuang: "II/b", mkgTahun: 7, mkgBulan: 0, golonganAcuan: null };
  const keadaan = keadaanSesudahUsulan(tanpaSk, pegawai);
  assert.ok(keadaan.ok);
  assert.equal(keadaan.nilai.golonganRuang, "II/b");
  const rencana = rencanaKgbPratinjau(keadaan.nilai);
  assert.ok(rencana.ok);
  const dasar = dasarSkPratinjau({ usulan: tanpaSk, pegawaiLama: pegawai, tmtKgbBaru: rencana.nilai.tmtKgbBaru });
  assert.equal(dasar?.nomorSK, "W19.PAS17.KP.04.04-2611");
  assert.equal(dasar?.penetap, "Kepala Kantor Wilayah");

  // Pegawai baru dengan SK yang sama: hasilnya sama dengan pegawai tercatat.
  const baru = keadaanSesudahUsulan({ ...usulanKp, jenis: "baru" }, null);
  assert.ok(baru.ok);
  assert.deepEqual([baru.nilai.golonganRuang, baru.nilai.mkgTahun, baru.nilai.mkgBulan], ["III/a", 2, 0]);
  assert.deepEqual(baru.nilai.tmtKgbBerikutnya, tgl(2026, 12));
});

test("SK yang tidak dapat dihitung dilaporkan, bukan dipratinjau dengan angka keliru", () => {
  const turun = keadaanSesudahUsulan({ ...usulanKp, golonganRuang: "II/a" }, pegawai);
  assert.equal(turun.ok, false);
  const tanpaTmt = rencanaKgbPratinjau({ golonganRuang: "III/a", pangkat: "", mkgTahun: 2, mkgBulan: 0, gajiPokok: 0, tmtKgbTerakhir: null, tmtKgbBerikutnya: null });
  assert.equal(tanpaTmt.ok, false);
});

test("SK yang dilaporkan tetapi belum bertanggal atau ber-TMT tidak dipratinjau", () => {
  const tanpaTanggal = keadaanSesudahUsulan({ ...usulanKp, dasarBaruTanggalSk: null }, pegawai);
  assert.equal(tanpaTanggal.ok, false);
  if (!tanpaTanggal.ok) assert.match(tanpaTanggal.pesan, /tanggal SK dan TMT pangkat/);
  assert.equal(keadaanSesudahUsulan({ ...usulanKp, dasarBaruTmt: null, jenis: "baru" }, null).ok, false);
});
