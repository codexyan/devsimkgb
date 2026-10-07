// Nilai dasar gaji menurut SK pada usulan UPT: yang ditampilkan ke peninjau sama dengan yang diterapkan.
//
// Jalankan: node --import tsx --test lib/dasarSkUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catatanSkDilaporkan,
  cocokMkgSk,
  hitungDasarSkUsulan,
  hitungSkDilaporkan,
  hitungSkPegawaiBaru,
  mkgPadaSkTercatat,
  usulanBaruMenurutSk,
  usulanMenurutSk,
} from "./dasarSkUsulan";
import { getGajiPokok } from "./tabelGaji";
import { bandingkanUsulan, perubahanPegawai } from "./usulanPegawai";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

// Arif Setiawan di data video: II/d, 9 tahun, KGB terakhir 1 Agustus 2025, berikutnya 1 Agustus 2027.
const arif = {
  golonganRuang: "II/d", pangkat: "Pengatur Tingkat I", mkgTahun: 9, mkgBulan: 0, gajiPokok: 2843700,
  tmtKgbTerakhir: tgl(2025, 8), tmtKgbBerikutnya: tgl(2027, 8),
} as PegawaiRow;

// Usulan kenaikan pangkat ke III/a dengan angka mentah seperti yang tersimpan dari kartu UPT: gaji pokok
// tanpa potongan masa kerja, dan jadwal KGB yang bergeser.
const usulanKp = {
  golonganRuang: "III/a", pangkat: "Penata Muda", gajiPokok: 3153600, tmtKgbBerikutnya: tgl(2026, 8),
  dasarBaruJenis: "kp", dasarBaruTanggalSk: tgl(2026, 9, 25), dasarBaruTmt: tgl(2026, 10),
} as unknown as UsulanPegawaiRow;

test("kenaikan pangkat: peninjau melihat potongan masa kerja dan jadwal KGB yang tetap", () => {
  const perubahan = bandingkanUsulan(arif, usulanMenurutSk(arif, usulanKp, perubahanPegawai(usulanKp)));
  const peta = Object.fromEntries(perubahan.map((p) => [p.kunci, `${p.sekarang} → ${p.diusulkan}`]));
  assert.equal(peta.golonganRuang, "II/d → III/a");
  assert.equal(peta.mkgTahun, "9 → 4");
  assert.equal(peta.gajiPokok, "Rp2.843.700 → Rp2.964.000");
  assert.equal(peta.tmtKgbBerikutnya, undefined, "kenaikan pangkat tidak menggeser jadwal KGB");
});

test("angka mentah usulan tidak lagi tampil, tetapi tetap tampil tanpa SK", () => {
  const mentah = bandingkanUsulan(arif, usulanKp);
  assert.ok(mentah.some((p) => p.diusulkan === "Rp3.153.600"));
  const tanpaSk = { ...usulanKp, dasarBaruJenis: "koreksi" } as UsulanPegawaiRow;
  assert.equal(usulanMenurutSk(arif, tanpaSk, perubahanPegawai(tanpaSk)), tanpaSk);
});

test("SK yang tidak dapat dihitung dilaporkan, dan usulannya tampil apa adanya", () => {
  const turun = { ...usulanKp, golonganRuang: "II/a" } as UsulanPegawaiRow;
  const h = hitungDasarSkUsulan(arif, turun, perubahanPegawai(turun));
  assert.equal(h.berlaku && !h.ok, true);
  assert.equal(usulanMenurutSk(arif, turun, perubahanPegawai(turun)), turun);
});

// Pegawai baru yang menyalin golongan dan masa kerja dari SK sesudah SK KGB terakhir (ADR-065). Contoh yang sama
// dengan pilihan di tinjauan logika: KGB terakhir 1 Des 2024 di II/d 11 tahun, PI 1 Jan 2026 ke III/a, di SK 7 tahun 1 bulan.
const baruPi = {
  golonganRuang: "III/a", mkgTahun: 7, mkgBulan: 1, tmtKgbTerakhir: tgl(2024, 12),
  dasarBaruJenis: "kp", dasarBaruTmt: tgl(2026, 1),
} as unknown as UsulanPegawaiRow;

test("pegawai baru, penyesuaian ijazah: masa kerja pada SK dihitung mundur ke TMT KGB terakhir, jadwal KGB tetap", () => {
  const sk = hitungSkPegawaiBaru(baruPi);
  assert.ok(sk.berlaku && sk.ok);
  assert.deepEqual(sk.mkgPadaSk, { tahun: 7, bulan: 1 });
  assert.equal(sk.nilai.mkgTahun, 6);
  assert.equal(sk.nilai.mkgBulan, 0);
  assert.equal(sk.nilai.gajiPokok, getGajiPokok("III/a", 6, 0));
  assert.deepEqual(sk.nilai.tmtKgbBerikutnya, tgl(2026, 12));
  // Usulan sebagaimana diterapkan: masa kerja yang tersimpan di data pegawai adalah yang pada TMT KGB terakhir.
  assert.equal(usulanBaruMenurutSk(baruPi).mkgTahun, 6);
});

