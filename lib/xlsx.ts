// Berkas Excel (.xlsx) sekecil yang diperlukan: menulis templat dan membaca kembali isian UPT.
//
// Templat CSV punya satu cacat yang tidak dapat ditambal dari sisi berkasnya: Excel membaca NIP 18 angka
// sebagai bilangan, dan NIP itu rusak begitu berkasnya disimpan (lib/nipPns.ts). Berkas .xlsx dapat
// membawa format kolomnya sendiri, sehingga kolom NIP sudah bertipe Text sebelum operator mengetik apa pun,
// kolom tanggal sudah bertipe tanggal, dan kolom berpilihan sudah berupa daftar pilihan.
//
// Ditulis sendiri di atas fflate (yang sudah dipakai cadangan data) alih-alih memakai pustaka spreadsheet:
// yang dibutuhkan hanya lembar berisi teks, angka, dan tanggal, sedangkan pustaka lengkap berukuran ratusan
// KB untuk peramban. Pembacanya sengaja toleran: berkas dari Excel, LibreOffice, maupun Google Sheets
// menuliskan XML yang sedikit berbeda, dan semuanya harus terbaca sama.

import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";

/* ── Menulis ───────────────────────────────────────────────────────────── */

/** Gaya sel yang tersedia. Urutannya menjadi nomor gaya (cellXfs) pada styles.xml, jadi jangan diubah. */
const GAYA = [
  "biasa",
  "teks",
  "tanggal",
  "kepala",
  "kepalaWajib",
  "kepalaDiajukan",
  "kepalaOpsional",
  "judul",
  "bungkus",
  "tebal",
] as const;

export type GayaSel = (typeof GAYA)[number];

/** Nilai satu sel. Date ditulis sebagai tanggal kalender (jam diabaikan); null berarti sel kosong. */
export type NilaiSel = string | number | Date | null;

/** Sel bergaya; nilai polos memakai gaya kolomnya, atau "biasa". */
export interface SelXlsx {
  v: NilaiSel;
  gaya?: GayaSel;
}

export interface KolomXlsx {
  /** Lebar dalam satuan karakter Excel. */
  lebar?: number;
  /** Gaya bawaan seluruh kolom: sel yang kelak diketik operator ikut bergaya ini. */
  gaya?: GayaSel;
  /** Daftar pilihan (validasi data) untuk baris 2 sampai `barisValidasi`. */
  pilihan?: readonly string[];
}

export interface LembarXlsx {
  nama: string;
  baris: readonly (readonly (NilaiSel | SelXlsx)[])[];
  kolom?: readonly KolomXlsx[];
  /** Bekukan baris pertama agar judul kolom tetap tampil saat menggulir. */
  bekukanKepala?: boolean;
  /** Baris terakhir yang diberi daftar pilihan; bawaannya 1000. */
  barisValidasi?: number;
  /** Rentang sel yang digabung, misalnya "A1:H1". */
  gabung?: readonly string[];
}

/** Batas panjang daftar pilihan yang ditulis langsung pada aturan validasi Excel. */
export const BATAS_PILIHAN_XLSX = 255;

const esc = (s: string) =>
  s
    // Karakter kendali selain tab dan pindah baris tidak sah di XML; Excel menolak membuka berkasnya.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Nomor kolom berbasis nol menjadi huruf kolom Excel: 0 → A, 25 → Z, 26 → AA. */
export function hurufKolom(indeks: number): string {
  let n = indeks + 1;
  let s = "";
  while (n > 0) {
    const sisa = (n - 1) % 26;
    s = String.fromCharCode(65 + sisa) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Hari pertama sistem tanggal 1900 Excel, sesudah koreksi tahun kabisat 1900 yang keliru. */
const AWAL_1900 = Date.UTC(1899, 11, 30);
const AWAL_1904 = Date.UTC(1904, 0, 1);
const SEHARI = 86_400_000;

/** Tanggal kalender (dibaca dari komponen UTC-nya) menjadi nomor seri tanggal Excel. */
function keSeri(d: Date): number {
  return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - AWAL_1900) / SEHARI);
}

