// Aturan pembatas cek status KGB publik.
//
// Jalankan: node --import tsx --test lib/pembatasCekKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { AturanPembatasCek, BATAS_GAGAL_IP, BATAS_GAGAL_NIP, BATAS_IP_PER_MENIT, pesanDitahan } from "./pembatasCekKgb";

const NIP = "198501012010011000";

test("per alamat IP dibatasi per menit, lalu pulih", () => {
  const a = new AturanPembatasCek();
  for (let i = 0; i < BATAS_IP_PER_MENIT; i++) assert.equal(a.periksa("1.1.1.1", NIP, 1000 + i).boleh, true);
  const ditahan = a.periksa("1.1.1.1", NIP, 2000);
  assert.equal(ditahan.boleh, false);
  assert.equal(ditahan.alasan, "ip");
  assert.equal(a.periksa("2.2.2.2", NIP, 2000).boleh, true);
  assert.equal(a.periksa("1.1.1.1", NIP, 1000 + 61_000).boleh, true);
});

test("terlalu banyak gagal dari satu alamat menahan alamat itu 10 menit", () => {
  const a = new AturanPembatasCek();
  for (let i = 0; i < BATAS_GAGAL_IP; i++) a.catatGagal("1.1.1.1", `19990101202001100${i}`, 1000);
  const h = a.periksa("1.1.1.1", NIP, 2000);
  assert.equal(h.alasan, "gagal-ip");
  assert.ok(h.tunggu > 590 && h.tunggu <= 600);
  assert.equal(a.periksa("1.1.1.1", NIP, 1000 + 10 * 60_000).boleh, true);
});

test("lima kali tempat lahir salah untuk satu NIP menahan NIP itu dari alamat mana pun", () => {
  const a = new AturanPembatasCek();
  for (let i = 0; i < BATAS_GAGAL_NIP; i++) a.catatGagal(`10.0.0.${i}`, NIP, 1000);
  const h = a.periksa("9.9.9.9", NIP, 2000);
  assert.equal(h.alasan, "gagal-nip");
  assert.match(pesanDitahan(h), /NIP ini/);
  assert.equal(a.periksa("9.9.9.9", "199901012020011001", 2000).boleh, true);
});