test("pegawai baru, PMK: gaji pokok menurut masa kerja pada SK, jadwal KGB tetap pada siklusnya (ADR-080)", () => {
  // KGB terakhir 1 Jun 2025 di III/a 2 tahun; PMK 1 Mar 2026 menjadi 5 tahun 9 bulan.
  const sk = hitungSkPegawaiBaru({
    golonganRuang: "III/a", mkgTahun: 5, mkgBulan: 9, tmtKgbTerakhir: tgl(2025, 6), dasarBaruJenis: "pmk", dasarBaruTmt: tgl(2026, 3),
  });
  assert.ok(sk.berlaku && sk.ok);
  assert.equal(sk.nilai.mkgTahun, 5);
  assert.equal(sk.nilai.mkgBulan, 0);
  assert.equal(sk.nilai.gajiPokok, getGajiPokok("III/a", 5, 9));
  // PMK tidak menggeser periode: 24 bulan sesudah KGB terakhir.
  assert.deepEqual(sk.nilai.tmtKgbBerikutnya, tgl(2027, 6));
});

test("pegawai baru: tanpa SK, atau SK yang mendahului KGB terakhir, atau masa kerja yang terlalu kecil", () => {
  assert.equal(hitungSkPegawaiBaru({ ...baruPi, dasarBaruJenis: "tidak" }).berlaku, false);
  assert.equal(hitungSkPegawaiBaru({ ...baruPi, dasarBaruJenis: "koreksi" }).berlaku, false);
  const dulu = hitungSkPegawaiBaru({ ...baruPi, dasarBaruTmt: tgl(2024, 6) });
  assert.ok(dulu.berlaku && !dulu.ok);
  assert.match(dulu.pesan, /sesudah TMT KGB terakhir/);
  const kecil = hitungSkPegawaiBaru({ ...baruPi, mkgTahun: 0, mkgBulan: 6 });
  assert.ok(kecil.berlaku && !kecil.ok);
  assert.match(kecil.pesan, /paling sedikit 1 tahun 1 bulan/);
});

// ADR-078: formulir memisahkan keadaan pada SK KGB terakhir dari SK sesudahnya. Contoh dari skema Admin UPT: KGB terakhir
// 1 Des 2024 di II/b masa kerja 7 tahun; kenaikan pangkat (PI) TMT 1 Feb 2026 ke III/a, di SK 3 tahun 2 bulan.
const hafizaLama = {
  golonganRuang: "II/b", mkgTahun: 7, mkgBulan: 0, tmtKgbTerakhir: tgl(2024, 12), tmtKgbBerikutnya: tgl(2026, 12),
} as PegawaiRow;

test("kenaikan pangkat II ke III: masa kerja dipotong 5 tahun, KGB berikutnya tetap 1 Des 2026, bukan 2025", () => {
  const h = hitungSkDilaporkan(hafizaLama, { jenis: "kp", golonganBaru: "III/a", mkgTahunSk: 3, mkgBulanSk: 2, tmt: tgl(2026, 2) });
  assert.ok(h.ok);
  assert.equal(h.golonganRuang, "III/a");
  assert.deepEqual([h.mkgTahun, h.mkgBulan], [2, 0], "masa kerja pada TMT KGB terakhir");
  assert.deepEqual(h.mkgPadaTmtSk, { tahun: 3, bulan: 2 }, "masa kerja pada TMT SK sama dengan yang tertulis di SK");
  assert.equal(h.gajiPokok, getGajiPokok("III/a", 3, 2));
  assert.deepEqual(h.tmtKgbBerikutnya, tgl(2026, 12));
  assert.deepEqual(cocokMkgSk(h.mkgPadaTmtSk, { tahun: 3, bulan: 2 })?.cocok, true);
  assert.deepEqual(cocokMkgSk(h.mkgPadaTmtSk, { tahun: 7, bulan: 0 })?.cocok, false, "masa kerja SK KGB lama yang tersalin terdeteksi");
  assert.equal(cocokMkgSk(h.mkgPadaTmtSk, { tahun: null, bulan: null }), null, "belum diisi: tidak dicocokkan");
});

test("usulan pegawai tercatat ber-acuan: masa kerja menurut SK tidak ikut hitungan dan dicocokkan untuk Kanwil", () => {
  const usulan = {
    jenis: "perubahan", status: "menunggu", golonganRuang: "III/a", mkgTahun: 3, mkgBulan: 2,
    golonganAcuan: "II/b", mkgTahunAcuan: 7, mkgBulanAcuan: 0,
    dasarBaruJenis: "kp", dasarBaruTanggalSk: tgl(2026, 1, 29), dasarBaruTmt: tgl(2026, 2),
  } as unknown as UsulanPegawaiRow;
  const sk = hitungDasarSkUsulan(hafizaLama, usulan, perubahanPegawai(usulan));
  assert.ok(sk.berlaku && sk.ok);
  assert.equal(sk.nilai.mkgTahun, 2);
  assert.deepEqual(sk.nilai.tmtKgbBerikutnya, tgl(2026, 12));
  assert.match(catatanSkDilaporkan(usulan, hafizaLama) ?? "", /3 tahun 2 bulan, sesuai hitungan sistem/);
  const keliru = { ...usulan, mkgTahun: 7, mkgBulan: 0 } as UsulanPegawaiRow;
  assert.match(catatanSkDilaporkan(keliru, hafizaLama) ?? "", /Perhatian: .*7 tahun 0 bulan, sedangkan hitungan sistem 3 tahun 2 bulan/);
  // Usulan lama (tanpa acuan) tidak memuat masa kerja menurut SK, jadi tidak dicocokkan.
  assert.equal(catatanSkDilaporkan({ ...usulan, golonganAcuan: null } as UsulanPegawaiRow, hafizaLama), null);
});

