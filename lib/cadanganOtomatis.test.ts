// Cadangan otomatis basis data ke R2 dan pengembaliannya (ADR-084).
//
// Jalankan: node --import tsx --test lib/cadanganOtomatis.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import {
  AWALAN_CADANGAN,
  buatCadangan,
  cadanganDibuang,
  kunciCadangan,
  kunciDbTabel,
  pangkasCadangan,
  susunCadangan,
  tabelAplikasi,
  type BucketCadangan,
  type SumberCadangan,
} from "./cadanganOtomatis";
import { bacaCadangan, saringBaris, sqlPulihkan } from "./pulihkanCadangan";

type Baris = Record<string, unknown>;

function sumberTiruan(isi: Record<string, Baris[][]>): SumberCadangan {
  return {
    bentuk: "postgres",
    tabel: Object.keys(isi),
    async *baca(tabel) {
      for (const halaman of isi[tabel] ?? []) yield halaman;
    },
  };
}

function bucketTiruan() {
  const objek = new Map<string, { isi: Uint8Array; uploaded: Date; customMetadata?: Record<string, string> }>();
  let jam = Date.UTC(2026, 9, 8);
  const bucket: BucketCadangan = {
    async put(key, value, opsi) {
      objek.set(key, { isi: value, uploaded: new Date((jam += 1000)), customMetadata: opsi?.customMetadata as Record<string, string> });
      return null;
    },
    async list(opsi) {
      const cocok = [...objek.entries()].filter(([k]) => k.startsWith(opsi.prefix ?? ""));
      return {
        objects: cocok.map(([key, o]) => ({ key, uploaded: o.uploaded, size: o.isi.byteLength, customMetadata: o.customMetadata })),
        truncated: false,
      };
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objek.delete(k);
    },
  };
  return { bucket, objek };
}

const PEGAWAI = [
  { id: "p1", nip: "199001012020121001", nama: "PEGAWAI SATU", unit_kerja: "Lapas Perempuan Martapura", urutan_sisip: 1 },
  { id: "p2", nip: "199002022020122002", nama: "PEGAWAI DUA", unit_kerja: "Rutan Banjarmasin", urutan_sisip: 2 },
];

test("cadangan memuat semua baris per halaman, tanpa sandi akun, dan ditutup jumlah per tabel", async () => {
  const halaman2 = Array.from({ length: 3 }, (_, i) => ({ id: `u${i}`, status: "draf", catatan_upt: "pakai $cadangan$ di teks" }));
  const hasil = await susunCadangan(
    sumberTiruan({
      users: [[{ id: "a1", nip: "1", password: "$2a$10$hashrahasia", role: "superAdminCore" }]],
      pegawai: [PEGAWAI],
      usulan_pegawai: [halaman2.slice(0, 2), halaman2.slice(2)],
      notifikasi: [],
    }),
    new Date("2026-10-08T00:00:00Z"),
  );
  assert.deepEqual(hasil.jumlah, { users: 1, pegawai: 2, usulan_pegawai: 3, notifikasi: 0 });
  assert.equal(hasil.total, 6);

  const teks = gunzipSync(hasil.isi).toString("utf8");
  assert.ok(!teks.includes("hashrahasia"), "hash sandi tidak boleh ikut");
  assert.equal(hasil.ukuranMentah, Buffer.byteLength(teks));

  const isi = bacaCadangan(teks);
  assert.equal(isi.utuh, true);
  assert.equal(isi.kepala.dibuat, "2026-10-08T00:00:00.000Z");
  assert.deepEqual(isi.kepala.tabel, ["users", "pegawai", "usulan_pegawai", "notifikasi"]);
  assert.deepEqual(isi.baris.get("pegawai"), PEGAWAI);
  assert.equal(isi.baris.get("usulan_pegawai")?.length, 3);
  assert.equal(isi.baris.get("users")?.[0].password, undefined);
});

test("cadangan yang terputus (tanpa penutup) ditandai tidak utuh", async () => {
  const hasil = await susunCadangan(sumberTiruan({ pegawai: [PEGAWAI] }), new Date("2026-10-08T00:00:00Z"));
  const baris = gunzipSync(hasil.isi).toString("utf8").trim().split("\n");
  assert.equal(bacaCadangan(baris.slice(0, -1).join("\n")).utuh, false);
  assert.equal(bacaCadangan(baris.slice(0, -2).concat(baris.at(-1)!).join("\n")).utuh, false, "jumlah tidak cocok");
  assert.throws(() => bacaCadangan('{"jenis":"kepala","aplikasi":"LAIN"}'), /Bukan berkas cadangan/);
});

test("galat sumber membatalkan cadangan, tidak menyimpan berkas setengah jadi", async () => {
  const { bucket, objek } = bucketTiruan();
  const sumber: SumberCadangan = {
    bentuk: "postgres",
    tabel: ["pegawai"],
    async *baca() {
      yield PEGAWAI;
      throw new Error("D1 error (503)");
    },
  };
  await assert.rejects(buatCadangan(bucket, sumber), /503/);
  assert.equal(objek.size, 0);
});

test("berkas tersimpan di cadangan/otomatis/ dengan kunci urut waktu dan jumlah di metadata", async () => {
  const { bucket, objek } = bucketTiruan();
  const r = await buatCadangan(bucket, sumberTiruan({ pegawai: [PEGAWAI] }), new Date("2026-10-08T12:00:03.456Z"));
  assert.equal(r.kunci, `${AWALAN_CADANGAN}2026-10-08T12-00-03Z.jsonl.gz`);
  assert.equal(kunciCadangan(new Date("2026-01-02T00:00:00Z")) < r.kunci, true);
  assert.equal(objek.get(r.kunci)?.customMetadata?.total, "2");
  assert.equal(r.total, 2);
});

