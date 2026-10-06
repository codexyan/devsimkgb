// Dokumen tiap SK pada linimasa SK penetap gaji pokok (ADR-066).
//
// Jalankan: node --import tsx --test lib/dokumenLinimasa.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { dokumenLinimasa, dokumenSk, type KgbUntukDokumen } from "./dokumenLinimasa";
import type { DokumenPegawai } from "./dokumenPegawai";
import type { SkGaji } from "./linimasaDasarSk";

const sk = (p: Partial<SkGaji> & Pick<SkGaji, "kunci" | "jenis">): SkGaji =>
  ({ label: "SK", nomorSK: null, tanggalSK: null, tmt: null, penetap: null, rincian: null, asal: "kgb", dataPegawai: false, peran: "tergantikan", ...p }) as SkGaji;

const dok = (p: Partial<DokumenPegawai> & Pick<DokumenPegawai, "id" | "sumber">): DokumenPegawai => ({
  judul: "Dokumen", nomorSK: "", tanggal: "", keterangan: "", ukuran: null, url: `/berkas/${p.id}`, bisaHapus: false, ...p,
});

const kgbSelesai: KgbUntukDokumen[] = [
  { id: "k1", surat: { nomorSurat: "W.17-KGB-2022", pathFile: "sk/199001_1.pdf" } },
  { id: "k2", surat: { nomorSurat: "W.17-KGB-2024", pathFile: null } },
  { id: "k3", isArsip: true, surat: null },
];

test("SK KGB dari SIM-KGB: SK bertanda tangan, atau draf cetakan bila belum diunggah", () => {
  const ttd = dokumenSk(sk({ kunci: "kgb:k1", jenis: "kgb", nomorSK: "W.17-KGB-2022" }), [], kgbSelesai);
  assert.deepEqual(ttd, { jenis: "berkas", url: "/api/blob/download?url=sk%2F199001_1.pdf", sumber: "SK bertanda tangan di SIM-KGB" });
  const draf = dokumenSk(sk({ kunci: "kgb:k2", jenis: "kgb", nomorSK: "W.17-KGB-2024" }), [], kgbSelesai);
  assert.deepEqual(draf, { jenis: "draf", kgbId: "k2", sumber: "Draf cetakan SIM-KGB, tanpa tanda tangan" });
  // Arsip KGB tanpa berkas tidak punya draf cetakan.
  assert.equal(dokumenSk(sk({ kunci: "kgb:k3", jenis: "kgb", nomorSK: "ARSIP-1" }), [], kgbSelesai), null);
});

test("SK KGB yang belum diunggah, tetapi pindaiannya ada di arsip dokumen, membuka pindaian itu, bukan draf", () => {
  const arsip = dok({ id: "arsip-a", sumber: "arsip", jenis: "sk_kgb", nomorSK: "W.17-KGB- 2024" });
  const hasil = dokumenSk(sk({ kunci: "kgb:k2", jenis: "kgb", nomorSK: "W.17-KGB-2024" }), [arsip], kgbSelesai);
  assert.deepEqual(hasil, { jenis: "berkas", url: "/berkas/arsip-a", sumber: "Arsip dokumen pegawai" });
});

test("SK kenaikan pangkat dan PMK dicocokkan menurut jenis dan nomor SK; usulan hanya yang disetujui", () => {
  const dokumen = [
    dok({ id: "usulan-u1-skPangkat", sumber: "usulan", jenis: "sk_pangkat", nomorSK: "W.17-PI-2026", status: "ditolak" }),
    dok({ id: "usulan-u2-skPangkat", sumber: "usulan", jenis: "sk_pangkat", nomorSK: "w.17-pi-2026", status: "disetujui" }),
    dok({ id: "usulan-u2-skPmk", sumber: "usulan", jenis: "sk_pmk", nomorSK: "W.17-PMK-1", status: "disetujui" }),
    dok({ id: "inventaris-x", sumber: "inventaris", jenis: "sk_pangkat", nomorSK: "W.17-KP-LAIN" }),
  ];
  const kp = dokumenSk(sk({ kunci: "kp:r1", jenis: "kp", nomorSK: "W.17-PI-2026" }), dokumen, []);
  assert.deepEqual(kp, { jenis: "berkas", url: "/berkas/usulan-u2-skPangkat", sumber: "Berkas usulan UPT yang disetujui" });
  // Nomor PMK yang sama pada jenis lain tidak tertukar.
  assert.equal(dokumenSk(sk({ kunci: "kp:r2", jenis: "kp", nomorSK: "W.17-PMK-1" }), dokumen, []), null);
  assert.equal(dokumenSk(sk({ kunci: "pmk:r3", jenis: "pmk", nomorSK: "W.17-PMK-1" }), dokumen, [])?.jenis, "berkas");
  // Berkas formulir inventarisasi tidak dipakai (ADR-027).
  assert.equal(dokumenSk(sk({ kunci: "kp:r4", jenis: "kp", nomorSK: "W.17-KP-LAIN" }), dokumen, []), null);
  // Tanpa nomor SK tidak ada yang dapat dicocokkan.
  assert.equal(dokumenSk(sk({ kunci: "kp:r5", jenis: "kp", nomorSK: null }), dokumen, []), null);
});

test("arsip dokumen Kanwil didahulukan atas berkas usulan; SK CPNS dari Data Pegawai ikut dicocokkan", () => {
  const dokumen = [
    dok({ id: "usulan-u1-skCpns", sumber: "usulan", jenis: "sk_cpns", nomorSK: "CPNS-9", status: "disetujui" }),
    dok({ id: "arsip-b", sumber: "arsip", jenis: "sk_cpns", nomorSK: "CPNS-9" }),
  ];
  const peta = dokumenLinimasa([sk({ kunci: "data-pegawai", jenis: "cpns", nomorSK: "CPNS-9" })], dokumen, []);
  assert.deepEqual(peta["data-pegawai"], { jenis: "berkas", url: "/berkas/arsip-b", sumber: "Arsip dokumen pegawai" });
});