function selXml(ref: string, isi: NilaiSel | SelXlsx, gayaKolom: GayaSel | undefined): string {
  const sel: SelXlsx = isi !== null && typeof isi === "object" && !(isi instanceof Date) ? isi : { v: isi };
  const v = sel.v;
  const gaya = sel.gaya ?? (v instanceof Date ? "tanggal" : gayaKolom) ?? "biasa";
  const s = GAYA.indexOf(gaya);
  const atrGaya = s > 0 ? ` s="${s}"` : "";
  if (v === null || v === "") return atrGaya ? `<c r="${ref}"${atrGaya}/>` : "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    return `<c r="${ref}"${atrGaya}><v>${keSeri(v)}</v></c>`;
  }
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}"${atrGaya}><v>${v}</v></c>` : "";
  const ruang = /^\s|\s$|\n/.test(v) ? ' xml:space="preserve"' : "";
  return `<c r="${ref}"${atrGaya} t="inlineStr"><is><t${ruang}>${esc(v)}</t></is></c>`;
}

function lembarXml(l: LembarXlsx, pertama: boolean): string {
  const kolom = l.kolom ?? [];
  const lebarCol = kolom
    .map((k, i) => {
      if (!k.lebar && !k.gaya) return "";
      const s = k.gaya ? GAYA.indexOf(k.gaya) : 0;
      return `<col min="${i + 1}" max="${i + 1}" width="${k.lebar ?? 12}"${k.lebar ? ' customWidth="1"' : ""}${s > 0 ? ` style="${s}"` : ""}/>`;
    })
    .join("");

  const barisXml = l.baris
    .map((b, r) => {
      const sel = b.map((isi, c) => selXml(`${hurufKolom(c)}${r + 1}`, isi, r === 0 && l.bekukanKepala ? undefined : kolom[c]?.gaya)).join("");
      return sel ? `<row r="${r + 1}">${sel}</row>` : "";
    })
    .join("");

  const akhirValidasi = l.barisValidasi ?? 1000;
  const validasi = kolom
    .map((k, i) => {
      if (!k.pilihan?.length) return "";
      const daftar = k.pilihan.join(",");
      // Excel menolak berkas yang daftar pilihannya lebih dari 255 karakter; lebih baik gagal di sini.
      if (daftar.length > BATAS_PILIHAN_XLSX)
        throw new Error(`Daftar pilihan kolom ${hurufKolom(i)} melebihi ${BATAS_PILIHAN_XLSX} karakter`);
      if (k.pilihan.some((p) => p.includes(",") || p.includes('"')))
        throw new Error(`Pilihan kolom ${hurufKolom(i)} tidak boleh memuat koma atau petik`);
      const rentang = `${hurufKolom(i)}2:${hurufKolom(i)}${akhirValidasi}`;
      return (
        `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ` +
        `errorTitle="Pilihan tidak dikenal" error="Pilih salah satu dari daftar." sqref="${rentang}">` +
        `<formula1>"${esc(daftar)}"</formula1></dataValidation>`
      );
    })
    .filter(Boolean);

  const tampilan = l.bekukanKepala
    ? `<sheetViews><sheetView workbookViewId="0"${pertama ? ' tabSelected="1"' : ""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"${pertama ? ' tabSelected="1"' : ""}/></sheetViews>`;

  // Urutan unsur di bawah ini ditetapkan skema OOXML; Excel menganggap berkasnya rusak bila tertukar.
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    tampilan +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (lebarCol ? `<cols>${lebarCol}</cols>` : "") +
    `<sheetData>${barisXml}</sheetData>` +
    (l.gabung?.length ? `<mergeCells count="${l.gabung.length}">${l.gabung.map((g) => `<mergeCell ref="${g}"/>`).join("")}</mergeCells>` : "") +
    (validasi.length ? `<dataValidations count="${validasi.length}">${validasi.join("")}</dataValidations>` : "") +
    `<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `</worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>` +
  `<fonts count="3">` +
  `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>` +
  `</fonts>` +
  `<fills count="6">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF8CBAD"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="${GAYA.length}">` +
  /* biasa */ `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  /* teks */ `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  /* tanggal */ `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  /* kepala */ `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  /* kepalaWajib */ `<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  /* kepalaDiajukan */ `<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  /* kepalaOpsional */ `<xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  /* judul */ `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  /* bungkus */ `<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  /* tebal */ `<xf numFmtId="49" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** Susun buku kerja .xlsx dari beberapa lembar. Lembar pertama menjadi lembar yang terbuka. */
export function tulisXlsx(lembar: readonly LembarXlsx[]): Uint8Array {
  for (const l of lembar)
    if (!l.nama || l.nama.length > 31 || /[[\]:*?/\\]/.test(l.nama)) throw new Error(`Nama lembar tidak sah: "${l.nama}"`);

  const berkas: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        lembar
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        `</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
        lembar.map((l, i) => `<sheet name="${esc(l.nama)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        `</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        lembar
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${lembar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ),
    "xl/styles.xml": strToU8(STYLES_XML),
  };
  lembar.forEach((l, i) => {
    berkas[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(lembarXml(l, i === 0));
  });
  return zipSync(berkas, { level: 6 });
}

/* ── Membaca ───────────────────────────────────────────────────────────── */

const ENTITAS: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function urai(s: string): string {
  return s
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITAS[e],
    );
}

