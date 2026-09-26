// Pembacaan isian data pegawai dari formulir dan berkas import.
//
// Jalankan: node --import tsx --test lib/dataPegawai.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bacaGajiPokok,
  bacaIsianPegawai,
  bacaMkg,
  bacaTanggal,
  bacaUnitKerja,
  kgbBerjalanTerbaru,
  penundaanHukdisSelamaKgb,
} from "./dataPegawai";
import { SATKER_KANWIL } from "./satker";
import { bulanKeKgbBerikutnya, tambahBulan } from "./tabelGaji";
import { tanggalKalender } from "./waktu";

const utc = (tahun: number, bulan: number, hari: number) => new Date(Date.UTC(tahun, bulan - 1, hari));

function tanggalValid(nilai: unknown): Date {
  const hasil = bacaTanggal(nilai);
  assert.equal(hasil.status, "valid", `nilai ${String(nilai)}`);
  return (hasil as { tanggal: Date }).tanggal;
}

test("tanggal yyyy-mm-dd dan dd/mm/yyyy menjadi tengah malam UTC pada tanggal yang sama", () => {
  for (const nilai of ["2026-06-01", "2026-6-1", "01/06/2026", "1/6/2026", "01-06-2026", "01.06.2026", " 01/06/2026 "]) {
    assert.equal(tanggalValid(nilai).getTime(), utc(2026, 6, 1).getTime(), nilai);
  }
  // Tetap 1 Juni menurut WITA, apa pun zona proses.
  assert.equal(tanggalKalender(tanggalValid("01/06/2026"))!.getTime(), new Date(2026, 5, 1).getTime());
});

test("instan ISO dan Date dibaca sebagai tanggal kalender WITA", () => {
  assert.equal(tanggalValid("2026-05-31T16:00:00.000Z").getTime(), utc(2026, 6, 1).getTime());
  assert.equal(tanggalValid("2026-06-01T00:00:00Z").getTime(), utc(2026, 6, 1).getTime());
  assert.equal(tanggalValid(new Date(2026, 5, 1)).getTime(), utc(2026, 6, 1).getTime());
});

test("tanggal kosong dibedakan dari tanggal tidak valid atau ambigu", () => {
  for (const nilai of [null, undefined, "", "   "]) assert.deepEqual(bacaTanggal(nilai), { status: "kosong" });
  for (const nilai of ["31/02/2026", "06/15/2026", "01/06/26", "2026/06/01", "1 Juni 2026", "45000", 45000, "2026-13-01", new Date("x")]) {
    assert.deepEqual(bacaTanggal(nilai), { status: "tidak_valid" }, String(nilai));
  }
});

test("unit kerja kosong berarti Kanwil, nama satker diseragamkan, nama asing ditolak", () => {
  assert.equal(bacaUnitKerja(undefined).satker, SATKER_KANWIL);
  assert.equal(bacaUnitKerja("  ").satker, SATKER_KANWIL);
  assert.equal(bacaUnitKerja("rutan kls 2b rantau").satker?.nama, "Rumah Tahanan Negara Kelas IIB Rantau");
  assert.equal(bacaUnitKerja("lapas-kotabaru").satker?.nama, "Lembaga Pemasyarakatan Kelas IIA Kotabaru");
  assert.match(bacaUnitKerja("Lapas Kelas IIA Rantau").galat ?? "", /tidak ada dalam daftar satker/);
  assert.equal(bacaUnitKerja(12).galat, "Unit kerja tidak valid.");
});

test("masa kerja golongan dan gaji pokok", () => {
  assert.deepEqual(bacaMkg("", undefined), { mkgTahun: 0, mkgBulan: 0 });
  assert.deepEqual(bacaMkg("19", 1), { mkgTahun: 19, mkgBulan: 1 });
  assert.match(bacaMkg("2", "12").galat ?? "", /0 sampai 11/);
  assert.match(bacaMkg("2,5", "0").galat ?? "", /angka bulat/);

  assert.deepEqual(bacaGajiPokok("3838300", "III/b", 19, 1), { gajiPokok: 3838300 });
  assert.deepEqual(bacaGajiPokok("", "II/a", 0, 0), { gajiPokok: 2184000 });
  assert.match(bacaGajiPokok("3.838.300", "III/b", 19, 1).galat ?? "", /tanpa titik/);
});

