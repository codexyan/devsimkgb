// Pemeriksaan sesi terhadap data pengguna dan pembatas percobaan login.
//
// Jalankan: node --import tsx --test lib/auth/sesiPengguna.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { buatPemeriksaSesi, sidikSandi } from "./sesiPengguna";
import { buatPembatasPercobaan } from "./pembatasPercobaan";

const HASH_LAMA = "$2a$12$hashlamahashlamahashlamahashlamahashlamahashlamahashl";
const HASH_BARU = "$2a$12$hashbaruhashbaruhashbaruhashbaruhashbaruhashbaruhashb";

function siapkan() {
  let kini = 1_000_000;
  let jumlahPemuatan = 0;
  const pengguna = new Map<string, string>([["u1", HASH_LAMA]]);
  let gagal = false;
  let tertahan = false;
  const pemeriksa = buatPemeriksaSesi({
    muatSemuaPengguna: async () => {
      jumlahPemuatan++;
      if (tertahan) return new Promise<never>(() => {});
      if (gagal) throw new Error("kuota habis");
      return Array.from(pengguna, ([id, password]) => ({ id, password }));
    },
    masaSimpanMs: 60_000,
    masaSimpanGalatMs: 15_000,
    batasWaktuMs: 20,
    jedaMuatUlangMs: 5_000,
    sekarang: () => kini,
  });
  return {
    pemeriksa,
    pengguna,
    majukan: (ms: number) => {
      kini += ms;
    },
    setGagal: (nilai: boolean) => {
      gagal = nilai;
    },
    setTertahan: (nilai: boolean) => {
      tertahan = nilai;
    },
    jumlahPemuatan: () => jumlahPemuatan,
  };
}

test("sidikSandi: 16 karakter heksadesimal, berbeda untuk hash berbeda", async () => {
  const sidik = await sidikSandi(HASH_LAMA);
  assert.match(sidik, /^[0-9a-f]{16}$/);
  assert.equal(await sidikSandi(HASH_LAMA), sidik);
  assert.notEqual(await sidikSandi(HASH_BARU), sidik);
});

test("sesiBerlaku: satu pemuatan daftar dipakai semua pengguna selama masa simpan", async () => {
  const s = siapkan();
  s.pengguna.set("u2", HASH_BARU);
  const token = { id: "u1", sidikSandi: await sidikSandi(HASH_LAMA) };
  const [a, b] = await Promise.all([s.pemeriksa.sesiBerlaku(token), s.pemeriksa.sesiBerlaku(token)]);
  assert.equal(a && b, true);
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "u2", sidikSandi: await sidikSandi(HASH_BARU) }), true);
  assert.equal(s.jumlahPemuatan(), 1);
  s.majukan(60_000);
  assert.equal(await s.pemeriksa.sesiBerlaku(token), true);
  assert.equal(s.jumlahPemuatan(), 2);
});

test("sesiBerlaku: akun dihapus atau password diatur ulang mengakhiri sesi", async () => {
  const s = siapkan();
  const token = { id: "u1", sidikSandi: await sidikSandi(HASH_LAMA) };
  assert.equal(await s.pemeriksa.sesiBerlaku(token), true);

  s.pengguna.set("u1", HASH_BARU);
  // Dalam masa simpan daftar lama masih dipakai, kecuali dilupakan.
  assert.equal(await s.pemeriksa.sesiBerlaku(token), true);
  s.pemeriksa.lupakan();
  assert.equal(await s.pemeriksa.sesiBerlaku(token), false);

  s.pengguna.delete("u1");
  s.majukan(60_000);
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "u1" }), false);
  assert.equal(await s.pemeriksa.sesiBerlaku({}), false);
});

test("sesiBerlaku: token lama tanpa sidik hanya diperiksa keberadaan penggunanya", async () => {
  const s = siapkan();
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "u1" }), true);
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "tidak-ada" }), false);
});

test("sesiBerlaku: token yang tidak cocok memuat ulang daftar yang cukup tua sekali saja", async () => {
  const s = siapkan();
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "u1" }), true);
  // Pengguna baru dibuat sesudah daftar dimuat, lalu masuk.
  s.pengguna.set("u3", HASH_BARU);
  const tokenBaru = { id: "u3", sidikSandi: await sidikSandi(HASH_BARU) };
  assert.equal(await s.pemeriksa.sesiBerlaku(tokenBaru), false);
  assert.equal(s.jumlahPemuatan(), 1);
  s.majukan(5_000);
  assert.equal(await s.pemeriksa.sesiBerlaku(tokenBaru), true);
  assert.equal(s.jumlahPemuatan(), 2);
  // Token akun yang sudah dihapus tidak memuat ulang lagi selama daftar masih baru.
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "dihapus" }), false);
  assert.equal(s.jumlahPemuatan(), 2);
});

test("sesiBerlaku: pemuatan yang gagal tidak mengakhiri sesi dan tidak langsung diulang", async () => {
  const s = siapkan();
  s.setGagal(true);
  const token = { id: "u1", sidikSandi: "0000000000000000" };
  assert.equal(await s.pemeriksa.sesiBerlaku(token), true);
  assert.equal(await s.pemeriksa.sesiBerlaku(token), true);
  assert.equal(s.jumlahPemuatan(), 1);
  s.setGagal(false);
  s.majukan(15_000);
  assert.equal(await s.pemeriksa.sesiBerlaku(token), false);
  assert.equal(s.jumlahPemuatan(), 2);
});

test("sesiBerlaku: pemuatan yang melewati batas waktu tidak menahan permintaan", async () => {
  const s = siapkan();
  s.setTertahan(true);
  const mulai = Date.now();
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "u1", sidikSandi: "0000000000000000" }), true);
  assert.ok(Date.now() - mulai < 1_000);
  // Hasil gagal disimpan: permintaan berikutnya tidak menunggu lagi.
  assert.equal(await s.pemeriksa.sesiBerlaku({ id: "u1" }), true);
  assert.equal(s.jumlahPemuatan(), 1);
});

test("buatPembatasPercobaan: terkunci setelah batas kegagalan sampai jendela lewat", () => {
  let kini = 0;
  const pembatas = buatPembatasPercobaan({ batas: 3, jendelaMs: 1000, sekarang: () => kini });
  for (let i = 0; i < 2; i++) pembatas.catatGagal("nip|ip");
  assert.equal(pembatas.terkunci("nip|ip"), false);
  pembatas.catatGagal("nip|ip");
  assert.equal(pembatas.terkunci("nip|ip"), true);
  assert.equal(pembatas.terkunci("nip-lain|ip"), false);
  kini = 1000;
  assert.equal(pembatas.terkunci("nip|ip"), false);
  pembatas.catatGagal("nip|ip");
  assert.equal(pembatas.terkunci("nip|ip"), false);
  pembatas.catatGagal("nip|ip");
  pembatas.catatGagal("nip|ip");
  assert.equal(pembatas.terkunci("nip|ip"), true);
  pembatas.hapus("nip|ip");
  assert.equal(pembatas.terkunci("nip|ip"), false);
});

test("buatPembatasPercobaan: kapasitas penuh membuang kunci yang jendelanya sudah lewat", () => {
  let kini = 0;
  const pembatas = buatPembatasPercobaan({ batas: 1, jendelaMs: 1000, sekarang: () => kini, kapasitas: 2 });
  pembatas.catatGagal("a");
  kini = 500;
  pembatas.catatGagal("b");
  kini = 1200;
  pembatas.catatGagal("c");
  assert.equal(pembatas.terkunci("b"), true);
  assert.equal(pembatas.terkunci("c"), true);
});
