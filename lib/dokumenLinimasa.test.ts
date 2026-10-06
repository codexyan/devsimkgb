// Dokumen tiap SK pada linimasa SK penetap gaji pokok (ADR-066).
//
// Jalankan: node --import tsx --test lib/dokumenLinimasa.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { cariDokumenSk, dokumenLinimasa, dokumenSk, type KgbUntukDokumen } from "./dokumenLinimasa";
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
  // Nomor sama dengan jenis lain tetap ditemukan, dengan keterangan jenis unggahannya (ADR-071).
  assert.deepEqual(dokumenSk(sk({ kunci: "kp:r2", jenis: "kp", nomorSK: "W.17-PMK-1" }), dokumen, []), {
    jenis: "berkas",
    url: "/berkas/usulan-u2-skPmk",
    sumber: "Berkas usulan UPT yang disetujui (diunggah sebagai SK peninjauan masa kerja)",
  });
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

test("baris riwayat kenaikan pangkat memakai pencocokan yang sama dengan linimasa (ADR-067)", () => {
  const dokumen = [dok({ id: "arsip-c", sumber: "arsip", jenis: "sk_pangkat", nomorSK: "SEK-2017.SA.04.05 TAHUN 2026" })];
  // Spasi dan huruf besar-kecil diabaikan; titik dan angka tidak.
  assert.equal(cariDokumenSk("kp", "sek-2017.sa.04.05 tahun  2026", dokumen)?.url, "/berkas/arsip-c");
  assert.equal(cariDokumenSk("kp", "SEK-2017.SA.04.06 TAHUN 2026", dokumen), null);
  // Jenis lain dengan nomor sama tetap ditemukan, ditandai jenis unggahannya.
  assert.match(cariDokumenSk("pmk", "SEK-2017.SA.04.05 TAHUN 2026", dokumen)?.sumber ?? "", /diunggah sebagai SK kenaikan pangkat/);
  assert.equal(cariDokumenSk("kp", "", dokumen), null);
});

test("pindaian SK dasar yang diunggah sebagai SK KGB tetap tampil di riwayat kenaikan pangkat; tanpa nomor dicocokkan menurut tanggal (ADR-071)", () => {
  const dokumen = [
    dok({ id: "arsip-dasar", sumber: "arsip", jenis: "sk_kgb", nomorSK: "SEK-1986.SA.04.05 TAHUN 2026", tanggal: "2026-01-29" }),
    dok({ id: "arsip-tanpa-nomor", sumber: "arsip", jenis: "sk_pmk", nomorSK: "", tanggal: "2026-05-08" }),
  ];
  assert.equal(cariDokumenSk("kp", "SEK-1986.SA.04.05 TAHUN 2026", dokumen)?.url, "/berkas/arsip-dasar");
  // Tanpa nomor: jenis dan tanggal SK harus sama.
  assert.equal(cariDokumenSk("pmk", "W.17-PMK-9", dokumen, "2026-05-08")?.url, "/berkas/arsip-tanpa-nomor");
  assert.equal(cariDokumenSk("pmk", "W.17-PMK-9", dokumen, "2026-05-09"), null);
  assert.equal(cariDokumenSk("kp", "W.17-PMK-9", dokumen, "2026-05-08"), null);
  // Yang jenisnya sama tetap didahulukan.
  const lagi = [...dokumen, dok({ id: "arsip-kp", sumber: "arsip", jenis: "sk_pangkat", nomorSK: "SEK-1986.SA.04.05 TAHUN 2026" })];
  assert.equal(cariDokumenSk("kp", "SEK-1986.SA.04.05 TAHUN 2026", lagi)?.url, "/berkas/arsip-kp");
});
