// Jadwal kenaikan gaji berkala mengikuti langkah masa kerja golongan di tabel gaji, bukan selalu 2 tahun.
// PNS yang pertama diangkat di golongan II/a (MKG 0) mendapat KGB pertama di MKG 1, lalu MKG ganjil.
//
// Jalankan: node --import tsx --test lib/tabelGaji.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bulanKeKgbBerikutnya,
  hitungDeadlineSDM,
  hitungUnlockDate,
  jendelaProsesKgb,
  kalkulasiKGB,
  tambahBulan,
  tanggaGaji,
} from "./tabelGaji";
import { hariIniWita } from "./waktu";

const tanggal = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);
const sama = (a: Date, b: Date) => assert.equal(a.toDateString(), b.toDateString());

test("langkah ke KGB berikutnya dibaca dari tabel gaji", () => {
  assert.equal(bulanKeKgbBerikutnya("II/a", 0, 0), 12, "II/a MKG 0 naik di MKG 1");
  assert.equal(bulanKeKgbBerikutnya("II/a", 1, 0), 24, "II/a MKG 1 naik di MKG 3");
  assert.equal(bulanKeKgbBerikutnya("II/a", 2, 0), 12, "II/a MKG 2 naik di MKG 3");
  assert.equal(bulanKeKgbBerikutnya("II/b", 3, 0), 24);
  assert.equal(bulanKeKgbBerikutnya("III/a", 0, 0), 24);
  assert.equal(bulanKeKgbBerikutnya("III/a", 4, 6), 18, "masa kerja bulanan dihitung sampai langkah berikutnya");
  assert.equal(bulanKeKgbBerikutnya("II/a", 33, 0), 24, "di atas langkah terakhir tetap siklus 2 tahun");
});

test("tambahBulan menggeser tanggal per bulan", () => {
  sama(tambahBulan(tanggal(2025, 6), 12), tanggal(2026, 6));
  sama(tambahBulan(tanggal(2026, 11), 3), tanggal(2027, 2));
});

test("KGB pertama PNS golongan II/a eks CPNS jatuh setelah 1 tahun", () => {
  // Contoh permohonan UPT: TMT CPNS 1 Juni 2025, KGB pertama TMT 1 Juni 2026.
  const hasil = kalkulasiKGB({
    golonganRuang: "II/a",
    mkgTahun: 0,
    mkgBulan: 0,
    tmtKgbBerikutnya: tanggal(2026, 6),
    tmtKgbTerakhir: tanggal(2025, 6),
  });
  assert.equal(hasil.mkgTahunBaru, 1);
  assert.equal(hasil.mkgBulanBaru, 0);
  assert.equal(hasil.gajiPokokBaru, 2218400);
  sama(hasil.tmtKgbBaru, tanggal(2026, 6));
  sama(hasil.tmtKgbBerikutnya, tanggal(2028, 6));
});

test("tanpa TMT terakhir, MKG baru mengikuti langkah tabel", () => {
  const hasil = kalkulasiKGB({ golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbBerikutnya: tanggal(2026, 6) });
  assert.equal(hasil.mkgTahunBaru, 1);
  sama(hasil.tmtKgbBerikutnya, tanggal(2028, 6));
});

test("siklus biasa menambah 2 tahun", () => {
  const hasil = kalkulasiKGB({
    golonganRuang: "III/a",
    mkgTahun: 4,
    mkgBulan: 0,
    tmtKgbBerikutnya: tanggal(2026, 4),
    tmtKgbTerakhir: tanggal(2024, 4),
  });
  assert.equal(hasil.mkgTahunBaru, 6);
  assert.equal(hasil.mkgBulanBaru, 0);
  sama(hasil.tmtKgbBerikutnya, tanggal(2028, 4));
});

