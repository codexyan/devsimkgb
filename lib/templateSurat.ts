// Template surat KGB yang dapat diatur Super Admin (ADR-019).
//
// Format surat dinas bisa berganti: kop, ukuran kertas, kalimat, atau daftar tembusan. Sebelumnya semuanya
// tertulis mati di lib/generateSuratKGB.tsx, sehingga tiap perubahan menuntut pembaruan program. Kini isi dan
// tata letaknya disimpan sebagai template berversi. Setiap versi punya tanggal mulai berlaku, dan SK memakai
// versi yang berlaku pada tanggal suratnya, jadi SK lama tetap tercetak persis seperti ketika terbit.
//
// Ukuran disimpan dalam milimeter (yang dikenal pengguna) dan diubah ke poin PDF saat disusun. Templat bawaan
// meniru surat yang berlaku sampai fitur ini dibuat ("Template KGB.docx", A4), dengan ukuran yang sama persis.
//
// Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import { tanggalKalender, type NilaiTanggal } from "./waktu";

/* ── Satuan ─────────────────────────────────────────────────────────────────────────────────────── */

export const PT_PER_MM = 72 / 25.4;
export const mmKePt = (mm: number): number => mm * PT_PER_MM;
/** Poin ke milimeter, dibulatkan tiga desimal agar nilai bawaan tetap rapi di formulir. */
// Dibulatkan ke 0,1 mm agar isian formulir terbaca wajar; selisihnya di bawah 0,15 pt, tidak terlihat di cetakan.
export const ptKeMm = (pt: number): number => Math.round((pt / PT_PER_MM) * 10) / 10;

/* ── Bentuk template ────────────────────────────────────────────────────────────────────────────── */

export interface BarisKop {
  teks: string;
  tebal: boolean;
  ukuranPt: number;
  /** Geser mendatar dari tengah (pt); meniru letak baris di template Word yang tidak persis segaris tengah. */
  geserPt: number;
  /** Jarak tambahan di atas baris ini (pt). */
  jarakAtasPt: number;
}

export interface ButirTembusan {
  teks: string;
  /** Tidak dicetak bila pegawainya pegawai Kanwil (mis. "Kepala {satker}": penandatangannya Kepala Kanwil sendiri). */
  kecualiKanwil: boolean;
}

export interface IsiTemplateSurat {
  kertas: { lebarMm: number; tinggiMm: number };
  /** atasMm: awal isi surat di bawah kop. */
  margin: { atasMm: number; bawahMm: number; kiriMm: number; kananMm: number };
  huruf: { ukuranPt: number; spasi: number };
  kop: {
    /** Baris kop, dipakai semua surat apa pun penandatangannya. */
    baris: BarisKop[];
    /** "bawaan" (logo Kementerian), "tanpa", atau kunci berkas logo unggahan di R2 ("template/…"). */
    logo: string;
    logoKiriMm: number;
    logoAtasMm: number;
    logoUkuranMm: number;
    /** Awal blok teks kop dari atas halaman. */
    teksAtasMm: number;
    /** Jarak blok teks kop dari margin kiri (ruang untuk logo). */
    teksIndenMm: number;
    garis: boolean;
    garisAtasMm: number;
  };
  kepala: {
    sifat: string;
    lampiran: string;
    hal: string;
    /** Baris di bawah Hal, mis. "a.n. **{nama}**". Kosong berarti tidak dicetak. */
    atasNama: string;
    /** Tanggal di kanan atas, mis. "{tanggal_surat}" atau "Banjarmasin, {tanggal_surat}". */
    tanggal: string;
  };
  /** Tujuan surat; tiap baris dicetak sebagai baris sendiri. */
  tujuan: string;
  paragraf: { pembuka: string; dasarSk: string; hasil: string; penutup: string };
  tembusanJudul: string;
  tembusan: ButirTembusan[];
}

/* ── Isian otomatis ─────────────────────────────────────────────────────────────────────────────── */