function atribut(tag: string, nama: string): string | null {
  const m = new RegExp(`(?:^|\\s)${nama}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? urai(m[1] ?? m[2] ?? "") : null;
}

/** Gabungan seluruh <t> di dalam satu potong XML, tanpa bacaan fonetik (<rPh>) yang ditambahkan Excel Asia. */
function teksT(xml: string): string {
  const tanpaFonetik = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
  let hasil = "";
  for (const m of tanpaFonetik.matchAll(/<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g)) hasil += urai(m[1] ?? "");
  return hasil;
}

/** Format bilangan bawaan Excel yang berupa tanggal. */
const FORMAT_TANGGAL_BAWAAN = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function formatTanggal(kode: string): boolean {
  // Teks berpetik, karakter terlepas, dan bagian berkurung ([Red], [$-421]) bukan penanda tanggal.
  const inti = kode.replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "");
  return /[dmy]/i.test(inti) && !/^general$/i.test(inti.trim());
}

/** Nomor seri tanggal Excel menjadi yyyy-mm-dd. Bagian jam diabaikan. */
export function seriKeIso(seri: number, sistem1904 = false): string {
  const d = new Date((sistem1904 ? AWAL_1904 : AWAL_1900) + Math.floor(seri + 1e-9) * SEHARI);
  return d.toISOString().slice(0, 10);
}

/** Bilangan menjadi teks seperti yang tampil di Excel: tanpa notasi ilmiah untuk bilangan bulat, 15 angka berarti. */
function angkaKeTeks(n: number): string {
  // JavaScript baru memakai notasi ilmiah mulai 1e21, jadi bilangan bulat di bawahnya tertulis utuh.
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(15)));
}

/** Indeks kolom berbasis nol dari rujukan sel seperti "AB12". */
function indeksKolom(ref: string): number {
  const huruf = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "";
  let n = 0;
  for (const ch of huruf) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function ambil(berkas: Record<string, Uint8Array>, jalur: string): string | null {
  const isi = berkas[jalur] ?? berkas[Object.keys(berkas).find((k) => k.toLowerCase() === jalur.toLowerCase()) ?? ""];
  return isi ? strFromU8(isi) : null;
}

/** Jalur bagian di dalam zip dari Target relasi, yang dapat relatif terhadap xl/ atau mutlak dari akar. */
function jalurTarget(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const bagian: string[] = ["xl"];
  for (const p of target.split("/")) {
    if (p === "..") bagian.pop();
    else if (p && p !== ".") bagian.push(p);
  }
  return bagian.join("/");
}

/** Berkas yang tidak dapat dibaca sebagai .xlsx; pesannya untuk operator. Nama diset sendiri agar tahan minifikasi. */
export class GalatXlsx extends Error {
  name = "GalatXlsx";
}

/**
 * Baca satu lembar .xlsx menjadi baris-baris teks. Lembarnya yang bernama `lembar` bila ada, selain itu
 * lembar pertama. Tanggal menjadi yyyy-mm-dd, bilangan menjadi teks tanpa notasi ilmiah, rumus menjadi
 * nilai terakhirnya. Baris dan sel kosong di tengah dipertahankan sebagai teks kosong.
 */
export function bacaXlsx(data: Uint8Array, opsi: { lembar?: string } = {}): string[][] {
  let berkas: Record<string, Uint8Array>;
  try {
    berkas = unzipSync(data, {
      filter: (f) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/i.test(f.name),
    });
  } catch {
    throw new GalatXlsx("Berkas bukan buku kerja Excel (.xlsx) yang utuh.");
  }

  const workbook = ambil(berkas, "xl/workbook.xml");
  const rels = ambil(berkas, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new GalatXlsx("Berkas bukan buku kerja Excel (.xlsx) yang utuh.");

  const sistem1904 = /<(?:\w+:)?workbookPr\b[^>]*\bdate1904\s*=\s*["'](?:1|true)["']/i.test(workbook);

  const lembarDaftar = [...workbook.matchAll(/<(?:\w+:)?sheet\b([^>]*?)\/?>/g)].map((m) => ({
    nama: atribut(m[1], "name") ?? "",
    id: atribut(m[1], "r:id") ?? atribut(m[1], "\\w+:id") ?? "",
  }));
  const dipilih =
    lembarDaftar.find((l) => opsi.lembar && l.nama.trim().toLowerCase() === opsi.lembar.trim().toLowerCase()) ?? lembarDaftar[0];
  if (!dipilih) throw new GalatXlsx("Buku kerja ini tidak memuat lembar apa pun.");

  const relasi = [...rels.matchAll(/<(?:\w+:)?Relationship\b([^>]*?)\/?>/g)].find((m) => atribut(m[1], "Id") === dipilih.id);
  const target = relasi ? atribut(relasi[1], "Target") : null;
  const lembarXml = target ? ambil(berkas, jalurTarget(target)) : null;
  if (!lembarXml) throw new GalatXlsx(`Lembar "${dipilih.nama}" tidak ditemukan di dalam berkas.`);

  const sharedXml = ambil(berkas, "xl/sharedStrings.xml");
  const teksBersama = sharedXml
    ? [...sharedXml.matchAll(/<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g)].map((m) => teksT(m[1] ?? ""))
    : [];

  const gayaTanggal: boolean[] = [];
  const stylesXml = ambil(berkas, "xl/styles.xml");
  if (stylesXml) {
    const formatSendiri = new Map<number, string>();
    for (const m of stylesXml.matchAll(/<(?:\w+:)?numFmt\b([^>]*?)\/?>/g))
      formatSendiri.set(Number(atribut(m[1], "numFmtId")), atribut(m[1], "formatCode") ?? "");
    const cellXfs = /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(stylesXml)?.[1] ?? "";
    for (const m of cellXfs.matchAll(/<(?:\w+:)?xf\b([^>]*?)\/?>/g)) {
      const id = Number(atribut(m[1], "numFmtId") ?? 0);
      gayaTanggal.push(FORMAT_TANGGAL_BAWAAN.has(id) || (formatSendiri.has(id) && formatTanggal(formatSendiri.get(id)!)));
    }
  }

  const hasil: string[][] = [];
  let barisBerikut = 0;
  const sheetData = /<(?:\w+:)?sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?sheetData>)/.exec(lembarXml)?.[1] ?? "";
  for (const mb of sheetData.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const r = Number(atribut(mb[1], "r") ?? 0);
    const idx = r > 0 ? r - 1 : barisBerikut;
    barisBerikut = idx + 1;
    const baris: string[] = [];
    let kolomBerikut = 0;
    for (const mc of (mb[2] ?? "").matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const ref = atribut(mc[1], "r");
      const c = ref ? indeksKolom(ref) : kolomBerikut;
      kolomBerikut = c + 1;
      const t = atribut(mc[1], "t") ?? "n";
      const s = Number(atribut(mc[1], "s") ?? 0);
      const isi = mc[2] ?? "";
      const v = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(isi)?.[1];
      let teks = "";
      if (t === "s") teks = teksBersama[Number(v)] ?? "";
      else if (t === "inlineStr") teks = teksT(/<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/.exec(isi)?.[1] ?? "");
      else if (t === "str") teks = urai(v ?? "");
      else if (t === "b") teks = v === "1" ? "TRUE" : v === "0" ? "FALSE" : "";
      else if (t === "d") teks = urai(v ?? "").slice(0, 10);
      else if (t === "e") teks = "";
      else if (v !== undefined && v.trim() !== "") {
        const n = Number(v);
        teks = Number.isNaN(n) ? urai(v) : gayaTanggal[s] ? seriKeIso(n, sistem1904) : angkaKeTeks(n);
      }
      while (baris.length < c) baris.push("");
      baris[c] = teks;
    }
    while (hasil.length < idx) hasil.push([]);
    hasil[idx] = baris;
  }
  return hasil;
}

/**
 * Baris-baris lembar menjadi rekaman berkunci judul kolom pada baris pertama, sama bentuknya dengan
 * keluaran PapaParse ber-header. Baris yang seluruhnya kosong dibuang; kolom tanpa judul diabaikan.
 */
export function keRekaman(baris: readonly (readonly string[])[], kunci: (judul: string) => string = (j) => j.trim()): Record<string, string>[] {
  const [kepala = [], ...isi] = baris;
  const judul = kepala.map((j) => (j.trim() ? kunci(j) : ""));
  return isi
    .filter((b) => b.some((v) => v.trim() !== ""))
    .map((b) => {
      const rekaman: Record<string, string> = {};
      judul.forEach((j, i) => {
        if (j) rekaman[j] = b[i] ?? "";
      });
      return rekaman;
    });
}
