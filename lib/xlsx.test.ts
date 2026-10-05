// Berkas .xlsx: templat yang ditulis SIM-KGB terbaca kembali utuh, dan berkas buatan Excel (teks bersama,
// tanggal bernomor seri, NIP yang telanjur menjadi bilangan) terbaca seperti yang tampil di layar.
//
// Jalankan: node --import tsx --test lib/xlsx.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, unzipSync, strFromU8, zipSync } from "fflate";
import { bacaXlsx, hurufKolom, keRekaman, seriKeIso, tulisXlsx, GalatXlsx } from "./xlsx";

test("huruf kolom Excel mengikuti urutan A…Z, AA…", () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52, 701, 702].map(hurufKolom), ["A", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
});

test("isi yang ditulis terbaca kembali sama: teks berlambang, angka, tanggal, dan sel kosong di tengah", () => {
  const berkas = tulisXlsx([
    {
      nama: "Data Pegawai",
      kolom: [{ gaya: "teks" }, {}, { gaya: "tanggal" }],
      bekukanKepala: true,
      baris: [
        [{ v: "nip", gaya: "kepalaWajib" }, "nama", "tmt"],
        ["199001012025061001", 'A & B <"C">', new Date("2025-06-01T00:00:00Z")],
        ["  spasi tepi ", null, null, 7],
        [],
        ["", 12.5, "baris baru\nkedua"],
      ],
    },
    { nama: "Lain", baris: [["bukan data"]] },
  ]);
  assert.deepEqual(bacaXlsx(berkas, { lembar: "Data Pegawai" }), [
    ["nip", "nama", "tmt"],
    ["199001012025061001", 'A & B <"C">', "2025-06-01"],
    ["  spasi tepi ", "", "", "7"],
    [],
    ["", "12.5", "baris baru\nkedua"],
  ]);
  assert.deepEqual(bacaXlsx(berkas, { lembar: "Lain" }), [["bukan data"]]);
  // Nama lembar yang tidak ada: lembar pertama.
  assert.equal(bacaXlsx(berkas, { lembar: "Tidak ada" })[0][0], "nip");
});

test("daftar pilihan, format kolom, dan pembekuan judul tertulis pada lembar", () => {
  const berkas = tulisXlsx([
    { nama: "Isi", kolom: [{ gaya: "teks", lebar: 20, pilihan: ["Laki-laki", "Perempuan"] }], bekukanKepala: true, barisValidasi: 501, baris: [["jenisKelamin"]] },
  ]);
  const lembar = strFromU8(unzipSync(berkas)["xl/worksheets/sheet1.xml"]);
  assert.match(lembar, /<dataValidation type="list"[^>]*sqref="A2:A501"><formula1>"Laki-laki,Perempuan"<\/formula1>/);
  assert.match(lembar, /<col min="1" max="1" width="20" customWidth="1" style="1"\/>/);
  assert.match(lembar, /state="frozen"/);
});

test("daftar pilihan yang terlalu panjang atau berkoma ditolak saat menulis, bukan menjadi berkas rusak", () => {
  assert.throws(() => tulisXlsx([{ nama: "A", kolom: [{ pilihan: ["x".repeat(300)] }], baris: [] }]), /255/);
  assert.throws(() => tulisXlsx([{ nama: "A", kolom: [{ pilihan: ["a,b"] }], baris: [] }]), /koma/);
  assert.throws(() => tulisXlsx([{ nama: "Data/Pegawai", baris: [] }]), /Nama lembar/);
});

/** Buku kerja seperti yang disimpan Excel: teks bersama, gaya tanggal, dan sel bernomor tanpa urutan rapat. */
function bukuExcel(lembar: string, opsi: { shared?: string; styles?: string; workbookPr?: string } = {}): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "xl/workbook.xml": strToU8(
      `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${opsi.workbookPr ?? ""}` +
        `<sheets><sheet name="Sheet 1" sheetId="1" r:id="rId3"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships><Relationship Id="rId3" Type="worksheet" Target="/xl/worksheets/lembar.xml"/></Relationships>`,
    ),
    ...(opsi.shared ? { "xl/sharedStrings.xml": strToU8(opsi.shared) } : {}),
    ...(opsi.styles ? { "xl/styles.xml": strToU8(opsi.styles) } : {}),
    "xl/worksheets/lembar.xml": strToU8(`<worksheet><sheetData>${lembar}</sheetData></worksheet>`),
  });
}