export const PENANDA_TEMPLATE = [
  { kunci: "nama", label: "Nama pegawai" },
  { kunci: "nip", label: "NIP" },
  { kunci: "pangkat_golongan", label: "Pangkat/golongan sekarang" },
  { kunci: "satker", label: "Satker pegawai" },
  { kunci: "kppn", label: "KPPN mitra" },
  { kunci: "gaji_lama", label: "Gaji pokok lama" },
  { kunci: "gaji_baru", label: "Gaji pokok baru" },
  { kunci: "mkg_lama", label: "Masa kerja lama" },
  { kunci: "mkg_baru", label: "Masa kerja baru" },
  { kunci: "pangkat_golongan_baru", label: "Pangkat/golongan baru" },
  { kunci: "tmt_kgb", label: "TMT KGB baru" },
  { kunci: "tmt_berikutnya", label: "KGB berikutnya" },
  { kunci: "penetap_sk_dasar", label: "Penetap SK dasar" },
  { kunci: "nomor_sk_dasar", label: "Nomor SK dasar" },
  { kunci: "tanggal_sk_dasar", label: "Tanggal SK dasar" },
  { kunci: "dasar_hukum", label: "Dasar hukum (PP)" },
  { kunci: "nomor_surat", label: "Nomor surat" },
  { kunci: "tanggal_surat", label: "Tanggal surat" },
  { kunci: "jabatan_penandatangan", label: "Jabatan penandatangan" },
  { kunci: "nama_penandatangan", label: "Nama penandatangan" },
] as const;

export type KunciPenanda = (typeof PENANDA_TEMPLATE)[number]["kunci"];
export type NilaiPenanda = Record<KunciPenanda, string>;

const KUNCI_SAH = new Set<string>(PENANDA_TEMPLATE.map((p) => p.kunci));
const POLA_PENANDA = /\{([a-z_]+)\}/g;

/** Isi penanda {…} dengan nilainya. Penanda yang tidak dikenal dibiarkan apa adanya, agar kekeliruan terlihat. */
export function isiPenanda(teks: string, nilai: Partial<NilaiPenanda>): string {
  return teks.replace(POLA_PENANDA, (utuh, kunci: string) =>
    KUNCI_SAH.has(kunci) && nilai[kunci as KunciPenanda] !== undefined ? (nilai[kunci as KunciPenanda] as string) : utuh,
  );
}

/** Penanda yang tidak dikenal dalam satu teks. */
export function penandaTakDikenal(teks: string): string[] {
  const hasil: string[] = [];
  for (const m of teks.matchAll(POLA_PENANDA)) if (!KUNCI_SAH.has(m[1]) && !hasil.includes(m[1])) hasil.push(m[1]);
  return hasil;
}

/** Potong teks bertanda **tebal** menjadi potongan biasa dan tebal. */
export function potongTebal(teks: string): { teks: string; tebal: boolean }[] {
  const hasil: { teks: string; tebal: boolean }[] = [];
  const bagian = teks.split("**");
  bagian.forEach((b, i) => {
    if (b) hasil.push({ teks: b, tebal: i % 2 === 1 });
  });
  return hasil;
}

/** Alamat surel dalam baris kop dicetak miring biru, seperti tautan di template Word. */
export function potongSurel(teks: string): { teks: string; surel: boolean }[] {
  const hasil: { teks: string; surel: boolean }[] = [];
  let posisi = 0;
  for (const m of teks.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) {
    if (m.index! > posisi) hasil.push({ teks: teks.slice(posisi, m.index), surel: false });
    hasil.push({ teks: m[0], surel: true });
    posisi = m.index! + m[0].length;
  }
  if (posisi < teks.length) hasil.push({ teks: teks.slice(posisi), surel: false });
  return hasil;
}

/* ── Templat bawaan: surat yang berlaku sebelum ADR-019 ─────────────────────────────────────────── */

const KOP_BARIS_1: BarisKop = {
  teks: "KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA",
  tebal: false, ukuranPt: 10, geserPt: 2, jarakAtasPt: 0,
};