const ISIAN_DASAR = {
  nip: '="199001012020121001"',
  nama: "PEGAWAI CONTOH",
  jabatan: "Penjaga Tahanan",
  pangkat: "",
  golonganRuang: "II/a",
  unitKerja: "",
  tmtGolongan: "01/03/2020",
  mkgTahun: "0",
  mkgBulan: "0",
  gajiPokok: "",
  tmtKgbTerakhir: "",
  tmtKgbBerikutnya: "2026-06-01",
};

test("bacaIsianPegawai menormalkan NIP, pangkat, unit kerja, dan tanggal", () => {
  const hasil = bacaIsianPegawai(ISIAN_DASAR, { denganNip: true });
  assert.equal(hasil.galat, undefined);
  const data = hasil.data!;
  assert.equal(data.nip, "199001012020121001");
  assert.equal(data.pangkat, "Pengatur Muda");
  assert.equal(data.unitKerja, SATKER_KANWIL.nama);
  assert.equal(data.tmtGolongan.getTime(), utc(2020, 3, 1).getTime());
  assert.equal(data.tmtKgbTerakhir, null);
  assert.equal(data.gajiPokok, 2184000);
});

test("bacaIsianPegawai menolak NIP, golongan, unit kerja, dan tanggal yang salah", () => {
  assert.match(bacaIsianPegawai({ ...ISIAN_DASAR, nip: "1.99001E+17" }, { denganNip: true }).galat ?? "", /18 digit/);
  assert.equal(bacaIsianPegawai({ ...ISIAN_DASAR, nip: "" }, { denganNip: false }).galat, undefined);
  assert.match(bacaIsianPegawai({ ...ISIAN_DASAR, golonganRuang: "II/e" }, { denganNip: true }).galat ?? "", /tidak dikenal/);
  assert.match(bacaIsianPegawai({ ...ISIAN_DASAR, unitKerja: "Kantor Pusat" }, { denganNip: true }).galat ?? "", /Kantor Pusat/);
  assert.match(
    bacaIsianPegawai({ ...ISIAN_DASAR, tmtKgbBerikutnya: "06/13/2026" }, { denganNip: true }).galat ?? "",
    /TMT KGB Berikutnya "06\/13\/2026" tidak valid/,
  );
  assert.match(bacaIsianPegawai({ ...ISIAN_DASAR, tmtGolongan: "" }, { denganNip: true }).galat ?? "", /TMT Golongan wajib/);
});

test("kgbBerjalanTerbaru hanya memilih status sedang diproses atau menunggu keuangan", () => {
  const daftar = [
    { id: "a", status: "selesai", createdAt: utc(2026, 1, 1) },
    { id: "b", status: "sedang_diproses", createdAt: utc(2026, 2, 1) },
    { id: "c", status: "menunggu_keuangan", createdAt: utc(2026, 3, 1) },
    { id: "d", status: "belum_diproses", createdAt: utc(2026, 4, 1) },
  ];
  assert.equal(kgbBerjalanTerbaru(daftar)?.id, "c");
  assert.equal(kgbBerjalanTerbaru(daftar.filter((k) => k.id !== "b" && k.id !== "c")), null);
});

test("penundaanHukdisSelamaKgb: pergeseran TMT berikutnya dihitung selama hukdis berdampak yang mulai sesudah TMT masih tercatat", () => {
  const tmt = new Date(2026, 5, 1);
  const langkah = bulanKeKgbBerikutnya("III/b", 20, 0);
  const kgb = {
    golonganBaru: "III/b",
    mkgTahunBaru: 20,
    mkgBulanBaru: 0,
    tmtKgbBaru: utc(2026, 6, 1),
    tmtKgbBerikutnya: tambahBulan(tmt, langkah + 12),
  };
  const sesudahTmt = { berdampakKGB: true, tmtMulai: utc(2026, 7, 1) };

  assert.equal(penundaanHukdisSelamaKgb({ kgb, riwayatHukdis: [sesudahTmt] }), 12);
  // TMT tersimpan sebagai tengah malam WITA (16.00 UTC hari sebelumnya).
  assert.equal(penundaanHukdisSelamaKgb({ kgb: { ...kgb, tmtKgbBaru: "2026-05-31T16:00:00Z" }, riwayatHukdis: [sesudahTmt] }), 12);
  // Hukdis sudah dihapus: pergeseran sisa tidak menahan pembatalan.
  assert.equal(penundaanHukdisSelamaKgb({ kgb, riwayatHukdis: [] }), 0);
  // Hukdis yang mulai pada TMT KGB atau tidak berdampak KGB tidak dihitung.
  assert.equal(
    penundaanHukdisSelamaKgb({
      kgb,
      riwayatHukdis: [
        { berdampakKGB: true, tmtMulai: utc(2026, 6, 1) },
        { berdampakKGB: false, tmtMulai: utc(2026, 7, 1) },
      ],
    }),
    0,
  );
  // Jadwal tanpa pergeseran, misalnya penundaan yang dicatat sebelum KGB diinput.
  assert.equal(penundaanHukdisSelamaKgb({ kgb: { ...kgb, tmtKgbBerikutnya: tambahBulan(tmt, langkah) }, riwayatHukdis: [sesudahTmt] }), 0);
  assert.equal(penundaanHukdisSelamaKgb({ kgb: { ...kgb, tmtKgbBerikutnya: null }, riwayatHukdis: [sesudahTmt] }), 0);
});

