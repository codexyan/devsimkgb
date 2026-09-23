// Usulan data pegawai dari UPT: perbandingan dengan data induk dan penerapannya.
//
// Jalankan: node --import tsx --test lib/usulanPegawai.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bandingkanUsulan,
  nilaiTampil,
  perubahanPegawai,
  ringkasHukdisUsulan,
  usulanKosong,
  hitungUsulan,
  kekuranganUsulan,
} from "./usulanPegawai";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

const pegawai = {
  nama: "Siti Nugroho",
  jabatan: "Penjaga Tahanan",
  golonganRuang: "II/a",
  mkgTahun: 0,
  mkgBulan: 0,
  gajiPokok: 2184000,
  tmtKgbTerakhir: tgl(2025, 6),
  tmtKgbBerikutnya: tgl(2026, 6),
};

test("hanya kolom yang diisi UPT dan memang berbeda yang muncul", () => {
  const perubahan = bandingkanUsulan(pegawai, {
    // Sama dengan data induk, jadi tidak dihitung sebagai perubahan.
    golonganRuang: "II/a",
    // Tidak diisi UPT.
    jabatan: null,
    // Berbeda.
    mkgTahun: 1,
    gajiPokok: 2218400,
  });
  assert.deepEqual(
    perubahan.map((p) => [p.kunci, p.sekarang, p.diusulkan]),
    [
      ["mkgTahun", "0", "1"],
      ["gajiPokok", "Rp2.184.000", "Rp2.218.400"],
    ],
  );
});

test("tanggal dibandingkan sebagai tanggal kalender, bukan sebagai teks", () => {
  // 1 Juni 2026 dapat tersimpan sebagai tengah malam UTC maupun WITA; keduanya bukan perubahan.
  for (const bentuk of ["2026-06-01T00:00:00Z", "2026-05-31T16:00:00Z"]) {
    assert.deepEqual(bandingkanUsulan(pegawai, { tmtKgbBerikutnya: bentuk as unknown as Date }), [], bentuk);
  }
  const geser = bandingkanUsulan(pegawai, { tmtKgbBerikutnya: tgl(2028, 6) });
  assert.deepEqual(geser.map((p) => [p.sekarang, p.diusulkan]), [["1 Juni 2026", "1 Juni 2028"]]);
});

test("nilai kosong ditampilkan sebagai tanda pisah", () => {
  assert.equal(nilaiTampil(null, "teks"), "—");
  assert.equal(nilaiTampil("", "tanggal"), "—");
  assert.equal(nilaiTampil(0, "angka"), "0");
  assert.equal(nilaiTampil(2184000, "rupiah"), "Rp2.184.000");
});

test("yang diterapkan hanya kolom yang diisi UPT; angka nol tetap nilai yang sah", () => {
  // Masa kerja golongan 0 tahun 0 bulan adalah keadaan sah (pegawai yang belum pernah KGB), jadi nol
  // tidak boleh diperlakukan sebagai kolom kosong. Yang kosong dikirim sebagai null oleh rute API.
  const terapkan = perubahanPegawai({ nama: "Siti Nugroho, S.H.", jabatan: null, mkgTahun: 0, mkgBulan: 0 });
  assert.deepEqual(terapkan, { nama: "Siti Nugroho, S.H.", mkgTahun: 0, mkgBulan: 0 });
  assert.equal("jabatan" in terapkan, false);
});

test("laporan hukuman disiplin diringkas, dan usulan tanpa isi dikenali", () => {
  assert.equal(ringkasHukdisUsulan({ hukdisAda: false }), null);
  assert.match(
    ringkasHukdisUsulan({ hukdisAda: true, hukdisJenis: "penundaan_kgb", hukdisTmtBerakhir: tgl(2027, 6) }) ?? "",
    /penundaan_kgb.*berakhir 1 Juni 2027/,
  );
  assert.equal(ringkasHukdisUsulan({ hukdisAda: true }), "dilaporkan tanpa rincian");

  assert.equal(usulanKosong(pegawai, { golonganRuang: "II/a", hukdisAda: false }), true);
  assert.equal(usulanKosong(pegawai, { golonganRuang: "II/b", hukdisAda: false }), false);
  // Laporan hukdis saja sudah perlu ditinjau Kanwil.
  assert.equal(usulanKosong(pegawai, { hukdisAda: true }), false);
});

