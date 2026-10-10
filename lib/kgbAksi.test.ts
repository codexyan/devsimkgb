import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
import { badanArsipKgb, namaBerkasSk, nomorUrutSk, susunZipSk, tautanBerkasSk } from "./kgbAksi";

test("namaBerkasSk: nomor urut surat, TTE atau TTD, KGB, lalu nama pegawai (ADR-097)", () => {
  assert.equal(namaBerkasSk({ nomorSurat: "WP.19-SA.04.04-1758", nama: "Abdul Hayat", versi: "tte" }), "1758 TTE KGB Abdul Hayat.pdf");
  assert.equal(namaBerkasSk({ nomorSurat: "WP.19-SA.04.04-1758", nama: "Abdul Hayat", versi: "basah" }), "1758 TTD KGB Abdul Hayat.pdf");
});

test("namaBerkasSk: karakter terlarang diganti, nama kosong diberi cadangan, tanpa nomor tetap bernama", () => {
  assert.equal(namaBerkasSk({ nomorSurat: "1760", nama: 'A/B: "C"?', versi: "tte" }), "1760 TTE KGB A B C.pdf");
  assert.equal(namaBerkasSk({ nomorSurat: null, nama: "  ", versi: "basah" }), "TTD KGB Pegawai.pdf");
  assert.equal(namaBerkasSk({ nomorSurat: "-", nama: "Siti", versi: "tte" }), "TTE KGB Siti.pdf");
});

test("nomorUrutSk: angka di ujung nomor surat; tanpa angka, nomor utuh yang aman untuk nama berkas", () => {
  assert.equal(nomorUrutSk("WP.19-SA.04.04-1805"), "1805");
  assert.equal(nomorUrutSk("W.19-KP.04.03/0099 "), "0099");
  assert.equal(nomorUrutSk("SK/KHUSUS"), "SK-KHUSUS");
  assert.equal(nomorUrutSk("  "), null);
});

/** Angka SK pembanding; isinya tidak disimpan, hanya dicocokkan server (ADR-035). */
const angkaSk = { mkgTahunSK: "14", mkgBulanSK: "0", gajiPokokSK: "3.607.500" };

test("badanArsipKgb: penetap dikirim sebagai penetap SK dasar dan penetap arsip bila diisi", () => {
  const badan = badanArsipKgb("p1", {
    nomorSK: " W.19-1/2026 ",
    tanggalSK: "2026-04-10",
    tmtSK: "2026-06-01",
    penetapSkArsip: " Kepala Kantor Wilayah ",
    ...angkaSk,
  });
  assert.deepEqual(badan, {
    pegawaiId: "p1",
    nomorSK: "W.19-1/2026",
    tanggalSK: "2026-04-10",
    tmtSK: "2026-06-01",
    isArsip: true,
    mkgTahunSK: "14",
    mkgBulanSK: "0",
    gajiPokokSK: "3.607.500",
    penetapSkDasar: "Kepala Kantor Wilayah",
    penetapSkArsip: "Kepala Kantor Wilayah",
  });
});

test("badanArsipKgb: penetap kosong tidak dikirim, angka SK tetap ikut", () => {
  const badan = badanArsipKgb("p1", {
    nomorSK: "X",
    tanggalSK: "2026-04-10",
    tmtSK: "2026-06-01",
    penetapSkArsip: " ",
    ...angkaSk,
  });
  assert.equal("penetapSkDasar" in badan, false);
  assert.equal("penetapSkArsip" in badan, false);
  assert.equal(badan.isArsip, true);
  // Angka pembanding wajib ikut: tanpanya server menolak pengarsipan.
  assert.equal(badan.mkgTahunSK, "14");
  assert.equal(badan.gajiPokokSK, "3.607.500");
});

test("tautanBerkasSk: path berkas di-encode", () => {
  assert.equal(tautanBerkasSk("sk/1_2.pdf"), "/api/blob/download?url=sk%2F1_2.pdf");
});

test("susunZipSk: satu ZIP berisi PDF apa adanya, urut sesuai daftar (ADR-095)", async () => {
  const pdf = (isi: string) => new TextEncoder().encode(`%PDF-1.4 ${isi}`);
  const zip = await susunZipSk([
    { nama: "001 - A.pdf", isi: pdf("satu") },
    { nama: "002 - B.pdf", isi: pdf("dua") },
  ]);
  const isi = unzipSync(zip);
  assert.deepEqual(Object.keys(isi), ["001 - A.pdf", "002 - B.pdf"]);
  assert.equal(new TextDecoder().decode(isi["002 - B.pdf"]), "%PDF-1.4 dua");
});
