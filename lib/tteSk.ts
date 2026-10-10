// Pemeriksaan keutuhan TTE pada SK bertanda tangan (ADR-096). Berjalan di Worker maupun peramban: hanya Uint8Array dan
// WebCrypto, tanpa pustaka.
//
// TTE Srikandi (BSrE) adalah tanda tangan PAdES: /ByteRange menyebut bagian berkas yang ditandatangani, /Contents memuat
// CMS SignedData yang atribut bertanda tangannya menyimpan sidik bagian itu (messageDigest). Bila sidik bagian berkas sama
// dengan messageDigest, isi yang ditandatangani tidak berubah sejak ditandatangani. Kompresi atau cetak ulang ke PDF
// menulis ulang berkas, sehingga tanda tangannya hilang atau sidiknya tidak lagi cocok.
//
// Yang diperiksa hanya keutuhan isi, bukan keabsahan sertifikat penanda tangan; itu tugas layanan verifikasi BSrE atau
// pindai QR pada SK. Revisi yang ditambahkan sesudah tanda tangan, seperti data validasi jangka panjang (/DSS), sah dan
// tidak memengaruhi hasil.

export type KeadaanTte = "utuh" | "rusak" | "tanpa" | "takTerperiksa";

export interface HasilPeriksaTte {
  keadaan: KeadaanTte;
  /** Tanda tangan dokumen yang ditemukan (stempel waktu dokumen tidak dihitung). */
  jumlahTtd: number;
}

const enk = new TextEncoder();
const POLA_BYTE_RANGE = enk.encode("/ByteRange");
const POLA_OBJ = enk.encode(" obj");
const POLA_ENDOBJ = enk.encode("endobj");
const POLA_RFC3161 = enk.encode("ETSI.RFC3161");
/** OID messageDigest 1.2.840.113549.1.9.4 dalam DER. */
const OID_MESSAGE_DIGEST = Uint8Array.of(0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x04);

function cari(isi: Uint8Array, pola: Uint8Array, dari = 0, sampai = isi.length): number {
  const batas = Math.min(sampai, isi.length) - pola.length;
  luar: for (let i = Math.max(0, dari); i <= batas; i++) {
    for (let j = 0; j < pola.length; j++) if (isi[i + j] !== pola[j]) continue luar;
    return i;
  }
  return -1;
}

function cariMundur(isi: Uint8Array, pola: Uint8Array, dari: number): number {
  for (let i = Math.min(dari, isi.length - pola.length); i >= 0; i--) {
    let cocok = true;
    for (let j = 0; j < pola.length; j++)
      if (isi[i + j] !== pola[j]) {
        cocok = false;
        break;
      }
    if (cocok) return i;
  }
  return -1;
}

/** Empat bilangan setelah /ByteRange: [awal1 panjang1 awal2 panjang2]; null bila tidak terbaca. */
function bacaByteRange(isi: Uint8Array, posisi: number): [number, number, number, number] | null {
  let i = posisi + POLA_BYTE_RANGE.length;
  while (i < isi.length && isi[i] !== 0x5b /* [ */ && i - posisi < 32) i++;
  if (isi[i] !== 0x5b) return null;
  const angka: number[] = [];
  let kini = "";
  for (i++; i < isi.length && angka.length < 4; i++) {
    const c = isi[i];
    if (c >= 0x30 && c <= 0x39) kini += String.fromCharCode(c);
    else {
      if (kini) angka.push(Number(kini));
      kini = "";
      if (c === 0x5d /* ] */) break;
    }
  }
  if (angka.length !== 4 || angka.some((n) => !Number.isSafeInteger(n) || n < 0)) return null;
  const [a, b, c, d] = angka;
  if (a + b > c || c + d > isi.length) return null;
  return [a, b, c, d];
}

/** Isi /Contents (heksadesimal di antara < >) sebagai byte DER. */
function bacaContents(isi: Uint8Array, dari: number, sampai: number): Uint8Array | null {
  let hex = "";
  for (let i = dari; i < sampai; i++) {
    const c = isi[i];
    if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66)) hex += String.fromCharCode(c);
  }
  hex = hex.replace(/(00)+$/, "");
  if (hex.length < 4) return null;
  if (hex.length % 2) hex += "0";
  const hasil = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hasil.length; i++) hasil[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return hasil;
}

/** Panjang DER pada posisi `i` (byte panjang sesudah tag); null bila tidak sah. */
function panjangDer(der: Uint8Array, i: number): { panjang: number; isi: number } | null {
  const b = der[i];
  if (b === undefined) return null;
  if (b < 0x80) return { panjang: b, isi: i + 1 };
  const n = b & 0x7f;
  if (n === 0 || n > 4) return null;
  let panjang = 0;
  for (let k = 1; k <= n; k++) panjang = panjang * 256 + (der[i + k] ?? 0);
  return { panjang, isi: i + 1 + n };
}

/**
 * messageDigest pertama di CMS: milik atribut bertanda tangan penanda tangan. messageDigest berikutnya berada di token
 * stempel waktu pada atribut tak bertanda tangan, dan tidak menyangkut isi dokumen.
 */
