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