test("pegawai baru ber-acuan: dihitung dari SK KGB terakhir seperti pegawai tercatat, bukan dihitung mundur", () => {
  const baru = {
    jenis: "baru", golonganRuang: "III/a", mkgTahun: 3, mkgBulan: 2, tmtKgbTerakhir: tgl(2024, 12),
    golonganAcuan: "II/b", mkgTahunAcuan: 7, mkgBulanAcuan: 0,
    dasarBaruJenis: "kp", dasarBaruTanggalSk: tgl(2026, 1, 29), dasarBaruTmt: tgl(2026, 2),
  } as unknown as UsulanPegawaiRow;
  const sk = hitungSkPegawaiBaru(baru);
  assert.ok(sk.berlaku && sk.ok);
  assert.deepEqual([sk.nilai.mkgTahun, sk.nilai.mkgBulan], [2, 0]);
  assert.deepEqual(sk.nilai.tmtKgbBerikutnya, tgl(2026, 12));
  assert.equal(sk.nilai.gajiPokok, getGajiPokok("III/a", 2, 0));
  assert.equal(sk.acuan?.golongan, "II/b");
  assert.deepEqual(sk.acuan?.mkgHitunganPadaSk, { tahun: 3, bulan: 2 });
  assert.match(catatanSkDilaporkan(baru, null) ?? "", /Pada SK KGB terakhir: II\/b, 7 tahun 0 bulan\. .*sesuai hitungan sistem/);
  // Masa kerja pada SK KGB terakhir yang belum diisi ditagih, bukan dibaca nol tahun.
  const kosong = hitungSkPegawaiBaru({ ...baru, mkgTahunAcuan: null });
  assert.ok(kosong.berlaku && !kosong.ok);
  assert.match(kosong.pesan, /masa kerja golongan pada SK KGB terakhir/);
  // Golongan baru yang tidak lebih tinggi ditolak dengan menyebut isiannya.
  const turun = hitungSkPegawaiBaru({ ...baru, golonganRuang: "II/a" });
  assert.ok(turun.berlaku && !turun.ok);
  assert.match(turun.pesan, /golongan baru menurut SK kenaikan pangkat/);
});

test("pegawai baru ber-acuan, PMK: masa kerja menurut SK menjadi dasar, jadwal tetap pada siklusnya (ADR-080)", () => {
  // KGB terakhir 1 Jun 2025 di III/a 2 tahun; PMK 1 Mar 2026 menjadi 5 tahun 9 bulan (contoh yang sama dengan uji lama).
  const sk = hitungSkPegawaiBaru({
    golonganRuang: "III/a", mkgTahun: 5, mkgBulan: 9, tmtKgbTerakhir: tgl(2025, 6),
    golonganAcuan: "III/a", mkgTahunAcuan: 2, mkgBulanAcuan: 0, dasarBaruJenis: "pmk", dasarBaruTmt: tgl(2026, 3),
  });
  assert.ok(sk.berlaku && sk.ok);
  assert.equal(sk.nilai.gajiPokok, getGajiPokok("III/a", 5, 9));
  assert.deepEqual(sk.nilai.tmtKgbBerikutnya, tgl(2027, 6));
  assert.equal(sk.acuan?.pmk?.tambahBulan, 69 - 33, "tambahan = 5 thn 9 bln dikurangi (2 thn + 9 bln selang)");
});

test("masa kerja menurut SK yang tercatat sesudah KGB terakhir ditampilkan di samping masa kerja tercatat", () => {
  const m = mkgPadaSkTercatat({ mkgTahun: 2, mkgBulan: 0, tmtKgbTerakhir: tgl(2024, 12) }, { jenis: "kp", tmt: tgl(2026, 2) });
  assert.deepEqual(m?.mkg, { tahun: 3, bulan: 2 });
  assert.equal(m?.jenis, "kp");
  assert.equal(mkgPadaSkTercatat({ mkgTahun: 2, mkgBulan: 0, tmtKgbTerakhir: tgl(2024, 12) }, { jenis: "kgb", tmt: tgl(2024, 12) }), null);
  assert.equal(mkgPadaSkTercatat({ mkgTahun: 2, mkgBulan: 0, tmtKgbTerakhir: tgl(2026, 12) }, { jenis: "kp", tmt: tgl(2026, 2) }), null, "SK sebelum KGB terakhir");
});