/** Isian yang lolos pemeriksaan; melempar bila ternyata bergalat, supaya pesannya terlihat di uji. */
function isianSah(hasil: ReturnType<typeof bacaIsianPegawai>) {
  if (hasil.galat !== undefined) throw new Error("tidak lolos: " + hasil.galat);
  return hasil.data;
}

test("TMT KGB berikutnya dihitung dari langkah tabel gaji bila dikosongkan", () => {
  // CPNS golongan II/a: langkah berikutnya di tabel PP 5/2024 ada pada masa kerja 1 tahun, jadi 12 bulan.
  const cpns = bacaIsianPegawai(
    { ...ISIAN_DASAR, golonganRuang: "II/a", mkgTahun: "0", mkgBulan: "0", tmtKgbTerakhir: "2025-06-01", tmtKgbBerikutnya: "" },
    { denganNip: true },
  );
  assert.equal(isianSah(cpns).tmtKgbBerikutnya.getFullYear(), 2026);
  assert.equal(isianSah(cpns).tmtKgbBerikutnya.getMonth(), 5);

  // Golongan lain memakai siklus dua tahun.
  const biasa = bacaIsianPegawai(
    { ...ISIAN_DASAR, golonganRuang: "III/b", mkgTahun: "10", mkgBulan: "0", tmtKgbTerakhir: "2024-03-01", tmtKgbBerikutnya: "" },
    { denganNip: true },
  );
  assert.equal(isianSah(biasa).tmtKgbBerikutnya.getFullYear(), 2026);
  assert.equal(isianSah(biasa).tmtKgbBerikutnya.getMonth(), 2);
});

test("TMT KGB berikutnya yang diisi tetap dipakai, misalnya karena penundaan hukdis", () => {
  const hasil = bacaIsianPegawai(
    { ...ISIAN_DASAR, golonganRuang: "II/a", mkgTahun: "0", mkgBulan: "0", tmtKgbTerakhir: "2025-06-01", tmtKgbBerikutnya: "2027-06-01" },
    { denganNip: true },
  );
  assert.equal(isianSah(hasil).tmtKgbBerikutnya.getFullYear(), 2027);
});

test("tanpa TMT KGB terakhir maupun berikutnya, galatnya menyebutkan jalan keluarnya", () => {
  const hasil = bacaIsianPegawai({ ...ISIAN_DASAR, tmtKgbTerakhir: "", tmtKgbBerikutnya: "" }, { denganNip: true });
  assert.match(hasil.galat ?? "", /isi TMT KGB Terakhir agar dihitungkan sistem/);
});

test("SK dasar KGB pertama ikut terbaca dan boleh kosong", () => {
  const terisi = isianSah(
    bacaIsianPegawai(
      { ...ISIAN_DASAR, nomorSkDasar: " SEC-12.KP.02.01 TAHUN 2015 ", tanggalSkDasar: "20/02/2015", penetapSkDasar: "Menteri Hukum dan HAM" },
      { denganNip: true },
    ),
  );
  assert.equal(terisi.nomorSkDasar, "SEC-12.KP.02.01 TAHUN 2015");
  assert.equal(terisi.tanggalSkDasar?.getTime(), Date.UTC(2015, 1, 20));
  assert.equal(terisi.penetapSkDasar, "Menteri Hukum dan HAM");

  const kosong = isianSah(bacaIsianPegawai(ISIAN_DASAR, { denganNip: true }));
  assert.equal(kosong.nomorSkDasar, null);
  assert.equal(kosong.tanggalSkDasar, null);

  assert.match(
    bacaIsianPegawai({ ...ISIAN_DASAR, tanggalSkDasar: "31/02/2015" }, { denganNip: true }).galat ?? "",
    /Tanggal SK Dasar/,
  );
});
