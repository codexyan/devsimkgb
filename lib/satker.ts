// Satuan kerja di lingkungan Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan
// beserta KPPN mitranya. SK kenaikan gaji berkala pegawai satker dikirim ke KPPN ini.

type Kppn = "Banjarmasin" | "Barabai" | "Tanjung" | "Kotabaru" | "Pelaihari";

type JenisSatker ="kanwil" | "lapas" | "rutan" | "bapas" | "lpka";

export interface Satker {
  kode: string;
  nama: string;
  jenis: JenisSatker;
  kppn: Kppn;
}

export const SATKER: Satker[] = [
  { kode: "kanwil", nama: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan", jenis: "kanwil", kppn: "Banjarmasin" },
  { kode: "lapas-banjarmasin", nama: "Lembaga Pemasyarakatan Kelas IIA Banjarmasin", jenis: "lapas", kppn: "Banjarmasin" },
  { kode: "lapas-narkotika-karang-intan", nama: "Lembaga Pemasyarakatan Kelas IIA Khusus Narkotika Karang Intan", jenis: "lapas", kppn: "Banjarmasin" },
  { kode: "lapas-kotabaru", nama: "Lembaga Pemasyarakatan Kelas IIA Kotabaru", jenis: "lapas", kppn: "Kotabaru" },
  { kode: "lapas-perempuan-martapura", nama: "Lembaga Pemasyarakatan Perempuan Kelas IIA Martapura", jenis: "lapas", kppn: "Banjarmasin" },
  { kode: "lapas-amuntai", nama: "Lembaga Pemasyarakatan Kelas IIB Amuntai", jenis: "lapas", kppn: "Tanjung" },
  { kode: "lapas-banjarbaru", nama: "Lembaga Pemasyarakatan Kelas IIB Banjarbaru", jenis: "lapas", kppn: "Banjarmasin" },
  { kode: "lapas-tanjung", nama: "Lembaga Pemasyarakatan Kelas IIB Tanjung", jenis: "lapas", kppn: "Tanjung" },
  { kode: "lapas-batulicin", nama: "Lembaga Pemasyarakatan Kelas III Batulicin", jenis: "lapas", kppn: "Kotabaru" },
  { kode: "rutan-barabai", nama: "Rumah Tahanan Negara Kelas IIB Barabai", jenis: "rutan", kppn: "Barabai" },
  { kode: "rutan-kandangan", nama: "Rumah Tahanan Negara Kelas IIB Kandangan", jenis: "rutan", kppn: "Barabai" },
  { kode: "rutan-marabahan", nama: "Rumah Tahanan Negara Kelas IIB Marabahan", jenis: "rutan", kppn: "Banjarmasin" },
  { kode: "rutan-pelaihari", nama: "Rumah Tahanan Negara Kelas IIB Pelaihari", jenis: "rutan", kppn: "Pelaihari" },
  { kode: "rutan-rantau", nama: "Rumah Tahanan Negara Kelas IIB Rantau", jenis: "rutan", kppn: "Barabai" },
  { kode: "rutan-tanjung", nama: "Rumah Tahanan Negara Kelas IIB Tanjung", jenis: "rutan", kppn: "Tanjung" },
  { kode: "bapas-banjarmasin", nama: "Balai Pemasyarakatan Kelas I Banjarmasin", jenis: "bapas", kppn: "Banjarmasin" },
  { kode: "bapas-amuntai", nama: "Balai Pemasyarakatan Kelas II Amuntai", jenis: "bapas", kppn: "Tanjung" },
  { kode: "bapas-batulicin", nama: "Balai Pemasyarakatan Kelas II Batulicin", jenis: "bapas", kppn: "Kotabaru" },
  { kode: "lpka-martapura", nama: "Lembaga Pembinaan Khusus Anak Kelas I Martapura", jenis: "lpka", kppn: "Banjarmasin" },
];

export const SATKER_KANWIL: Satker = SATKER.find((s) => s.jenis === "kanwil")!;

// Bentuk panjang disamakan dengan singkatan yang dipakai di daftar SATKER.
const SINGKATAN: [RegExp, string][] = [
  [/\bkantor wilayah\b/g, "kanwil"],
  [/\bdirektorat jenderal pemasyarakatan\b/g, "ditjenpas"],
  [/\blembaga pembinaan khusus anak\b/g, "lpka"],
  [/\blembaga pemasyarakatan\b/g, "lapas"],
  [/\blp\b/g, "lapas"],
  [/\brumah tahanan negara\b/g, "rutan"],
  [/\brumah tahanan\b/g, "rutan"],
  [/\bbalai pemasyarakatan\b/g, "bapas"],
  [/\bkalimantan selatan\b/g, "kalsel"],
  [/\bkls\b/g, "kelas"],
];

const ROMAWI: Record<string, string> = { "1": "i", "2": "ii", "3": "iii", "4": "iv", i: "i", ii: "ii", iii: "iii", iv: "iv" };

/** Nama satker dalam bentuk baku untuk pencocokan: huruf kecil, tanpa tanda baca, singkatan seragam. */
function kunciSatker(nama: string): string {
  let teks = nama.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const [pola, ganti] of SINGKATAN) teks = teks.replace(pola, ganti);
  const token = teks.split(" ").filter(Boolean);
  const hasil: string[] = [];
  for (let i = 0; i < token.length; i++) {
    hasil.push(token[i]);
    if (token[i] !== "kelas") continue;
    // Kelas ditulis rapat ("IIA"): "II A" dan "2A" disamakan, tetapi IIA tetap berbeda dengan IIB atau II.
    const cocok = /^(iv|i{1,3}|[1-4])([ab])?$/.exec(token[i + 1] ?? "");
    if (!cocok) continue;
    let kelas = ROMAWI[cocok[1]] + (cocok[2] ?? "");
    i++;
    if (!cocok[2] && /^[ab]$/.test(token[i + 1] ?? "")) {
      kelas += token[i + 1];
      i++;
    }
    hasil.push(kelas);
  }
  return hasil.join(" ");
}

const SATKER_PER_KUNCI = new Map(SATKER.map((s) => [kunciSatker(s.nama), s]));

/**
 * Cari satker dari teks unit kerja. Cocok bila sama dengan kode satker, atau sama dengan nama satker
 * setelah huruf besar-kecil, spasi, tanda baca, dan singkatan (Kanwil, Ditjenpas, Lapas, Rutan,
 * Bapas, LPKA, Kalsel) diseragamkan. Kelas harus sama persis. Mengembalikan undefined bila tidak cocok.
 */
export function cariSatker(unitKerja: string | null | undefined): Satker | undefined {
  if (!unitKerja) return undefined;
  const teks = unitKerja.trim();
  if (!teks) return undefined;
  return SATKER.find((s) => s.kode === teks) ?? SATKER_PER_KUNCI.get(kunciSatker(teks));
}

/** Satker dikelompokkan per KPPN, urut sesuai daftar SATKER. */
export function satkerPerKppn(): { kppn: Kppn; satker: Satker[] }[] {
  const urutan: Kppn[] = ["Banjarmasin", "Barabai", "Tanjung", "Kotabaru", "Pelaihari"];
  return urutan.map((kppn) => ({ kppn, satker: SATKER.filter((s) => s.kppn === kppn) }));
}