test("masa penundaan dihitung penuh sebagai masa kerja", () => {
  // TMT terakhir Januari 2024, KGB tertunda 6 bulan sehingga baru berlaku Juli 2026.
  const hasil = kalkulasiKGB({
    golonganRuang: "III/a",
    mkgTahun: 4,
    mkgBulan: 0,
    tmtKgbBerikutnya: tanggal(2026, 7),
    tmtKgbTerakhir: tanggal(2024, 1),
  });
  assert.equal(hasil.mkgTahunBaru, 6);
  assert.equal(hasil.mkgBulanBaru, 6);
  // Dari MKG 6 tahun 6 bulan, langkah berikutnya MKG 8, yaitu 18 bulan kemudian.
  sama(hasil.tmtKgbBerikutnya, tanggal(2028, 1));
});

test("siklus berikutnya untuk II/a setelah MKG 1", () => {
  const hasil = kalkulasiKGB({ golonganRuang: "II/a", mkgTahun: 1, mkgBulan: 0, tmtKgbBerikutnya: tanggal(2028, 6) });
  assert.equal(hasil.mkgTahunBaru, 3);
  assert.equal(hasil.gajiPokokBaru, 2288200);
  sama(hasil.tmtKgbBerikutnya, tanggal(2030, 6));
});

// Zona waktu: TMT tersimpan sebagai 00:00Z (ditulis dari Workers) atau 16:00Z hari sebelumnya
// (tengah malam WITA). Jalankan juga dengan TZ=UTC agar perilaku proses UTC ikut teruji.

test("kedua bentuk TMT tersimpan menghasilkan perhitungan yang sama", () => {
  const bentuk = [
    { tmtKgbBerikutnya: "2026-06-01T00:00:00Z", tmtKgbTerakhir: "2024-05-31T16:00:00Z" },
    { tmtKgbBerikutnya: "2026-05-31T16:00:00Z", tmtKgbTerakhir: "2024-06-01T00:00:00Z" },
  ];
  for (const tmt of bentuk) {
    const hasil = kalkulasiKGB({ golonganRuang: "III/a", mkgTahun: 4, mkgBulan: 0, ...tmt, hariIni: tanggal(2026, 3, 1) });
    assert.equal(hasil.mkgTahunBaru, 6, tmt.tmtKgbBerikutnya);
    assert.equal(hasil.mkgBulanBaru, 0, tmt.tmtKgbBerikutnya);
    assert.deepEqual(hasil.tmtKgbBaru, tanggal(2026, 6));
    assert.deepEqual(hasil.tmtKgbBerikutnya, tanggal(2028, 6));
    assert.deepEqual(hasil.deadlineSDM, tanggal(2026, 4, 30));
    assert.deepEqual(hasil.unlockDate, tanggal(2026, 4, 1));
  }
});

test("flagRapelan dan isLocked dibandingkan dengan hari ini WITA", () => {
  const dasar = { golonganRuang: "III/a", mkgTahun: 4, mkgBulan: 0, tmtKgbTerakhir: "2024-06-01T00:00:00Z" };
  // TMT 1 Juni 2026: batas SDM 30 April 2026. Pukul 16.30Z tanggal 30 April sudah 1 Mei WITA.
  const tmtJuni = { ...dasar, tmtKgbBerikutnya: "2026-06-01T00:00:00Z" };
  assert.equal(kalkulasiKGB({ ...tmtJuni, hariIni: hariIniWita(new Date("2026-04-30T15:30:00Z")) }).flagRapelan, false);
  assert.equal(kalkulasiKGB({ ...tmtJuni, hariIni: hariIniWita(new Date("2026-04-30T16:30:00Z")) }).flagRapelan, true);
  assert.equal(kalkulasiKGB({ ...tmtJuni, hariIni: new Date(2026, 3, 30, 23, 0) }).flagRapelan, false, "jam diabaikan");

  // TMT 1 Juli 2026: jendela dibuka 1 Mei 2026 WITA.
  const tmtJuli = { ...dasar, tmtKgbBerikutnya: "2026-06-30T16:00:00Z", tmtKgbTerakhir: "2024-07-01T00:00:00Z" };
  assert.equal(kalkulasiKGB({ ...tmtJuli, hariIni: hariIniWita(new Date("2026-04-30T15:30:00Z")) }).isLocked, true);
  assert.equal(kalkulasiKGB({ ...tmtJuli, hariIni: hariIniWita(new Date("2026-04-30T16:30:00Z")) }).isLocked, false);
});