test("masa simpan: 30 hari penuh, lalu cadangan pertama tiap bulan selama 12 bulan", async () => {
  const sekarang = new Date("2026-10-08T12:00:00Z");
  const daftar: { key: string; uploaded: Date }[] = [];
  // Dua cadangan sehari selama 500 hari ke belakang.
  for (let hari = 500; hari >= 0; hari--) {
    for (const jam of [0, 12]) {
      const t = new Date(Date.UTC(2026, 9, 8 - hari, jam));
      if (t <= sekarang) daftar.push({ key: kunciCadangan(t), uploaded: t });
    }
  }
  const buang = new Set(cadanganDibuang(daftar, sekarang));
  const simpan = daftar.filter((o) => !buang.has(o.key));
  const batasHarian = sekarang.getTime() - 30 * 86_400_000;
  const harian = simpan.filter((o) => o.uploaded.getTime() >= batasHarian);
  const bulanan = simpan.filter((o) => o.uploaded.getTime() < batasHarian);
  assert.equal(harian.length, daftar.filter((o) => o.uploaded.getTime() >= batasHarian).length, "30 hari terakhir utuh");
  // Bulan Oktober 2025 sampai September 2026 (sebagian bulan ini masih tercakup harian).
  assert.ok(bulanan.length >= 11 && bulanan.length <= 13, `bulanan ${bulanan.length}`);
  for (const o of bulanan) assert.equal(o.uploaded.getUTCDate(), 1, `${o.key} harus cadangan pertama bulannya`);
  assert.ok(bulanan.every((o) => o.uploaded >= new Date("2025-10-01T00:00:00Z")), "tidak lebih dari 12 bulan");

  // Cadangan terbaru tidak pernah dibuang, walau jamnya tertinggal jauh.
  const lama = [0, 1, 2, 3].map((i) => ({ key: `k${i}`, uploaded: new Date(Date.UTC(2020, 0, 10 + i)) }));
  assert.deepEqual(cadanganDibuang(lama, sekarang), ["k0"]);
});

test("pangkasCadangan hanya menyentuh awalan cadangan/otomatis/", async () => {
  const { bucket, objek } = bucketTiruan();
  objek.set("sk/199001012020121001_1.pdf", { isi: new Uint8Array(1), uploaded: new Date("2020-01-01") });
  for (let i = 0; i < 5; i++)
    objek.set(kunciCadangan(new Date(Date.UTC(2025, 0, 2 + i))), { isi: new Uint8Array(1), uploaded: new Date(Date.UTC(2025, 0, 2 + i)) });
  assert.equal(await pangkasCadangan(bucket, new Date("2026-10-08T00:00:00Z")), 2);
  assert.ok(objek.has("sk/199001012020121001_1.pdf"));
});

test("setiap tabel aplikasi punya repository untuk sumber lokal", () => {
  const peta = kunciDbTabel();
  for (const t of tabelAplikasi()) assert.ok(peta.has(t), `tabel ${t} tanpa repository`);
  assert.equal(peta.get("users"), "user");
  assert.equal(peta.get("riwayat_kgb"), "riwayatKGB");
});

test("SQL pengembalian: baris terpilih, tanda dolar aman, kunci dan urutan tidak ditimpa", async () => {
  const usulan = [
    { id: "u1", status: "draf", unit_kerja: "Lapas Perempuan Martapura", catatan_upt: "pakai $cadangan$ di teks", urutan_sisip: 5 },
    { id: "u2", status: "menunggu", unit_kerja: "Rutan Banjarmasin", catatan_upt: null, urutan_sisip: 6 },
  ];
  const dipilih = saringBaris(usulan, { cari: "MARTAPURA" });
  assert.deepEqual(dipilih.map((b) => b.id), ["u1"]);
  assert.deepEqual(saringBaris(usulan, { id: ["u2"] }).map((b) => b.id), ["u2"]);

  const sql = sqlPulihkan("usulan_pegawai", dipilih);
  assert.match(sql, /^-- 1 baris public\.usulan_pegawai/);
  assert.match(sql, /insert into public\.usulan_pegawai overriding system value/);
  assert.match(sql, /jsonb_populate_recordset\(null::public\.usulan_pegawai, \$cadangan_\$/);
  assert.match(sql, /on conflict \(id\) do nothing;/);
  const json = /\$cadangan_\$([\s\S]*)\$cadangan_\$::jsonb/.exec(sql)?.[1];
  assert.deepEqual(JSON.parse(json!), dipilih);
  assert.match(sql, /select setval\(pg_get_serial_sequence\('public\.usulan_pegawai', 'urutan_sisip'\), greatest\(/);
  assert.ok(!sqlPulihkan("pegawai", [{ id: "x" }]).includes("setval"), "tanpa urutan_sisip, penghitung tidak disentuh");

  const timpa = sqlPulihkan("usulan_pegawai", usulan, { timpa: true });
  assert.match(timpa, /on conflict \(id\) do update set\n {2}status = excluded\.status,/);
  assert.ok(!/ id = excluded|urutan_sisip = excluded/.test(timpa));

  assert.match(sqlPulihkan("pegawai", []), /tidak ada baris/);
  assert.throws(() => sqlPulihkan("pegawai; drop table x", usulan), /tidak sah/);
  assert.throws(() => sqlPulihkan("pegawai", [{ id: "x", "a;b": 1 }], { timpa: true }), /tidak sah/);
});
