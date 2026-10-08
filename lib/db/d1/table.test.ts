// Repository D1 (ADR-085) di atas skema D1 sungguhan (d1/migrations) pada SQLite di memori: perilakunya harus sama
// dengan SupabaseTable dan Table Sheets.
//
// Jalankan: node --import tsx --test lib/db/d1/table.test.ts

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { defs, type PegawaiRow, type UsulanPegawaiRow } from "../../sheets/tables";
import { pasangKlienD1 } from "./klien";
import { d1 } from "./tables";
import { buatD1Uji, type D1Uji } from "./ujiD1";

let uji: D1Uji;
beforeEach(() => {
  uji = buatD1Uji();
  pasangKlienD1(uji);
});
afterEach(() => pasangKlienD1(null));

const pegawai = (nip: string, isi: Partial<PegawaiRow> = {}) => ({ nip, nama: `PEGAWAI ${nip.slice(-3)}`, ...isi }) as PegawaiRow;

test("create: id dan nilai bawaan dari tabel, nilai dikembalikan dalam bentuk aplikasi", async () => {
  const p = await d1.pegawai.create(
    pegawai("199001012020121001", { golonganRuang: "III/a", mkgTahun: 2, tmtKgbBerikutnya: new Date("2026-12-01T00:00:00.000Z"), jabatan: "" }),
  );
  assert.match(p.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(p.aktif, true, "bawaan aktif true");
  assert.ok(p.createdAt instanceof Date && !Number.isNaN(p.createdAt.getTime()));
  assert.equal(p.jabatan, null, "teks kosong disimpan sebagai null");
  assert.equal(p.mkgTahun, 2);
  assert.deepEqual(p.tmtKgbBerikutnya, new Date("2026-12-01T00:00:00.000Z"));
  const baris = { ...(uji.db.prepare("SELECT aktif, tmt_kgb_berikutnya, jabatan FROM pegawai").get() as object) };
  assert.deepEqual(baris, { aktif: 1, tmt_kgb_berikutnya: "2026-12-01T00:00:00.000Z", jabatan: null });
});

test("findMany: urutan bawaan menurut urutan dimasukkan; orderBy dengan null di akhir; batas", async () => {
  await d1.pegawai.create(pegawai("199001012020121003", { tmtKgbBerikutnya: new Date("2027-01-01T00:00:00Z") }));
  await d1.pegawai.create(pegawai("199001012020121001"));
  await d1.pegawai.create(pegawai("199001012020121002", { tmtKgbBerikutnya: new Date("2026-01-01T00:00:00Z") }));
  assert.deepEqual((await d1.pegawai.findMany()).map((p) => p.nip.slice(-1)), ["3", "1", "2"]);
  assert.deepEqual(
    (await d1.pegawai.findMany({ orderBy: { field: "tmtKgbBerikutnya", dir: "desc" } })).map((p) => p.nip.slice(-1)),
    ["3", "2", "1"],
  );
  assert.deepEqual(
    (await d1.pegawai.findMany({ orderBy: { field: "tmtKgbBerikutnya" } })).map((p) => p.nip.slice(-1)),
    ["2", "3", "1"],
  );
  assert.equal((await d1.pegawai.findMany({ batas: 2 })).length, 2);
  assert.deepEqual(await d1.pegawai.findMany({ batas: 0 }), []);
  assert.deepEqual(await d1.pegawai.findMany({ where: { nip: { in: [] } } }), [], "kondisi selalu salah tanpa kueri");
});

test("findKolom, findUnique, count", async () => {
  await d1.pegawai.create(pegawai("199001012020121001", { unitKerja: "Rutan Rantau", aktif: false }));
  await d1.pegawai.create(pegawai("199001012020121002", { unitKerja: "Lapas Banjarmasin" }));
  assert.deepEqual(await d1.pegawai.findKolom(["nip", "aktif"]), [
    { nip: "199001012020121001", aktif: false },
    { nip: "199001012020121002", aktif: true },
  ]);
  assert.equal((await d1.pegawai.findUnique({ unitKerja: { contains: "banjar" } }))?.nip, "199001012020121002");
  assert.equal(await d1.pegawai.findUnique({ nip: "tidak ada" }), null);
  assert.equal(await d1.pegawai.count(), 2);
  assert.equal(await d1.pegawai.count({ aktif: true }), 1);
  assert.equal(await d1.pegawai.count({ OR: [{ aktif: false }, { unitKerja: { startsWith: "lapas" } }] }), 2);
});

test("update: record pertama yang cocok, undefined mengosongkan, record yang tidak ada → null", async () => {
  const a = await d1.pegawai.create(pegawai("199001012020121001", { jabatan: "Penjaga", golonganRuang: "II/a" }));
  await d1.pegawai.create(pegawai("199001012020121002", { golonganRuang: "II/a" }));
  const hasil = await d1.pegawai.update({ golonganRuang: "II/a" }, { golonganRuang: "II/b", jabatan: undefined });
  assert.equal(hasil?.id, a.id);
  assert.equal(hasil?.golonganRuang, "II/b");
  assert.equal(hasil?.jabatan, null);
  assert.equal(await d1.pegawai.update({ id: "tidak-ada" }, { nama: "X" }), null);
  assert.equal(await d1.pegawai.update({ nip: "tidak-ada" }, { nama: "X" }), null);
  const tanpaUbah = await d1.pegawai.update({ id: a.id }, {});
  assert.equal(tanpaUbah?.golonganRuang, "II/b");
});

test("updateMany, delete, deleteMany, dan cascade foreign key", async () => {
  const a = await d1.pegawai.create(pegawai("199001012020121001"));
  const b = await d1.pegawai.create(pegawai("199001012020121002"));
  await d1.riwayatKGB.create({ pegawaiId: a.id, status: "belum_diproses" } as never);
  await d1.riwayatKGB.create({ pegawaiId: a.id, status: "selesai" } as never);
  assert.equal(await d1.riwayatKGB.updateMany({ pegawaiId: a.id }, { isArsip: true } as never), 2);
  assert.equal(await d1.riwayatKGB.count({ isArsip: true }), 2);
  assert.equal(await d1.riwayatKGB.deleteMany({ status: "selesai" }), 1);
  assert.equal(await d1.pegawai.delete({ nip: b.nip }), true);
  assert.equal(await d1.pegawai.delete({ nip: b.nip }), false);
  await d1.pegawai.delete({ id: a.id });
  assert.equal(await d1.riwayatKGB.count(), 0, "riwayat KGB ikut terhapus bersama pegawainya");
  const jejak = uji.db.prepare("SELECT tabel, aksi FROM jejak_data ORDER BY id").all();
  assert.deepEqual(
    jejak.map((j) => Object.values(j as object).join(":")),
    ["riwayat_kgb:ubah", "riwayat_kgb:ubah", "riwayat_kgb:hapus", "pegawai:hapus", "riwayat_kgb:hapus", "pegawai:hapus"],
  );
});

test("createMany dan upsertMany: banyak baris dalam batch, nilai bawaan per baris", async () => {
  const rows = Array.from({ length: 250 }, (_, i) => pegawai(`1990010120201${String(i).padStart(5, "0")}`, i % 2 ? { aktif: false } : {}));
  assert.equal(await d1.pegawai.createMany(rows), 250);
  assert.equal(await d1.pegawai.count(), 250);
  assert.equal(await d1.pegawai.count({ aktif: true }), 125);
  const [pertama] = await d1.pegawai.findMany({ batas: 1 });
  await d1.pegawai.upsertMany([{ ...pertama, nama: "DIGANTI" }, pegawai("199901012020121999")]);
  assert.equal((await d1.pegawai.findUnique({ id: pertama.id }))?.nama, "DIGANTI");
  assert.equal(await d1.pegawai.count(), 251);
  const ids = (await d1.pegawai.findKolom(["id"])).map((p) => p.id);
  uji.jumlahKueri = 0;
  assert.equal((await d1.pegawai.findMany({ where: { id: { in: ids } } })).length, 251);
  assert.equal(uji.jumlahKueri, 1, "daftar 251 id cukup satu kueri");
});

test("usulan dengan seluruh kolomnya tersimpan utuh dalam satu pernyataan", async () => {
  const kolom = defs.UsulanPegawai.columns;
  assert.ok(kolom.length < 100, `${kolom.length} kolom masih di bawah batas 100 parameter D1`);
  const isi: Record<string, unknown> = {};
  for (const k of kolom) {
    isi[k.name] =
      k.type === "boolean" ? true : k.type === "int" ? 3 : k.type === "datetime" ? new Date("2026-10-08T01:02:03.004Z") : `isi-${k.name}`;
  }
  isi.pegawaiId = null;
  const u = await d1.usulanPegawai.create(isi as unknown as UsulanPegawaiRow);
  const dibaca = await d1.usulanPegawai.findUnique({ id: u.id });
  for (const k of kolom) assert.deepEqual((dibaca as unknown as Record<string, unknown>)[k.name], isi[k.name], k.name);
});

test("batas parameter D1 ditolak dengan pesan jelas, bukan galat SQLite", async () => {
  const where = { OR: Array.from({ length: 101 }, (_, i) => ({ nip: `x${i}` })) };
  await assert.rejects(d1.pegawai.findMany({ where }), /melebihi batas D1/);
});
