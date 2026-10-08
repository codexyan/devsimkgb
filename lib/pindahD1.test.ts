// Pemindahan Supabase → D1 (ADR-085): baris mentah berbentuk Postgres disalin ke skema D1 sungguhan, lalu dibaca
// lewat repository D1. Hasilnya harus sama persis dengan yang dibaca repository Supabase dari baris yang sama.
//
// Jalankan: node --import tsx --test lib/pindahD1.test.ts

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { defs } from "./sheets/tables";
import { pasangKlienD1 } from "./db/d1/klien";
import { SKEMA_D1 } from "./db/d1/skema";
import { d1 } from "./db/d1/tables";
import { buatD1Uji, type D1Uji } from "./db/d1/ujiD1";
import { supabase } from "./db/supabase/tables";
import { namaTabel } from "./db/supabase/nama";
import { URUTAN_SALIN, bandingkan, salinSemua, salinSusulan, type SumberMentah } from "./pindahD1";

type Baris = Record<string, unknown>;

let uji: D1Uji;
const backendAsli = process.env.DATA_BACKEND;
beforeEach(() => {
  uji = buatD1Uji();
  pasangKlienD1(uji);
  process.env.DATA_BACKEND = "supabase";
});
afterEach(() => {
  pasangKlienD1(null);
  process.env.DATA_BACKEND = backendAsli;
});

/** Nilai berbentuk jawaban PostgREST: waktu dengan mikrodetik dan zona +00:00, boolean JSON, jsonb objek. */
function nilaiPostgres(tabel: string, kolom: string, jenis: string, i: number): unknown {
  if (kolom === "urutan_sisip") return i + 1;
  if (jenis === "waktu") return `2026-10-0${(i % 8) + 1}T07:05:54.73812${i % 10}+00:00`;
  if (jenis === "boolean") return i % 2 === 0;
  if (jenis === "bilangan") return 7 + i;
  if (jenis === "json") return { tabel, kolom, i };
  return `${kolom}-${i}`;
}

/** Data Postgres tiruan untuk semua tabel, memenuhi foreign key, unik, dan check. */
function dataPostgres(jumlah = 3): Map<string, Baris[]> {
  const data = new Map<string, Baris[]>();
  for (const tabel of URUTAN_SALIN) {
    const baris: Baris[] = [];
    for (let i = 0; i < jumlah; i++) {
      const b: Baris = {};
      for (const [kolom, jenis] of Object.entries(SKEMA_D1[tabel])) b[kolom] = nilaiPostgres(tabel, kolom, jenis, i);
      b.id = tabel === "jejak_data" ? i + 1 : `${tabel}-${i}`;
      for (const fk of ["pegawai_id"]) if (fk in b) b[fk] = `pegawai-${i}`;
      if ("kgb_id" in b) b.kgb_id = `riwayat_kgb-${i}`;
      if (tabel === "review_sk_upt") b.id = `riwayat_kgb-${i}`;
      if ("user_id" in b && tabel === "profile_change_request") b.user_id = `users-${i}`;
      if ("penandatangan_id" in b) b.penandatangan_id = `penandatangan-${i}`;
      if ("regulasi_id" in b) b.regulasi_id = null;
      if ("digantikan_oleh_id" in b) b.digantikan_oleh_id = null;
      if (tabel === "penandatangan") Object.assign(b, { jenis: "definitif", berlaku_mulai: "2026-01-01T00:00:00+00:00", berlaku_sampai: null });
      if (tabel === "konfigurasi_kanwil") b.batas_input_sdm = 10;
      if (tabel === "usulan_pegawai") b.catatan_upt = i === 0 ? "" : `catatan ${i}`;
      if (tabel === "jejak_data") b.lama = { id: `pegawai-${i}`, nama: "LAMA" };
      baris.push(b);
    }
    data.set(tabel, baris);
  }
  return data;
}

const sumberDari = (data: Map<string, Baris[]>): SumberMentah => async (tabel) => data.get(tabel) ?? [];

test("urutan salin mencakup semua tabel D1 dan mendahulukan tabel yang dirujuk foreign key", () => {
  assert.deepEqual([...URUTAN_SALIN].sort(), Object.keys(SKEMA_D1).sort());
  const fk = uji.db.prepare("SELECT m.name tabel, p.\"table\" rujukan FROM sqlite_master m, pragma_foreign_key_list(m.name) p WHERE m.type = 'table'").all() as {
    tabel: string;
    rujukan: string;
  }[];
  for (const { tabel, rujukan } of fk) {
    if (tabel === rujukan) continue;
    assert.ok(URUTAN_SALIN.indexOf(rujukan as never) < URUTAN_SALIN.indexOf(tabel as never), `${rujukan} sebelum ${tabel}`);
  }
});