export const TEMPLATE_BAWAAN: IsiTemplateSurat = {
  kertas: { lebarMm: 210, tinggiMm: 297 },
  // Dari template Word: isi mulai 116 pt, margin bawah 14 pt, kiri 62 pt, kanan 61 pt.
  margin: { atasMm: ptKeMm(116), bawahMm: ptKeMm(14), kiriMm: ptKeMm(62), kananMm: ptKeMm(61) },
  // Arial 10,5 pt, jarak baris 13,87 pt.
  huruf: { ukuranPt: 10.5, spasi: Math.round((13.87 / 10.5) * 10000) / 10000 },
  kop: {
    baris: [
      KOP_BARIS_1,
      { teks: "DIREKTORAT JENDERAL PEMASYARAKATAN", tebal: false, ukuranPt: 10, geserPt: 0.6, jarakAtasPt: 3.7 },
      { teks: "KANTOR WILAYAH KALIMANTAN SELATAN", tebal: true, ukuranPt: 11, geserPt: 12.9, jarakAtasPt: 0 },
      {
        teks: "Jalan Jendral A. Yani Km. 5,5 No. 24, Banjarmasin, Kalimantan Selatan",
        tebal: false, ukuranPt: 10, geserPt: -7.1, jarakAtasPt: 0,
      },
      {
        teks: "Telepon 085252502005, Pos-el : kanwilditjenpaskalsel@gmail.com",
        tebal: false, ukuranPt: 10, geserPt: -7.1, jarakAtasPt: 0,
      },
    ],
    logo: "bawaan",
    logoKiriMm: ptKeMm(67.1),
    logoAtasMm: ptKeMm(32.7),
    logoUkuranMm: ptKeMm(64.8),
    teksAtasMm: ptKeMm(32.4),
    teksIndenMm: ptKeMm(50),
    garis: true,
    garisAtasMm: ptKeMm(108.1),
  },
  kepala: {
    sifat: "Segera",
    lampiran: "-",
    hal: "Kenaikan Gaji Berkala",
    atasNama: "a.n. **{nama}**",
    tanggal: "{tanggal_surat}",
  },
  tujuan: "Yth. Kepala Kantor Pelayanan Perbendaharaan Negara {kppn}\ndi tempat",
  paragraf: {
    pembuka:
      "Dengan ini diberitahukan bahwa, sesungguhnya dengan telah terpenuhinya masa kerja dan syarat – syarat lainnya atas nama:",
    dasarSk: "dan atas dasar Surat Keterangan Pembayaran (SKP) terakhir tentang Gaji/Pangkat yang ditetapkan:",
    hasil: "maka kepada yang bersangkutan dapat diberikan **kenaikan gaji berkala** hingga memperoleh :",
    penutup:
      "sesuai dengan Peraturan Pemerintah {dasar_hukum} kepada Pegawai tersebut dapat dibayarkan penghasilannya berdasarkan gaji pokok baru.",
  },
  tembusanJudul: "Tembusan :",
  tembusan: [
    { teks: "Sekretaris Jenderal Kementerian Imigrasi dan Pemasyarakatan;", kecualiKanwil: false },
    { teks: "Kepala Kantor Wilayah Regional VIII Badan Kepegawaian Negara Banjarmasin;", kecualiKanwil: false },
    { teks: "Kepala {satker};", kecualiKanwil: true },
    { teks: "Pejabat Pembuat Daftar Gaji {satker};", kecualiKanwil: false },
    { teks: "Pegawai yang bersangkutan.", kecualiKanwil: false },
  ],
};

/** Pilihan ukuran kertas cepat; ukuran lain boleh diisi sendiri. */
export const UKURAN_KERTAS = [
  { nama: "A4", lebarMm: 210, tinggiMm: 297 },
  { nama: "F4/Folio", lebarMm: 215, tinggiMm: 330 },
  { nama: "Legal", lebarMm: 216, tinggiMm: 356 },
] as const;

/* ── Normalisasi dan validasi ───────────────────────────────────────────────────────────────────── */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown, bawaan: number): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : bawaan;
};
const str = (v: unknown, bawaan: string): string => (typeof v === "string" ? v : bawaan);
const bool = (v: unknown, bawaan: boolean): boolean => (typeof v === "boolean" ? v : bawaan);

function barisKop(v: unknown, bawaan: BarisKop[]): BarisKop[] {
  if (!Array.isArray(v)) return bawaan.map((b) => ({ ...b }));
  return v.map((b) => {
    const o = obj(b);
    return {
      teks: str(o.teks, ""),
      tebal: bool(o.tebal, false),
      ukuranPt: num(o.ukuranPt, 10),
      geserPt: num(o.geserPt, 0),
      jarakAtasPt: num(o.jarakAtasPt, 0),
    };
  });
}

/**
 * Lengkapi isi template dari JSON tersimpan atau kiriman formulir: kolom yang tidak ada diisi dari templat
 * bawaan, sehingga versi lama tetap terbaca bila kelak template mendapat kolom baru.
 */
