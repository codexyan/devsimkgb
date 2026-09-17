// Pemilihan penandatangan surat KGB menurut masa berlaku.
//
// Jalankan: node --import tsx --test lib/penandatangan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  berlakuPada,
  cariBentrok,
  rentangBerlaku,
  tentukanPenandatangan,
  type JenisPenandatangan,
  type Penandatangan,
} from "./penandatangan";

function baris(
  id: string,
  jenis: JenisPenandatangan,
  berlakuMulai: string,
  berlakuSampai: string | null,
  nip: string,
): Penandatangan {
  return {
    id,
    jenis,
    nama: `PEJABAT ${id.toUpperCase()}`,
    nip,
    jabatan: jenis === "dirjen" ? "Direktur Jenderal Pemasyarakatan" : "Kepala Kantor Wilayah",
    dasarPenunjukan: jenis === "plh" || jenis === "plt" ? "Surat perintah contoh" : null,
    berlakuMulai,
    berlakuSampai,
    updatedBy: null,
  };
}

test("masa berlaku dibaca sebagai tanggal kalender WITA, baik tersimpan tengah malam UTC maupun WITA", () => {
  // Mulai 1 Juni 2026 ditulis proses WITA (16.00 UTC hari sebelumnya), akhir 30 Juni ditulis proses UTC.
  const p = { berlakuMulai: "2026-05-31T16:00:00.000Z", berlakuSampai: "2026-06-30T00:00:00.000Z" };
  assert.equal(berlakuPada(p, new Date(2026, 4, 31)), false);
  assert.equal(berlakuPada(p, new Date(2026, 5, 1)), true);
  assert.equal(berlakuPada(p, new Date(2026, 5, 30)), true);
  assert.equal(berlakuPada(p, new Date(2026, 6, 1)), false);
  // Pukul 20.00 UTC tanggal 30 Juni sudah 1 Juli menurut WITA.
  assert.equal(berlakuPada(p, new Date("2026-06-30T20:00:00Z")), false);
  assert.equal(berlakuPada({ berlakuMulai: null, berlakuSampai: null }, new Date(2026, 5, 1)), false);
});

test("Plh yang berakhir pada tanggal tersimpan tengah malam WITA masih menandatangani pada hari terakhirnya", () => {
  const daftar = [
    baris("a", "definitif", "2026-01-01", null, "100000000000000001"),
    // Berakhir 14 Juni 2026 WITA.
    baris("b", "plh", "2026-06-01T00:00:00.000Z", "2026-06-13T16:00:00.000Z", "100000000000000002"),
  ];
  const tanggal14 = tentukanPenandatangan(daftar, new Date(2026, 5, 14), "100000000000000009");
  assert.equal(tanggal14.ok && tanggal14.penandatangan.id, "b");
  assert.equal(tanggal14.ok && tanggal14.jabatan, "Plh. Kepala Kantor Wilayah");
  const tanggal15 = tentukanPenandatangan(daftar, new Date(2026, 5, 15), "100000000000000009");
  assert.equal(tanggal15.ok && tanggal15.penandatangan.id, "a");
});

test("masa berlaku yang bersambung dalam format tanggal berbeda tidak dianggap bertabrakan", () => {
  // Lama berakhir 31 Mei (tengah malam UTC); baru mulai 1 Juni (tengah malam WITA).
  const lama = baris("a", "definitif", "2025-01-01", "2026-05-31T00:00:00.000Z", "100000000000000001");
  const calon = { jenis: "plt" as const, berlakuMulai: "2026-05-31T16:00:00.000Z", berlakuSampai: null };
  assert.equal(cariBentrok([lama], calon), undefined);
  assert.equal(cariBentrok([lama], { ...calon, berlakuMulai: "2026-05-31T00:00:00.000Z" })?.id, "a");
});

test("rentang berlaku ditampilkan menurut WITA", () => {
  assert.equal(
    rentangBerlaku({ berlakuMulai: "2026-05-31T16:00:00.000Z", berlakuSampai: null }),
    `${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(2026, 5, 1, 4)))} – sekarang`,
  );
});
