// Pemetaan nama aplikasi → nama tabel dan kolom SQL (lib/db/nama.ts). Jalankan: node --import tsx --test lib/db/nama.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { keSnake, namaTabel } from "./nama";

test("nama snake_case untuk kolom dan tabel", () => {
  assert.equal(keSnake("tmtKgbBerikutnya"), "tmt_kgb_berikutnya");
  assert.equal(keSnake("berdampakKGB"), "berdampak_kgb");
  assert.equal(keSnake("nomorSK"), "nomor_sk");
  assert.equal(keSnake("penetapSkDasar"), "penetap_sk_dasar");
  assert.equal(keSnake("notifKgbH1"), "notif_kgb_h1");
  assert.equal(namaTabel("User"), "users");
  assert.equal(namaTabel("RiwayatKGB"), "riwayat_kgb");
  assert.equal(namaTabel("ProfileChangeRequest"), "profile_change_request");
});
