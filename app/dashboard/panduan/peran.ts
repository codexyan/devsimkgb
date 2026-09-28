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
  sdm_kgb: "sdm",
  sdm_hukdis: "hukdis",
  keuangan: "keuangan",
  superAdminCore: "super",
};

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

/** Nilai pilihan yang sah: id peran atau "semua". */
export function pilihanSah(nilai: string | null | undefined): nilai is string {
  return nilai === SEMUA || !!cariPeran(nilai);
}
