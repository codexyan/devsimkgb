/* Isi panduan dashboard dan peran pembacanya. Dipakai halaman server (atribut data-peran di tiap bagian) dan
   komponen peramban (pilihan peran, daftar isi, tautan bagian berikutnya), jadi tanpa React. */

export const DAFTAR_ISI = [
  { id: "ringkasan", judul: "Alur singkat" },
  { id: "kewenangan", judul: "Siapa yang menetapkan KGB" },
  { id: "jadwal", judul: "Kapan KGB diberikan dan diusulkan" },
  { id: "cpns-pns", judul: "KGB pertama setelah CPNS jadi PNS" },
  { id: "kenaikan-pangkat", judul: "Kenaikan pangkat, PMK, dan KGB" },
  { id: "untuk-upt", judul: "Untuk Admin UPT" },
  { id: "di-kanwil", judul: "Di Kanwil: agenda dan disposisi" },
  { id: "di-sim-kgb", judul: "Di SIM-KGB: langkah Tim SDM" },
  { id: "hukdis", judul: "Hukuman disiplin dari UPT" },
  { id: "keuangan", judul: "Konfirmasi keuangan Kanwil" },
  { id: "pengiriman-sk", judul: "Pengiriman SK dan KPPN mitra" },
  { id: "contoh-kasus", judul: "Contoh kasus usulan satu UPT" },
  { id: "status", judul: "Arti status" },
  { id: "pertanyaan", judul: "Pertanyaan umum" },
  { id: "dasar-hukum", judul: "Dasar hukum dan rujukan" },
] as const;

export type IdBagian = (typeof DAFTAR_ISI)[number]["id"];
export type BagianPanduan = (typeof DAFTAR_ISI)[number];

export interface Peran {
  id: string;
  label: string;
  ringkas: string;
  /** Bagian yang dibaca peran ini, urut sesuai DAFTAR_ISI. */
  bagian: readonly IdBagian[];
}

export const PERAN: readonly Peran[] = [
  {
    id: "upt",
    label: "Admin UPT",
    ringkas: "Menyiapkan usulan data, melaporkan mutasi dan hukuman disiplin, lalu merekam SK yang terbit di Gaji Web satker.",
    bagian: ["ringkasan", "jadwal", "cpns-pns", "kenaikan-pangkat", "untuk-upt", "hukdis", "contoh-kasus", "status", "pertanyaan"],
  },
  {
    id: "sdm",
    label: "Tim SDM KGB",
    ringkas: "Meninjau usulan UPT, input KGB, lalu membuat, mengunggah, dan mengirim SK.",
    bagian: [
      "ringkasan", "kewenangan", "jadwal", "cpns-pns", "kenaikan-pangkat", "di-kanwil", "di-sim-kgb",
      "pengiriman-sk", "contoh-kasus", "status", "pertanyaan",
    ],
  },
  {
    id: "hukdis",
    label: "Tim SDM Hukdis",
    ringkas: "Meninjau laporan hukuman disiplin dari UPT, mencatatnya, dan memantau dampaknya pada KGB.",
    bagian: ["ringkasan", "jadwal", "hukdis", "status", "dasar-hukum"],
  },
  {
    id: "keuangan",
    label: "Keuangan Kanwil",
    ringkas: "Mengonfirmasi SK pegawai Kanwil dan merekamnya di Gaji Web; SK pegawai UPT direkam keuangan satkernya.",
    bagian: ["ringkasan", "jadwal", "cpns-pns", "keuangan", "pengiriman-sk", "status", "dasar-hukum"],
  },
  {
    id: "super",
    label: "Super Admin",
    ringkas: "Mengatur penandatangan, jadwal proses, dan keadaan khusus, serta meninjau usulan UPT.",
    bagian: ["ringkasan", "kewenangan", "di-sim-kgb", "hukdis", "keuangan", "pertanyaan", "dasar-hukum"],
  },
];

/** Pilihan "baca seluruh panduan". */
export const SEMUA = "semua";

/** Peran panduan untuk role akun; null bila role tidak dikenal (panduan lengkap yang tampil). */
export const PERAN_UNTUK_ROLE: Record<string, string> = {
  admin_upt: "upt",
  sdm_hukdis: "hukdis",
  sdm_kgb: "sdm",
  keuangan: "keuangan",
  superAdminCore: "super",
};

/** Role yang boleh membaca panduan seluruh peran. */
const ROLE_SEMUA_PERAN = "superAdminCore";

/**
 * Peran panduan yang boleh dibaca sebuah role akun.
 *
 * Hanya Super Admin membaca seluruh peran; peran lain membaca panduannya sendiri saja. Sebelumnya
 * seluruh bagian dirender untuk semua orang dan yang tidak relevan hanya disembunyikan CSS, sehingga
 * Admin UPT tinggal menekan "Semua" — atau membaca sumber halaman — untuk melihat isi kerja Kanwil.
 *
 * Role yang tidak dikenal mendapat panduan lengkap. Itu tidak terjadi setelah authGuard, yang hanya
 * meloloskan lima role di lib/auth/roles.ts; pilihan ini sekadar menjaga halaman tidak pernah kosong.
 */
export function peranBolehUntukRole(role: string | null | undefined): readonly string[] {
  if (role === ROLE_SEMUA_PERAN) return PERAN.map((p) => p.id);
  const milik = PERAN_UNTUK_ROLE[role ?? ""];
  return milik ? [milik] : PERAN.map((p) => p.id);
}

/** Bagian yang benar-benar dirender untuk sekumpulan peran, urut sesuai DAFTAR_ISI. */
export function bagianUntukPeran(boleh: readonly string[]): readonly BagianPanduan[] {
  const tampil = new Set<IdBagian>();
  for (const id of boleh) for (const b of cariPeran(id)?.bagian ?? []) tampil.add(b);
  return DAFTAR_ISI.filter((b) => tampil.has(b.id));
}

/** true bila pembaca boleh berpindah peran, yakni saat lebih dari satu peran terbuka baginya. */
export function bolehPilihPeran(boleh: readonly string[]): boolean {
  return boleh.length > 1;
}

export function cariPeran(id: string | null | undefined): Peran | null {
  return PERAN.find((p) => p.id === id) ?? null;
}

/** Id peran (dipisah spasi) yang membaca sebuah bagian; dipakai atribut data-peran di bagian itu. */
export function peranUntuk(bagian: IdBagian): string {
  return PERAN.filter((p) => p.bagian.includes(bagian))
    .map((p) => p.id)
    .join(" ");
}

/** Bagian yang tampil untuk pilihan ini; tanpa pilihan atau "semua" berarti seluruh panduan. */
export function daftarUntuk(pilihan: string | null): readonly BagianPanduan[] {
  const peran = cariPeran(pilihan);
  return peran ? DAFTAR_ISI.filter((b) => peran.bagian.includes(b.id)) : DAFTAR_ISI;
}

/**
 * Nilai pilihan yang sah bagi pembaca ini: salah satu peran yang terbuka baginya, atau "semua" ketika
 * memang lebih dari satu peran terbuka. Dipakai menjepit ?peran= di URL, supaya kuncinya tidak dapat
 * dilewati hanya dengan mengetik alamat.
 */
export function pilihanSahUntuk(nilai: string | null | undefined, boleh: readonly string[]): boolean {
  if (nilai === SEMUA) return bolehPilihPeran(boleh);
  return !!nilai && boleh.includes(nilai);
}