test("salin semua: repository D1 membaca persis yang dibaca repository Supabase dari baris yang sama", async () => {
  const data = dataPostgres();
  const hasil = await salinSemua(sumberDari(data));
  assert.equal(hasil.total, URUTAN_SALIN.length * 3);
  for (const def of Object.values(defs)) {
    const tabel = namaTabel(def.tab);
    const kunci = Object.keys(d1).find((k) => (d1 as Record<string, { tabel: string }>)[k].tabel === tabel)!;
    const repoD1 = (d1 as unknown as Record<string, { findMany(): Promise<Baris[]> }>)[kunci];
    const repoSupabase = (supabase as unknown as Record<string, { keRecord(b: Baris): Baris }>)[kunci];
    const dibaca = await repoD1.findMany();
    const harapan = data.get(tabel)!.map((b) => repoSupabase.keRecord(b));
    assert.deepEqual(dibaca, harapan, tabel);
  }
  const jejak = uji.db.prepare("SELECT id, lama FROM jejak_data ORDER BY id").all() as { id: number; lama: string }[];
  assert.deepEqual(jejak.map((j) => j.id), [1, 2, 3], "jejak sama persis, tanpa jejak penghapusan dari penyalinan");
  assert.deepEqual(JSON.parse(jejak[0].lama), { id: "pegawai-0", nama: "LAMA" });
  const urutan = uji.db.prepare("SELECT urutan_sisip FROM pegawai ORDER BY urutan_sisip").all() as { urutan_sisip: number }[];
  assert.deepEqual(urutan.map((u) => u.urutan_sisip), [1, 2, 3]);
});

test("salin semua dapat diulang, dan bila gagal di tengah D1 tidak berubah sama sekali", async () => {
  await salinSemua(sumberDari(dataPostgres()));
  await salinSemua(sumberDari(dataPostgres()));
  assert.equal(await d1.pegawai.count(), 3);
  assert.equal(uji.db.prepare("SELECT count(*) n FROM jejak_data").get() !== undefined, true);
  assert.equal((uji.db.prepare("SELECT count(*) n FROM jejak_data").get() as { n: number }).n, 3);

  const rusak = dataPostgres(4);
  rusak.get("riwayat_kgb")![3].pegawai_id = "pegawai-tidak-ada";
  await assert.rejects(salinSemua(sumberDari(rusak)), /FOREIGN KEY/);
  assert.equal(await d1.pegawai.count(), 3, "isi lama utuh");
  assert.equal(await d1.riwayatKGB.count(), 3);
});

test("salin semua ditolak bila D1 sudah menjadi basis data aktif", async () => {
  process.env.DATA_BACKEND = "d1";
  await assert.rejects(salinSemua(sumberDari(dataPostgres())), /sudah menjadi basis data aktif/);
});

test("susulan hanya menambah baris yang belum ada; banding menunjukkan selisihnya", async () => {
  const data = dataPostgres();
  await salinSemua(sumberDari(data));
  process.env.DATA_BACKEND = "d1";
  // Sesudah peralihan: satu pegawai baru ditulis ke D1, satu usulan tertulis ke Supabase tepat sebelum peralihan.
  await d1.pegawai.create({ nip: "199901012020121999", nama: "BARU DI D1" } as never);
  const susulan = { ...data.get("usulan_pegawai")![0], id: "usulan-telat", urutan_sisip: 4 };
  data.get("usulan_pegawai")!.push(susulan);
  await d1.usulanPegawai.update({ id: "usulan_pegawai-1" }, { catatanUpt: "diubah di D1" } as never);

  const sebelum = await bandingkan(sumberDari(data));
  const u = sebelum.find((b) => b.tabel === "usulan_pegawai")!;
  assert.deepEqual([u.supabase, u.d1, u.belumDiD1, u.hanyaDiD1], [4, 3, 1, 0]);
  const p = sebelum.find((b) => b.tabel === "pegawai")!;
  assert.deepEqual([p.supabase, p.d1, p.belumDiD1, p.hanyaDiD1], [3, 4, 0, 1]);

  const hasil = await salinSusulan(sumberDari(data));
  assert.equal(hasil.total, 1);
  assert.equal(await d1.usulanPegawai.count(), 4);
  assert.equal((await d1.usulanPegawai.findUnique({ id: "usulan_pegawai-1" }))?.catatanUpt, "diubah di D1", "baris yang ada tidak ditimpa");
  assert.equal(await d1.pegawai.count(), 4, "pegawai baru di D1 tetap ada");
  assert.equal((await salinSusulan(sumberDari(data))).total, 0, "susulan kedua tidak menulis apa-apa");
});
