// Matriks hak akses per peran dan pemakaian guard yang tepat di halaman serta API.
//
// Jalankan: node --import tsx --test lib/auth/roles.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ROLES,
  canAccessKeuangan,
  canEditPegawai,
  canKonfirmasiKeuangan,
  canManageHukdis,
  canProcessKGB,
  canViewKGB,
  isSuperAdmin,
} from "./roles";
import { PERAN_KGB } from "../authGuard";

const { SUPER_ADMIN: SA, SDM_KGB: KGB, SDM_HUKDIS: HUKDIS, KEUANGAN: KEU } = ROLES;

test("matriks hak akses empat peran", () => {
  const matriks: [string, (role: string) => boolean, string[]][] = [
    ["proses KGB", canProcessKGB, [SA, KGB]],
    ["baca data KGB", canViewKGB, [SA, KGB, KEU]],
    ["ubah data pegawai", canEditPegawai, [SA, KGB]],
    ["kelola hukdis", canManageHukdis, [SA, HUKDIS]],
    ["lihat halaman keuangan", canAccessKeuangan, [SA, KEU]],
    ["konfirmasi keuangan dan follow up", canKonfirmasiKeuangan, [KEU]],
    ["fitur admin", isSuperAdmin, [SA]],
  ];
  for (const [fitur, boleh, peran] of matriks) {
    const hasil = [SA, KGB, HUKDIS, KEU, "", "peran_lain"].filter((r) => boleh(r));
    assert.deepEqual(hasil, peran, fitur);
  }
});

test("Super Admin melihat halaman keuangan tetapi tidak mengonfirmasi", () => {
  assert.equal(canAccessKeuangan(SA), true);
  assert.equal(canKonfirmasiKeuangan(SA), false);
});

test("halaman Proses KGB, Laporan, dan Satker & UPT hanya untuk peran KGB", () => {
  assert.deepEqual(PERAN_KGB, [SA, KGB]);
  for (const berkas of ["app/dashboard/kgb/layout.tsx", "app/dashboard/laporan/layout.tsx", "app/dashboard/satker/layout.tsx"]) {
    assert.match(readFileSync(berkas, "utf8"), /requireRole\(PERAN_KGB,/, berkas);
  }
});

test("API memakai guard yang sesuai dengan peran", () => {
  const harus: [string, RegExp][] = [
    ["app/api/kgb/[id]/konfirmasi-keuangan/route.ts", /canKonfirmasiKeuangan\(/],
    ["app/api/notifikasi/followup/route.ts", /canKonfirmasiKeuangan\(/],
    ["app/api/kgb/route.ts", /canViewKGB\(/],
    ["app/api/dashboard/route.ts", /canViewKGB\(/],
    ["app/api/kgb/summary/route.ts", /canProcessKGB\(/],
    ["app/api/laporan/route.ts", /canProcessKGB\(/],
    ["app/api/satker/route.ts", /canProcessKGB\(/],
    ["app/api/satker/[kode]/route.ts", /canProcessKGB\(/],
  ];
  for (const [berkas, pola] of harus) {
    const isi = readFileSync(berkas, "utf8");
    assert.match(isi, pola, berkas);
    assert.doesNotMatch(isi, /canAccessKeuangan\(|NON_KEUANGAN/, `${berkas} memakai guard yang lebih longgar`);
  }
});