test("TMT berikutnya kosong atau tidak valid ditolak", () => {
  for (const tmtKgbBerikutnya of [null, "", "bukan tanggal"]) {
    assert.throws(() => kalkulasiKGB({ golonganRuang: "III/a", mkgTahun: 4, mkgBulan: 0, tmtKgbBerikutnya }), /TMT KGB berikutnya/);
  }
});

test("jendela proses dari TMT tersimpan", () => {
  assert.deepEqual(hitungDeadlineSDM(new Date("2026-02-28T16:00:00Z")), tanggal(2026, 1, 31));
  assert.deepEqual(hitungUnlockDate(new Date("2026-03-01T00:00:00Z")), tanggal(2026, 1, 1));
  assert.deepEqual(jendelaProsesKgb("2026-05-31T16:00:00Z", tanggal(2026, 4, 15)), {
    unlockDate: tanggal(2026, 4, 1),
    deadlineSDM: tanggal(2026, 4, 30),
    isLocked: false,
    flagRapelan: false,
  });
  assert.equal(jendelaProsesKgb(null), null);
  assert.equal(jendelaProsesKgb("bukan tanggal"), null);
});

// Nilai pertama dan terakhir tiap golongan dibaca langsung dari Lampiran PP 5/2024 (pindaian halaman 5).
const UJUNG_PP_5_2024: Record<string, [number, number, number, number]> = {
  "I/a": [0, 1685700, 26, 2522600],
  "I/b": [3, 1840800, 27, 2670700],
  "I/c": [3, 1918700, 27, 2783700],
  "I/d": [3, 1999900, 27, 2901400],
  "II/a": [0, 2184000, 33, 3643400],
  "II/b": [3, 2385000, 33, 3797500],
  "II/c": [3, 2485900, 33, 3958200],
  "II/d": [3, 2591100, 33, 4125600],
  "III/a": [0, 2785700, 32, 4575200],
  "III/b": [0, 2903600, 32, 4768800],
  "III/c": [0, 3026400, 32, 4970500],
  "III/d": [0, 3154400, 32, 5180700],
  "IV/a": [0, 3287800, 32, 5399900],
  "IV/b": [0, 3426900, 32, 5628300],
  "IV/c": [0, 3571900, 32, 5866400],
  "IV/d": [0, 3723000, 32, 6114500],
  "IV/e": [0, 3880400, 32, 6373200],
};

test("tangga gaji memuat 17 golongan dan 272 anak tangga sesuai lampiran PP 5/2024", () => {
  const baris = tanggaGaji();
  assert.deepEqual(
    baris.map((b) => b.golongan),
    Object.keys(UJUNG_PP_5_2024),
  );
  assert.equal(baris.reduce((n, b) => n + b.anak.length, 0), 272);
  for (const b of baris) {
    const [mkgAwal, gajiAwal, mkgAkhir, gajiAkhir] = UJUNG_PP_5_2024[b.golongan];
    assert.deepEqual(b.anak[0], { mkg: mkgAwal, gaji: gajiAwal }, `${b.golongan} anak tangga pertama`);
    assert.deepEqual(b.anak.at(-1), { mkg: mkgAkhir, gaji: gajiAkhir }, `${b.golongan} anak tangga terakhir`);
    assert.ok(b.pangkat, `${b.golongan} punya nama pangkat`);
    b.anak.slice(1).forEach((a, i) => {
      assert.ok(a.mkg > b.anak[i].mkg, `${b.golongan} MKG menaik`);
      assert.ok(a.gaji > b.anak[i].gaji, `${b.golongan} gaji menaik di MKG ${a.mkg}`);
    });
  }
  assert.deepEqual(
    baris.find((b) => b.golongan === "II/a")?.anak.slice(0, 3).map((a) => a.mkg),
    [0, 1, 3],
    "II/a naik di MKG 1, lalu MKG ganjil",
  );
});
