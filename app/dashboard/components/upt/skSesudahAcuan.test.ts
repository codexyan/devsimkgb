// Formulir UPT: SK sesudah SK KGB terakhir dipisahkan dari keadaan pada SK acuan (ADR-078).
//
// Jalankan: node --import tsx --test app/dashboard/components/upt/skSesudahAcuan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { hitungFormulirUsulan, isianUntukDisimpan, jawabSkBaru, pisahkanIsianSk } from "./skSesudahAcuan";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

// Contoh skema Admin UPT: KGB terakhir 1 Des 2024 di II/b 7 tahun; PI TMT 1 Feb 2026 ke III/a, di SK 3 tahun 2 bulan.
const tercatat = {
  golonganRuang: "II/b", mkgTahun: "7", mkgBulan: "0", tmtKgbTerakhir: "2024-12-01", tmtKgbBerikutnya: "2026-12-01", tmtGolongan: "2022-04-01",
};
const sk = { jenis: "kp", jenisKp: "penyesuaian_ijazah", nomorSk: "SK-PI-1", tanggalSk: "2026-01-29", tmt: "2026-02-01", penetap: "Sekjen" };

test("pratinjau formulir: kenaikan pangkat yang dilaporkan dihitung seperti persetujuan Kanwil, KGB berikutnya 1 Des 2026", () => {
  const h = hitungFormulirUsulan(
    { golonganRuang: "II/b", mkgTahun: "7", mkgBulan: "0", tmtKgbTerakhir: "2024-12-01" },
    { ...sk, golongan: "III/a", mkgTahun: "3", mkgBulan: "2" },
    tercatat.tmtKgbBerikutnya,
  );
  assert.deepEqual(h.acuan.tmtKgbBerikutnya, tgl(2026, 12), "menurut SK KGB terakhir");
  assert.ok(h.sesudahSk?.ok);
  assert.equal(h.sesudahSk.golongan, "III/a");
  assert.deepEqual(h.sesudahSk.mkg, { tahun: 2, bulan: 0 });
  assert.deepEqual(h.sesudahSk.tmtKgbBerikutnya, tgl(2026, 12), "dulu tampil 1 Des 2025: golongan baru dengan masa kerja lama");
  assert.equal(h.sesudahSk.cocok?.cocok, true);
  assert.match(h.sesudahSk.penjelasan, /dipotong 5 tahun/);

  // Masa kerja SK KGB lama yang tersalin ke bagian SK terdeteksi.
  const salah = hitungFormulirUsulan(
    { golonganRuang: "II/b", mkgTahun: "7", mkgBulan: "0", tmtKgbTerakhir: "2024-12-01" },
    { ...sk, golongan: "III/a", mkgTahun: "7", mkgBulan: "0" },
  );
  assert.ok(salah.sesudahSk?.ok);
  assert.equal(salah.sesudahSk.cocok?.cocok, false);

  // Belum cukup diisi: belum dihitung; golongan acuan kosong: diminta diisi.
  assert.equal(hitungFormulirUsulan({ golonganRuang: "II/b", mkgTahun: "7", mkgBulan: "0", tmtKgbTerakhir: "2024-12-01" }, { ...sk, golongan: "" }).sesudahSk, null);
  const tanpaAcuan = hitungFormulirUsulan({ golonganRuang: "", mkgTahun: "", mkgBulan: "", tmtKgbTerakhir: "2024-12-01" }, { ...sk, golongan: "III/a" });
  assert.equal(tanpaAcuan.sesudahSk?.ok, false);
});

