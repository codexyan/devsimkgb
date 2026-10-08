// Pengajuan bertahap ke Kanwil (ADR-079).
//
// Jalankan: node --import tsx --test app/dashboard/components/upt/ajukanBertahap.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { ajukanBertahap, kabarJadiPerbaikan } from "./ajukanBertahap";

type Kiriman = { id: string[]; periksaSaja: boolean; berkas: boolean; pathBerkas: string | null };

function tiruFetch(jawab: (k: Kiriman, ke: number) => { status: number; body: object }) {
  const log: Kiriman[] = [];
  const asli = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { body: FormData }) => {
    const f = init.body;
    const k: Kiriman = {
      id: f.getAll("id").map(String),
      periksaSaja: f.get("periksaSaja") === "1",
      berkas: f.get("berkas") instanceof Blob,
      pathBerkas: (f.get("pathBerkas") as string | null) ?? null,
    };
    log.push(k);
    const j = jawab(k, log.length);
    return new Response(JSON.stringify(j.body), { status: j.status });
  }) as typeof fetch;
  return { log, pulihkan: () => (globalThis.fetch = asli) };
}

const ids = Array.from({ length: 12 }, (_, i) => `u${i + 1}`);
const surat = new File([new Uint8Array([37, 80, 68, 70])], "surat.pdf", { type: "application/pdf" });

test("12 pegawai: diperiksa sekali, dikirim per 5, surat diunggah sekali lalu jalurnya dipakai ulang", async () => {
  const { log, pulihkan } = tiruFetch((k) => ({
    status: 200,
    body: k.periksaSaja
      ? { ok: true, jumlah: 12 }
      : {
          ok: true,
          jumlah: k.id.length,
          sudah: 0,
          pathBerkas: "usulan/x_berkas_1.pdf",
          // Pegawai baru yang NIP-nya sudah tercatat, diajukan sebagai perbaikan data (ADR-091).
          jadiPerbaikan: k.id.includes("u2") ? ["A"] : k.id.includes("u11") ? ["B"] : [],
        },
  }));
  try {
    const kemajuan: number[] = [];
    const h = await ajukanBertahap({ ids, nomorSurat: "W.1", tanggalSurat: "2026-10-07", berkas: surat, kemajuan: (n) => kemajuan.push(n) });
    assert.deepEqual(h, { ok: true, jumlah: 12, jadiPerbaikan: ["A", "B"] }, "nama yang dijadikan perbaikan dikumpulkan dari tiap kiriman");
    assert.equal(log.length, 4);
    assert.equal(log[0].periksaSaja, true);
    assert.deepEqual(log.slice(1).map((k) => k.id.length), [5, 5, 2]);
    assert.deepEqual(log.slice(1).map((k) => k.berkas), [true, false, false]);
    assert.deepEqual(log.slice(1).map((k) => k.pathBerkas), [null, "usulan/x_berkas_1.pdf", "usulan/x_berkas_1.pdf"]);
    assert.deepEqual(kemajuan, [0, 5, 10]);
  } finally {
    pulihkan();
  }
});

test("kiriman yang gagal di tengah: dicoba sekali lagi, lalu melaporkan yang sudah terkirim", async () => {
  const { log, pulihkan } = tiruFetch((k, ke) =>
    k.periksaSaja || ke === 2
      ? { status: 200, body: { ok: true, jumlah: k.id.length, pathBerkas: "usulan/x_berkas_1.pdf" } }
      : { status: 500, body: { error: "Worker exceeded resource limits." } },
  );
  try {
    const h = await ajukanBertahap({ ids, nomorSurat: "W.1", tanggalSurat: "2026-10-07", berkas: surat });
    assert.equal(h.ok, false);
    if (!h.ok) {
      assert.deepEqual(h.terkirim, ["u1", "u2", "u3", "u4", "u5"]);
      assert.match(h.galat, /5 dari 12 pegawai sudah terkirim/);
    }
    assert.equal(log.length, 4, "periksa, kiriman 1, kiriman 2, ulangan kiriman 2");
  } finally {
    pulihkan();
  }
});

test("draf yang kurang ditolak saat diperiksa, sebelum apa pun dikirim", async () => {
  const { log, pulihkan } = tiruFetch(() => ({ status: 400, body: { error: "Belum dapat diajukan: A (SK KGB terakhir)." } }));
  try {
    const h = await ajukanBertahap({ ids, nomorSurat: "W.1", tanggalSurat: "2026-10-07", berkas: surat });
    assert.deepEqual(h, { ok: false, galat: "Belum dapat diajukan: A (SK KGB terakhir).", terkirim: [] });
    assert.equal(log.length, 1);
  } finally {
    pulihkan();
  }
});

test("kabar pegawai baru yang diajukan sebagai perbaikan data (ADR-091)", () => {
  assert.equal(kabarJadiPerbaikan([]), "");
  assert.match(kabarJadiPerbaikan(["A"]), /^ A ternyata sudah tercatat di SIM-KGB, jadi usulannya diajukan sebagai perbaikan data/);
  assert.match(kabarJadiPerbaikan(["A", "B"]), /^ 2 pegawai \(A, B\) ternyata sudah tercatat/);
});