function messageDigest(der: Uint8Array): Uint8Array | null {
  const oid = cari(der, OID_MESSAGE_DIGEST);
  if (oid < 0) return null;
  let i = oid + OID_MESSAGE_DIGEST.length;
  if (der[i] !== 0x31 /* SET */) return null;
  const set = panjangDer(der, i + 1);
  if (!set) return null;
  i = set.isi;
  if (der[i] !== 0x04 /* OCTET STRING */) return null;
  const oktet = panjangDer(der, i + 1);
  if (!oktet || oktet.isi + oktet.panjang > der.length) return null;
  return der.subarray(oktet.isi, oktet.isi + oktet.panjang);
}

const ALGORITMA: Record<number, "SHA-256" | "SHA-384" | "SHA-512"> = { 32: "SHA-256", 48: "SHA-384", 64: "SHA-512" };

async function sidik(algoritma: "SHA-256" | "SHA-384" | "SHA-512", bagian: Uint8Array[]): Promise<Uint8Array> {
  const total = bagian.reduce((n, b) => n + b.length, 0);
  const gabung = new Uint8Array(total);
  let o = 0;
  for (const b of bagian) {
    gabung.set(b, o);
    o += b.length;
  }
  return new Uint8Array(await crypto.subtle.digest(algoritma, gabung));
}

const samaByte = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Keadaan TTE berkas PDF:
 * - "tanpa": tidak ada tanda tangan digital sama sekali (pindaian tanda tangan basah, atau TTE yang terhapus kompresi);
 * - "rusak": ada tanda tangan dokumen yang sidiknya tidak cocok, berarti isi berubah sesudah ditandatangani;
 * - "utuh": semua tanda tangan dokumen yang dapat diperiksa cocok;
 * - "takTerperiksa": ada tanda tangan, tetapi bentuknya tidak dikenali pemeriksaan ini.
 */
export async function periksaTte(isi: Uint8Array): Promise<HasilPeriksaTte> {
  let utuh = 0;
  let rusak = 0;
  let takTerperiksa = 0;
  for (let p = cari(isi, POLA_BYTE_RANGE); p >= 0; p = cari(isi, POLA_BYTE_RANGE, p + POLA_BYTE_RANGE.length)) {
    const rentang = bacaByteRange(isi, p);
    if (!rentang) {
      takTerperiksa++;
      continue;
    }
    const [a, b, c, d] = rentang;
    // Stempel waktu dokumen (SubFilter ETSI.RFC3161) menyimpan sidik di TSTInfo, bukan messageDigest; dilewati.
    const awalObj = cariMundur(isi, POLA_OBJ, p);
    const akhirObj = cari(isi, POLA_ENDOBJ, c);
    const diLuarContents = (dari: number, sampai: number) => cari(isi, POLA_RFC3161, dari, sampai) >= 0;
    if (diLuarContents(Math.max(0, awalObj), a + b) || diLuarContents(c, akhirObj < 0 ? Math.min(isi.length, c + 4096) : akhirObj))
      continue;
    const der = bacaContents(isi, a + b, c);
    const md = der ? messageDigest(der) : null;
    const algoritma = md ? ALGORITMA[md.length] : undefined;
    if (!md || !algoritma) {
      takTerperiksa++;
      continue;
    }
    const hasil = await sidik(algoritma, [isi.subarray(a, a + b), isi.subarray(c, c + d)]);
    if (samaByte(hasil, md)) utuh++;
    else rusak++;
  }
  const jumlahTtd = utuh + rusak + takTerperiksa;
  if (rusak > 0) return { keadaan: "rusak", jumlahTtd };
  if (utuh > 0) return { keadaan: "utuh", jumlahTtd };
  if (takTerperiksa > 0) return { keadaan: "takTerperiksa", jumlahTtd };
  return { keadaan: "tanpa", jumlahTtd: 0 };
}

/** SHA-256 berkas utuh, heksadesimal: bukti bahwa berkas tersimpan sama persis dengan yang diunggah (ADR-096). */
export async function sha256Hex(isi: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", isi as Uint8Array<ArrayBuffer>));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Status tanda tangan yang disimpan bersama SK: TTE utuh, TTE yang bentuknya tidak dikenali, atau tanda tangan basah. */
export type StatusTtdSk = "tte" | "tte_tak_terperiksa" | "basah";

export const LABEL_STATUS_TTD: Record<StatusTtdSk, string> = {
  tte: "TTE utuh",
  tte_tak_terperiksa: "TTE (tidak dapat diperiksa)",
  basah: "Tanda tangan basah",
};

/** Pesan penolakan untuk TTE yang isinya berubah sesudah ditandatangani. */
export const PESAN_TTE_RUSAK =
  "TTE pada berkas ini tidak utuh: isinya berubah sesudah ditandatangani, misalnya karena dikompres, dicetak ulang ke PDF, " +
  "atau digabung. Unduh lagi SK asli dari Srikandi dan unggah tanpa diubah.";

/** Pesan bila berkas tanpa TTE diunggah tanpa pernyataan tanda tangan basah. */
export const PESAN_TANPA_TTE =
  "Berkas ini tidak memuat TTE. Bila ini SK TTE dari Srikandi, unggah berkas aslinya tanpa dikompres. Bila ini pindaian SK " +
  "bertanda tangan basah, centang pernyataannya lalu unggah lagi.";