test("menjawab Tidak ada lalu Ada lagi tidak menghapus isian SK", () => {
  const isi = { ...sk, jenis: "pmk", golongan: "", mkgTahun: "5", mkgBulan: "9" };
  const tidak = jawabSkBaru(isi, false);
  assert.equal(tidak.jenis, "tidak");
  assert.equal(tidak.nomorSk, "SK-PI-1");
  assert.equal(tidak.mkgTahun, "5");
  const ada = jawabSkBaru(tidak, true);
  assert.equal(ada.jenis, "pmk", "jenis terakhir dipulihkan");
  assert.equal(ada.tmt, "2026-02-01");
  assert.equal(jawabSkBaru({ ...sk, jenis: "" }, true).jenis, "kp", "bawaannya kenaikan pangkat");
  assert.equal(jawabSkBaru({ ...sk, jenis: "koreksi" }, false).jenis, "koreksi");
});

test("isian yang disimpan: golongan dan masa kerja menurut SK di isian utama, keadaan SK KGB terakhir sebagai acuan", () => {
  const atas = { ...tercatat, nama: "X" };
  const kp = isianUntukDisimpan(atas, { jenis: "kp", golongan: "III/a", mkgTahun: "3", mkgBulan: "2" });
  assert.equal(kp.nilai.golonganRuang, "III/a");
  assert.equal(kp.nilai.mkgTahun, "3");
  assert.deepEqual(kp.acuan, { golonganAcuan: "II/b", mkgTahunAcuan: "7", mkgBulanAcuan: "0" });
  const pmk = isianUntukDisimpan(atas, { jenis: "pmk", golongan: "", mkgTahun: "9", mkgBulan: "4" });
  assert.equal(pmk.nilai.golonganRuang, "II/b", "PMK tidak mengubah golongan");
  assert.equal(pmk.nilai.mkgTahun, "9");
  const tidak = isianUntukDisimpan(atas, { jenis: "tidak", golongan: "III/a", mkgTahun: "3", mkgBulan: "2" });
  assert.equal(tidak.nilai.golonganRuang, "II/b", "isian SK yang tersisa di formulir tidak ikut tersimpan");
  assert.equal(tidak.acuan.golonganAcuan, "");
});

test("draf dipisahkan kembali saat dibuka: ber-acuan, draf lama pegawai tercatat, dan draf lama pegawai baru", () => {
  // Draf baru: isian utama adalah SK yang dilaporkan, acuan adalah keadaan pada SK KGB terakhir.
  const nilai = { ...tercatat, golonganRuang: "III/a", mkgTahun: "3", mkgBulan: "2" };
  const baru = pisahkanIsianSk({ nilai, jenisSk: "kp", acuan: { golongan: "II/b", mkgTahun: "7", mkgBulan: "0" }, tercatat: null });
  assert.equal(baru.atas.golonganRuang, "II/b");
  assert.equal(baru.atas.mkgTahun, "7");
  assert.deepEqual(baru.sk, { golongan: "III/a", mkgTahun: "3", mkgBulan: "2" });

  // Draf lama pegawai tercatat: golongan baru tersalin di isian utama, masa kerjanya tetap data tercatat.
  const lama = pisahkanIsianSk({ nilai: { ...tercatat, golonganRuang: "III/a" }, jenisSk: "kp", acuan: null, tercatat });
  assert.equal(lama.atas.golonganRuang, "II/b", "bagian atas kembali ke data tercatat");
  assert.deepEqual(lama.sk, { golongan: "III/a", mkgTahun: "", mkgBulan: "" }, "masa kerja menurut SK belum pernah diisi");

  // Draf lama pegawai baru: keadaan pada SK KGB terakhir tidak diketahui, jadi dikosongkan untuk diisi.
  const lamaBaru = pisahkanIsianSk({ nilai, jenisSk: "kp", acuan: null, tercatat: null });
  assert.equal(lamaBaru.atas.golonganRuang, "");
  assert.equal(lamaBaru.atas.mkgTahun, "");
  assert.deepEqual(lamaBaru.sk, { golongan: "III/a", mkgTahun: "3", mkgBulan: "2" });

  // Tanpa SK: apa adanya.
  assert.deepEqual(pisahkanIsianSk({ nilai: tercatat, jenisSk: "tidak", acuan: null, tercatat }).atas, tercatat);
});