export function normalisasiTemplate(masukan: unknown): IsiTemplateSurat {
  const b = TEMPLATE_BAWAAN;
  const o = obj(masukan);
  const kertas = obj(o.kertas);
  const margin = obj(o.margin);
  const huruf = obj(o.huruf);
  const kop = obj(o.kop);
  const kepala = obj(o.kepala);
  const paragraf = obj(o.paragraf);
  return {
    kertas: { lebarMm: num(kertas.lebarMm, b.kertas.lebarMm), tinggiMm: num(kertas.tinggiMm, b.kertas.tinggiMm) },
    margin: {
      atasMm: num(margin.atasMm, b.margin.atasMm),
      bawahMm: num(margin.bawahMm, b.margin.bawahMm),
      kiriMm: num(margin.kiriMm, b.margin.kiriMm),
      kananMm: num(margin.kananMm, b.margin.kananMm),
    },
    huruf: { ukuranPt: num(huruf.ukuranPt, b.huruf.ukuranPt), spasi: num(huruf.spasi, b.huruf.spasi) },
    kop: {
      baris: barisKop(kop.baris, b.kop.baris),
      logo: str(kop.logo, b.kop.logo) || "bawaan",
      logoKiriMm: num(kop.logoKiriMm, b.kop.logoKiriMm),
      logoAtasMm: num(kop.logoAtasMm, b.kop.logoAtasMm),
      logoUkuranMm: num(kop.logoUkuranMm, b.kop.logoUkuranMm),
      teksAtasMm: num(kop.teksAtasMm, b.kop.teksAtasMm),
      teksIndenMm: num(kop.teksIndenMm, b.kop.teksIndenMm),
      garis: bool(kop.garis, b.kop.garis),
      garisAtasMm: num(kop.garisAtasMm, b.kop.garisAtasMm),
    },
    kepala: {
      sifat: str(kepala.sifat, b.kepala.sifat),
      lampiran: str(kepala.lampiran, b.kepala.lampiran),
      hal: str(kepala.hal, b.kepala.hal),
      atasNama: str(kepala.atasNama, b.kepala.atasNama),
      tanggal: str(kepala.tanggal, b.kepala.tanggal),
    },
    tujuan: str(o.tujuan, b.tujuan),
    paragraf: {
      pembuka: str(paragraf.pembuka, b.paragraf.pembuka),
      dasarSk: str(paragraf.dasarSk, b.paragraf.dasarSk),
      hasil: str(paragraf.hasil, b.paragraf.hasil),
      penutup: str(paragraf.penutup, b.paragraf.penutup),
    },
    tembusanJudul: str(o.tembusanJudul, b.tembusanJudul),
    tembusan: Array.isArray(o.tembusan)
      ? o.tembusan.map((t) => {
          const x = obj(t);
          return { teks: str(x.teks, ""), kecualiKanwil: bool(x.kecualiKanwil, false) };
        })
      : b.tembusan.map((t) => ({ ...t })),
  };
}

const POLA_LOGO = /^template\/[A-Za-z0-9._-]+\.(png|jpe?g)$/;

/** Kunci logo unggahan yang sah; dipakai juga rute pengunggah dan penyaji logo. */
export function kunciLogoSah(kunci: string): boolean {
  return POLA_LOGO.test(kunci);
}

/** Semua teks template beserta namanya, untuk memeriksa penanda. */
function semuaTeks(t: IsiTemplateSurat): [string, string][] {
  return [
    ...t.kop.baris.map((b, i): [string, string] => [`Kop baris ${i + 1}`, b.teks]),
    ["Sifat", t.kepala.sifat],
    ["Lampiran", t.kepala.lampiran],
    ["Hal", t.kepala.hal],
    ["Atas nama", t.kepala.atasNama],
    ["Tanggal surat", t.kepala.tanggal],
    ["Tujuan", t.tujuan],
    ["Paragraf pembuka", t.paragraf.pembuka],
    ["Paragraf dasar SK", t.paragraf.dasarSk],
    ["Paragraf hasil", t.paragraf.hasil],
    ["Paragraf penutup", t.paragraf.penutup],
    ["Judul tembusan", t.tembusanJudul],
    ...t.tembusan.map((b, i): [string, string] => [`Tembusan ${i + 1}`, b.teks]),
  ];
}

