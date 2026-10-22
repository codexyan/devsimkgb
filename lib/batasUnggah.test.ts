// Jalankan: node --import tsx --test lib/batasUnggah.test.ts
// ADR-037, ADR-124: satu angka batas unggahan; teks layar tidak boleh menyebut angka lain.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BATAS_UNGGAH_BYTE, BATAS_UNGGAH_LABEL, pesanBerkasTerlaluBesar } from "./batasUnggah";
import { BATAS_DOKUMEN_BYTE } from "./dokumenPegawai";
import { BATAS_BERKAS_USULAN_BYTE } from "./usulanPegawai";
import { BATAS_LOGO_BYTE } from "./templateSuratServer";

test("batas unggahan 600 KB dan labelnya sejalan", () => {
  assert.equal(BATAS_UNGGAH_BYTE, 600 * 1024);
  assert.equal(BATAS_UNGGAH_LABEL, `${BATAS_UNGGAH_BYTE / 1024} KB`);
  assert.match(pesanBerkasTerlaluBesar(), /600 KB/);
});

test("semua jalur unggahan biasa memakai satu batas yang sama", () => {
  for (const batas of [BATAS_DOKUMEN_BYTE, BATAS_BERKAS_USULAN_BYTE, BATAS_LOGO_BYTE]) assert.equal(batas, BATAS_UNGGAH_BYTE);
});

function berkasSumber(dir: string, hasil: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) berkasSumber(jalur, hasil);
    else if (/\.(ts|tsx)$/.test(nama) && !/\.test\.ts$/.test(nama)) hasil.push(jalur);
  }
  return hasil;
}

test("teks 'paling besar N KB' di layar dan pesan selalu sama dengan batasnya", () => {
  const salah: string[] = [];
  for (const dir of ["app", "lib"]) {
    for (const berkas of berkasSumber(dir)) {
      if (berkas.endsWith("batasUnggah.ts")) continue;
      for (const m of readFileSync(berkas, "utf8").matchAll(/paling besar (\d+) KB/gi)) {
        if (Number(m[1]) !== BATAS_UNGGAH_BYTE / 1024) salah.push(`${berkas}: ${m[0]}`);
      }
    }
  }
  assert.deepEqual(salah, [], "ada teks batas ukuran yang tidak sama dengan lib/batasUnggah.ts");
});
