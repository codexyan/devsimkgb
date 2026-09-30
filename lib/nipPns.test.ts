import test from "node:test";
import assert from "node:assert/strict";
import { berakhirNolBeruntun, berbentukNotasiIlmiah, nipSah, periksaNip } from "./nipPns";

// Tahun acuan dipatok agar hasil ujinya tidak berubah seiring waktu.
const TAHUN = 2026;

test("NIP yang sah terbaca susunannya", () => {
  const hasil = periksaNip("197112051998031004", TAHUN);
  assert.ok(hasil.ok);
  assert.deepEqual(hasil.isi, {
    tanggalLahir: "1971-12-05",
    tmtCpns: "1998-03",
    jenisKelamin: "Laki-laki",
    urutan: 4,
  });
});

test("NIP perempuan dan nomor urut berakhir dua nol tetap sah", () => {
  // 900 adalah nomor urut yang mungkin; dua nol di ujung bukan tanda kerusakan.
  const hasil = periksaNip("199005202015032900", TAHUN);
  assert.ok(hasil.ok, hasil.ok ? "" : hasil.galat.pesan);
  assert.equal(hasil.isi.jenisKelamin, "Perempuan");
});

test("NIP yang dirusak Excel ditolak sebagai presisi yang hilang, bukan sekadar salah bentuk", () => {
  // Kejadian nyata: 197112051998031004 tersimpan menjadi angka pembulatan enam angka berarti.
  const hasil = periksaNip("197112000000000000", TAHUN);
  assert.ok(!hasil.ok);
  assert.equal(hasil.galat.kode, "presisiHilang");
  // Pesannya menyebut sebab yang mustahil, ciri Excel, dan jalan keluarnya.
  assert.match(hasil.galat.pesan, /bukan tanggal lahir yang ada/);
  assert.match(hasil.galat.pesan, /Excel/);
  assert.match(hasil.galat.pesan, /From Text\/CSV/);
});

test("pembulatan 15 angka berarti juga tertangkap", () => {
  // Excel menyimpan paling banyak 15 angka berarti; tiga digit terakhir menjadi nol.
  assert.ok(berakhirNolBeruntun("197112051998031000"));
  const hasil = periksaNip("197112051998031000", TAHUN);
  assert.ok(!hasil.ok);
  assert.equal(hasil.galat.kode, "presisiHilang");
});

test("notasi ilmiah yang telanjur tertulis di CSV dikenali sendiri", () => {
  assert.ok(berbentukNotasiIlmiah("1,97E+17"));
  assert.ok(berbentukNotasiIlmiah("1.99001E+17"));
  assert.ok(!berbentukNotasiIlmiah("197112051998031004"));
  const hasil = periksaNip("1,97E+17", TAHUN);
  assert.ok(!hasil.ok);
  assert.equal(hasil.galat.kode, "notasiIlmiah");
  assert.match(hasil.galat.pesan, /angka aslinya sudah hilang/);
});

test("bagian yang mustahil disebut, dan sisanya cukup dihitung", () => {
  // Bulan lahir 13, bulan TMT 00, jenis kelamin 7, nomor urut 001 (tidak berakhir nol beruntun).
  const hasil = periksaNip("197113052015007001", TAHUN);
  assert.ok(!hasil.ok);
  assert.equal(hasil.galat.kode, "struktur");
  assert.match(hasil.galat.pesan, /bukan tanggal lahir yang ada/);
  assert.match(hasil.galat.pesan, /bulan TMT CPNS "00" bukan bulan/);
  // Pesan tidak melebar: sebab ketiga dan seterusnya cukup dihitung agar terbaca di layar kecil.
  assert.match(hasil.galat.pesan, /dan 1 hal lain/);
});

test("satu sebab saja disebut utuh, tanpa penghitung", () => {
  // Hanya angka jenis kelaminnya yang salah; sisanya masuk akal.
  const hasil = periksaNip("197112051998037004", TAHUN);
  assert.ok(!hasil.ok);
  assert.match(hasil.galat.pesan, /angka jenis kelamin 7 harus 1 \(laki-laki\) atau 2 \(perempuan\)/);
  assert.doesNotMatch(hasil.galat.pesan, /hal lain/);
});

test("NIP terlalu pendek tidak dibebani petunjuk Excel yang tidak relevan", () => {
  const hasil = periksaNip("123", TAHUN);
  assert.ok(!hasil.ok);
  assert.match(hasil.galat.pesan, /Salin ulang NIP dari SK pegawai/);
  assert.doesNotMatch(hasil.galat.pesan, /From Text\/CSV/);
});

test("panjang yang salah dan isian kosong punya pesannya sendiri", () => {
  assert.equal(periksaNip("", TAHUN).ok, false);
  assert.equal((periksaNip("", TAHUN) as { galat: { kode: string } }).galat.kode, "kosong");
  const pendek = periksaNip("123", TAHUN);
  assert.ok(!pendek.ok);
  assert.equal(pendek.galat.kode, "bentuk");
  assert.match(pendek.galat.pesan, /18 digit angka/);
});

test("tahun di luar akal ditolak", () => {
  // Lahir 2025 lalu diangkat CPNS 2026: umurnya mustahil.
  assert.equal(nipSah("202501012026011001", TAHUN), false);
  // Tahun TMT melewati tahun berjalan lebih dari satu tahun.
  assert.equal(nipSah("199001012099011001", TAHUN), false);
});

test("NIP yang masih wajar di tepi batas tetap diterima", () => {
  // Diangkat CPNS pada tahun depan (SK sudah terbit lebih awal) masih diterima.
  assert.equal(nipSah("200001012027011001", TAHUN), true);
});