/** Kekeliruan yang membuat template tidak boleh disimpan; kosong berarti sah. */
export function periksaTemplate(t: IsiTemplateSurat): string[] {
  const galat: string[] = [];
  const antara = (n: number, min: number, maks: number) => Number.isFinite(n) && n >= min && n <= maks;
  if (!antara(t.kertas.lebarMm, 100, 500) || !antara(t.kertas.tinggiMm, 100, 600))
    galat.push("Ukuran kertas harus 100–500 mm lebarnya dan 100–600 mm tingginya.");
  const { atasMm, bawahMm, kiriMm, kananMm } = t.margin;
  if (![atasMm, bawahMm, kiriMm, kananMm].every((m) => antara(m, 0, 150))) galat.push("Margin harus 0–150 mm.");
  if (t.kertas.lebarMm - kiriMm - kananMm < 100) galat.push("Lebar isi surat (kertas dikurangi margin kiri dan kanan) paling sedikit 100 mm.");
  if (t.kertas.tinggiMm - atasMm - bawahMm < 120) galat.push("Tinggi isi surat (kertas dikurangi margin atas dan bawah) paling sedikit 120 mm.");
  if (!antara(t.huruf.ukuranPt, 7, 16)) galat.push("Ukuran huruf isi harus 7–16 pt.");
  if (!antara(t.huruf.spasi, 0.9, 2.5)) galat.push("Spasi baris harus 0,9–2,5.");
  for (const [nama, daftar] of [["Kop", t.kop.baris]] as const) {
    if (daftar.length > 8) galat.push(`${nama} paling banyak 8 baris.`);
    if (daftar.some((b) => !antara(b.ukuranPt, 6, 24))) galat.push(`Ukuran huruf ${nama.toLowerCase()} harus 6–24 pt.`);
    if (daftar.some((b) => !antara(b.geserPt, -100, 100) || !antara(b.jarakAtasPt, 0, 60)))
      galat.push(`Geser baris ${nama.toLowerCase()} harus -100–100 pt dan jarak atasnya 0–60 pt.`);
  }
  if (!["bawaan", "tanpa"].includes(t.kop.logo) && !kunciLogoSah(t.kop.logo)) galat.push("Logo kop tidak dikenal.");
  if (!antara(t.kop.logoUkuranMm, 5, 60)) galat.push("Ukuran logo harus 5–60 mm.");
  if (![t.kop.logoKiriMm, t.kop.logoAtasMm, t.kop.teksAtasMm, t.kop.teksIndenMm, t.kop.garisAtasMm].every((m) => antara(m, 0, 200)))
    galat.push("Letak logo, teks kop, dan garis kop harus 0–200 mm.");
  if (t.tembusan.length > 12) galat.push("Tembusan paling banyak 12 butir.");
  for (const [nama, teks] of semuaTeks(t)) {
    if (teks.length > 1200) galat.push(`${nama} terlalu panjang (paling banyak 1.200 karakter).`);
    const asing = penandaTakDikenal(teks);
    if (asing.length > 0) galat.push(`${nama} memuat isian yang tidak dikenal: ${asing.map((a) => `{${a}}`).join(", ")}.`);
  }
  return galat;
}

/* ── Versi ──────────────────────────────────────────────────────────────────────────────────────── */

export interface VersiTemplate {
  id: string;
  versi: number;
  berlakuMulai: NilaiTanggal;
  isi: IsiTemplateSurat;
}

const hariKe = (t: NilaiTanggal): number | null => {
  const k = tanggalKalender(t);
  return k ? Date.UTC(k.getFullYear(), k.getMonth(), k.getDate()) : null;
};

/**
 * Versi yang berlaku pada tanggal surat: tanggal mulai berlaku terakhir yang tidak melewati tanggal surat
 * (menurut kalender WITA); bila beberapa versi mulai pada hari yang sama, nomor versi terbesar. Tanpa versi
 * yang cocok, templat bawaan.
 */
export function pilihVersi<T extends VersiTemplate>(daftar: readonly T[], tanggalSurat: NilaiTanggal): T | null {
  const surat = hariKe(tanggalSurat);
  if (surat === null) return null;
  let terpilih: T | null = null;
  let hariTerpilih = -Infinity;
  for (const v of daftar) {
    const mulai = hariKe(v.berlakuMulai);
    if (mulai === null || mulai > surat) continue;
    if (mulai > hariTerpilih || (mulai === hariTerpilih && terpilih && v.versi > terpilih.versi)) {
      terpilih = v;
      hariTerpilih = mulai;
    }
  }
  return terpilih;
}

/** Isi template untuk tanggal surat: versi yang berlaku, atau templat bawaan. */
export function templateUntuk(daftar: readonly VersiTemplate[], tanggalSurat: NilaiTanggal): IsiTemplateSurat {
  return pilihVersi(daftar, tanggalSurat)?.isi ?? TEMPLATE_BAWAAN;
}

/** Keadaan versi terhadap hari ini: yang sedang berlaku, yang terjadwal, atau riwayat. */
export function keadaanVersi<T extends VersiTemplate>(
  daftar: readonly T[],
  hariIni: NilaiTanggal,
): Map<string, "aktif" | "terjadwal" | "riwayat"> {
  const aktif = pilihVersi(daftar, hariIni);
  const hari = hariKe(hariIni) ?? 0;
  return new Map(
    daftar.map((v) => [
      v.id,
      v.id === aktif?.id ? "aktif" : (hariKe(v.berlakuMulai) ?? 0) > hari ? "terjadwal" : "riwayat",
    ]),
  );
}