test("hitungUsulan: CPNS II/a yang belum pernah KGB naik setahun, bukan dua tahun", () => {
  // Kasus Rutan Rantau: TMT CPNS 1 Juni 2025, golongan II/a, belum pernah KGB.
  const h = hitungUsulan({ golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbTerakhir: new Date(Date.UTC(2025, 5, 1)) });
  assert.equal(h.gajiPokok, 2184000);
  assert.equal(h.bulanKeBerikutnya, 12);
  assert.equal(h.tmtKgbBerikutnya?.getFullYear(), 2026);
  assert.equal(h.tmtKgbBerikutnya?.getMonth(), 5);
  assert.equal(h.pangkat, "Pengatur Muda");
  assert.deepEqual(h.peringatan, []);
});

test("hitungUsulan: keadaan sesudah KGB pertama memberi siklus dua tahunan", () => {
  const h = hitungUsulan({ golonganRuang: "II/a", mkgTahun: 1, mkgBulan: 0, tmtKgbTerakhir: new Date(Date.UTC(2026, 5, 1)) });
  assert.equal(h.gajiPokok, 2218400);
  assert.equal(h.bulanKeBerikutnya, 24);
  assert.equal(h.tmtKgbBerikutnya?.getFullYear(), 2028);
});

test("hitungUsulan: golongan di luar tabel dan kombinasi tanpa baris diberi peringatan", () => {
  const takDikenal = hitungUsulan({ golonganRuang: "V/a", mkgTahun: 0, mkgBulan: 0 });
  assert.equal(takDikenal.gajiPokok, 0);
  assert.match(takDikenal.peringatan[0], /tidak ada pada tabel gaji/);

  // II/c tidak pernah menjadi pangkat pengangkatan pertama, jadi tabelnya tidak punya baris MKG 0.
  const takBerbaris = hitungUsulan({ golonganRuang: "II/c", mkgTahun: 0, mkgBulan: 0, tmtKgbTerakhir: new Date(Date.UTC(2025, 0, 1)) });
  assert.equal(takBerbaris.gajiPokok, 0);
  assert.match(takBerbaris.peringatan[0], /tidak ada pada tabel PP 5\/2024/);
});

test("hitungUsulan: isian yang belum lengkap menerangkan apa yang kurang, bukan diam", () => {
  const tanpaGolongan = hitungUsulan({ mkgTahun: 3, mkgBulan: 0 });
  assert.match(tanpaGolongan.peringatan[0], /Golongan\/ruang belum diisi/);

  const tanpaTmt = hitungUsulan({ golonganRuang: "III/a", mkgTahun: 4, mkgBulan: 0 });
  assert.equal(tanpaTmt.tmtKgbBerikutnya, null);
  assert.match(tanpaTmt.peringatan[0], /TMT KGB terakhir belum diisi/);
});

test("hitungUsulan: angka dalam bentuk teks dari formulir tetap terbaca", () => {
  const h = hitungUsulan({ golonganRuang: "II/a", mkgTahun: "0", mkgBulan: "0", tmtKgbTerakhir: "2025-06-01" });
  assert.equal(h.gajiPokok, 2184000);
  assert.equal(h.tmtKgbBerikutnya?.getFullYear(), 2026);
});

test("kekuranganUsulan: draf pegawai baru yang lengkap boleh diajukan", () => {
  const siap = {
    nama: "NOORHIKMAH", nip: "198809042025062014", jabatan: "Penjaga Tahanan",
    golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbTerakhir: new Date(Date.UTC(2025, 5, 1)),
  };
  assert.deepEqual(kekuranganUsulan(siap, "baru"), []);
});

test("kekuranganUsulan: yang kurang disebut satu per satu, bukan sekadar ditolak", () => {
  const kurang = kekuranganUsulan({ nama: "", nip: "123", golonganRuang: "" }, "baru");
  assert.deepEqual(kurang, ["nama lengkap", "NIP 18 digit", "jabatan", "golongan/ruang", "TMT KGB terakhir"]);
});

test("kekuranganUsulan: usulan perbaikan boleh bersandar pada data pegawai yang sudah tercatat", () => {
  const pegawai = { golonganRuang: "III/b", mkgTahun: 10, mkgBulan: 0, tmtKgbTerakhir: new Date(Date.UTC(2024, 2, 1)) };
  assert.deepEqual(kekuranganUsulan({ jabatan: "Analis Kepegawaian" }, "perubahan", pegawai), []);
  // Masa kerja yang tidak ada barisnya di tabel ditahan di sini, sebelum uangnya salah.
  assert.deepEqual(kekuranganUsulan({ golonganRuang: "II/c", mkgTahun: 0, mkgBulan: 0 }, "perubahan", pegawai).length, 1);
});