const STYLES_EXCEL =
  `<styleSheet><numFmts count="1"><numFmt numFmtId="165" formatCode="[$-421]dd\\/mm\\/yyyy;@"/></numFmts>` +
  `<cellStyleXfs count="1"><xf numFmtId="14"/></cellStyleXfs>` +
  `<cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="165"/><xf numFmtId="49"/></cellXfs></styleSheet>`;

test("berkas Excel: teks bersama, tanggal bergaya bawaan maupun sendiri, rumus, dan teks kaya terbaca", () => {
  const berkas = bukuExcel(
    `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>` +
      `<row r="2"><c r="A2" s="1"><v>45809</v></c><c r="B2" s="2"><v>45809.99</v></c><c r="C2" t="str"><f>B2</f><v>teks &amp; rumus</v></c></row>` +
      `<row r="4"><c r="B4" t="s"><v>2</v></c><c r="D4" t="b"><v>1</v></c><c r="E4" t="e"><v>#N/A</v></c></row>`,
    {
      shared:
        `<sst><si><t>nip*</t></si><si><t xml:space="preserve">Golongan ruang* </t></si>` +
        `<si><r><t>SU</t></r><r><rPr><b/></rPr><t>SANTO</t></r><rPh sb="0" eb="1"><t>すさ</t></rPh></si></sst>`,
      styles: STYLES_EXCEL,
    },
  );
  assert.deepEqual(bacaXlsx(berkas), [
    ["nip*", "", "Golongan ruang* "],
    ["2025-06-01", "2025-06-01", "teks & rumus"],
    [],
    ["", "SUSANTO", "", "TRUE", ""],
  ]);
});

test("NIP yang telanjur menjadi bilangan terbaca utuh sebagai angka bulatnya, tanpa notasi ilmiah", () => {
  // Excel hanya menyimpan 15 angka berarti; tiga angka terakhir menjadi nol dan pemeriksaan NIP menolaknya.
  const berkas = bukuExcel(`<row r="1"><c r="A1"><v>1.97112051998031E+17</v></c><c r="B1" s="3" t="s"><v>0</v></c></row>`, {
    shared: `<sst><si><t>197112051998031004</t></si></sst>`,
    styles: STYLES_EXCEL,
  });
  assert.deepEqual(bacaXlsx(berkas), [["197112051998031000", "197112051998031004"]]);
});

test("sistem tanggal 1904 (Excel Mac lama) dibaca dengan titik awalnya sendiri", () => {
  assert.equal(seriKeIso(45809), "2025-06-01");
  assert.equal(seriKeIso(45809 - 1462, true), "2025-06-01");
  const berkas = bukuExcel(`<row r="1"><c r="A1" s="1"><v>44347</v></c></row>`, {
    styles: STYLES_EXCEL,
    workbookPr: `<workbookPr date1904="1"/>`,
  });
  assert.deepEqual(bacaXlsx(berkas), [["2025-06-01"]]);
});

test("berkas yang bukan .xlsx ditolak dengan pesan yang dapat dibaca operator", () => {
  assert.throws(() => bacaXlsx(strToU8("nip;nama\r\n")), GalatXlsx);
  assert.throws(() => bacaXlsx(zipSync({ "a.txt": strToU8("x") })), /bukan buku kerja Excel/);
});

test("baris lembar menjadi rekaman berkunci judul; baris kosong dibuang, kolom tanpa judul diabaikan", () => {
  assert.deepEqual(
    keRekaman(
      [
        [" nip ", "", "nama"],
        ["1", "abaikan", "A"],
        ["", "  ", ""],
        ["2"],
      ],
      (j) => j.trim().toLowerCase(),
    ),
    [
      { nip: "1", nama: "A" },
      { nip: "2", nama: "" },
    ],
  );
});
