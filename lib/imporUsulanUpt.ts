// Unggahan massal data pegawai oleh UPT.
//
// Mengisi satu satker berisi ratusan pegawai lewat formulir satu per satu tidak akan pernah terjadi,
// dan itulah yang menahan tujuh belas UPT tetap kosong. Modul ini membaca berkas berisi banyak baris
// menjadi banyak draf sekaligus; yang tersisa bagi operator hanyalah melengkapi yang kurang lalu
// mengirimkannya dengan satu surat.
//
// Berkasnya memakai nama kolom yang sama dengan templat impor Kanwil, sehingga satu berkas yang sama
// dapat diunggah UPT sendiri maupun diimpor Kanwil atas namanya, tanpa dua templat yang berbeda.
//
// Baris yang belum lengkap tetap diterima. Draf memang boleh belum lengkap, dan kelengkapannya baru
// ditagih saat diajukan; menolaknya di sini berarti memaksa operator menyempurnakan seluruh berkas di
// Excel lebih dulu, padahal dokumennya sering baru terkumpul belakangan.

import { BIDANG_DIISI, bacaDasarBaru, bacaIsianBaris, type DasarBaruUsulan } from "./usulanFormulir";
import { keBerkasCsv } from "./csv";
import { isJenisDasarBaru } from "./dasarBaruUsulan";
import { JENIS_KP, isJenisKp } from "./kenaikanPangkat";
import { bandingkanUsulan, kekuranganUsulan, type PerubahanUsulan } from "./usulanPegawai";
import { FORMAT_TANGGAL_DITERIMA, bacaTanggal } from "./dataPegawai";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR } from "./pilihanPegawai";
import { periksaNip } from "./nipPns";
import { GOLONGAN_PANGKAT } from "./tabelGaji";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

/** Lembar templat Excel yang dibaca saat berkasnya diunggah; lembar lain hanya untuk dibaca operator. */
export const LEMBAR_DATA_UPT = "Data Pegawai";

/** Kolom yang harus ada pada baris kepala berkas; isinya boleh kosong kecuali NIP dan nama. */
export const KOLOM_IMPOR_UPT = ["nip", "nama"] as const;

/**
 * "wajib": baris ditolak bila kosong. "diajukan": boleh kosong di draf, tetapi ditagih saat diajukan ke
 * Kanwil (kekuranganUsulan). "opsional": boleh kosong seterusnya.
 */
export type PeranKolomTemplat = "wajib" | "diajukan" | "opsional";

export const LABEL_PERAN_KOLOM: Record<PeranKolomTemplat, string> = {
  wajib: "wajib",
  diajukan: "wajib saat diajukan",
  opsional: "boleh kosong",
};

/** Kolom templat unggahan UPT beserta cara mengisinya. */
export interface KolomTemplatUpt {
  kolom: string;
  /** Nama isian yang dibaca manusia, untuk lembar panduan dan judul kolom yang ditulis bebas. */
  label: string;
  peran: PeranKolomTemplat;
  /** Bentuk isiannya; menentukan format kolom pada templat Excel. */
  jenis: "teks" | "angka" | "tanggal";
  keterangan: string;
  contoh: string;
  /** Isian yang diterima; menjadi daftar pilihan pada templat Excel. */
  pilihan?: readonly string[];
}

/** Keenam kolom sebab perubahan golongan atau masa kerja golongan (ADR-030). */
export const KOLOM_DASAR_BARU = [
  "dasarBaruJenis",
  "dasarBaruJenisKp",
  "dasarBaruNomorSk",
  "dasarBaruTanggalSk",
  "dasarBaruTmt",
  "dasarBaruPenetap",
] as const;

export type KolomDasarBaru = (typeof KOLOM_DASAR_BARU)[number];

/**
 * Kolom templat unggahan UPT: yang dibaca bacaIsianBaris, tanpa kolom hitungan (pangkat, gaji pokok,
 * TMT KGB berikutnya) yang memang tidak dibaca dari berkas. Satu daftar ini menjadi berkas templat
 * yang diunduh, lembar panduan di dalamnya, sekaligus panduan kolom di layar, agar ketiganya tidak pernah
 * berbeda. Contohnya fiktif.
 */
export const KOLOM_TEMPLAT_UPT: readonly KolomTemplatUpt[] = [
  {
    kolom: "nip",
    label: "NIP",
    peran: "wajib",
    jenis: "teks",
    keterangan:
      "18 digit angka, susunannya tanggal lahir + TMT CPNS + jenis kelamin + nomor urut. Pada templat Excel kolom ini sudah berformat Text, jadi NIP tetap utuh. Pada CSV, tulis =\"199001012025061001\" atau setel kolomnya Text sebelum mengetik; tanpa itu NIP berubah menjadi 1,99E+17 dan barisnya ditolak.",
    contoh: "199001012025061001",
  },
  { kolom: "nama", label: "Nama lengkap", peran: "wajib", jenis: "teks", keterangan: "Nama lengkap beserta gelar, sesuai SK terakhir.", contoh: "NAMA PEGAWAI CONTOH" },
  { kolom: "jabatan", label: "Jabatan", peran: "diajukan", jenis: "teks", keterangan: "Nama jabatan.", contoh: "Penjaga Tahanan" },
  {
    kolom: "jenisJabatan",
    label: "Jenis jabatan",
    peran: "opsional",
    jenis: "teks",
    keterangan: `Salah satu: ${JENIS_JABATAN.join(" · ")}.`,
    contoh: JENIS_JABATAN[0],
    pilihan: JENIS_JABATAN,
  },
  {
    kolom: "eselon",
    label: "Eselon",
    peran: "opsional",
    jenis: "teks",
    keterangan: `Salah satu: ${ESELON.join(" · ")}. Pegawai tanpa jabatan struktural: Non Eselon.`,
    contoh: ESELON[0],
    pilihan: ESELON,
  },
  {
    kolom: "golonganRuang",
    label: "Golongan/ruang",
    peran: "diajukan",
    jenis: "teks",
    keterangan:
      "Golongan/ruang sekarang menurut SK yang paling baru (SK KGB atau SK kenaikan pangkat), ditulis seperti II/a atau III/b.",
    contoh: "II/a",
    pilihan: Object.keys(GOLONGAN_PANGKAT),
  },
  {
    kolom: "tmtGolongan",
    label: "TMT golongan",
    peran: "opsional",
    jenis: "tanggal",
    keterangan: "TMT golongan sekarang, dari SK kenaikan pangkat terakhir. Bagi yang belum pernah naik pangkat, sama dengan TMT CPNS.",
    contoh: "2025-06-01",
  },
  {
    kolom: "mkgTahun",
    label: "Masa kerja golongan (tahun)",
    peran: "opsional",
    jenis: "angka",
    keterangan:
      "Masa kerja golongan pada TMT KGB terakhir, disalin dari SK KGB terakhir. Isi 0 bila belum pernah KGB; kosong dibaca 0. " +
      "Bila sesudah KGB terakhir itu pegawai naik dari golongan II ke III/a (penyesuaian ijazah atau ujian dinas), kurangi 5 tahun; " +
      "dari golongan I ke II/a, kurangi 6 tahun. Kenaikan di dalam golongan yang sama (III/a ke III/b) tidak mengubahnya. " +
      "Pada golongan III dan IV angka ini lazimnya genap; angka ganjil biasanya masa kerja golongan II yang belum dipotong.",
    contoh: "0",
  },
  { kolom: "mkgBulan", label: "Masa kerja golongan (bulan)", peran: "opsional", jenis: "angka", keterangan: "Sisa bulan masa kerja golongan, 0 sampai 11.", contoh: "0" },
  {
    kolom: "tmtKgbTerakhir",
    label: "TMT KGB terakhir",
    peran: "diajukan",
    jenis: "tanggal",
    keterangan:
      "TMT pada SK KGB terakhir. Bila belum pernah KGB, isi TMT CPNS. Jangan diganti TMT kenaikan pangkat: siklus KGB tetap berjalan dari KGB terakhir.",
    contoh: "2025-06-01",
  },
  { kolom: "tempatLahir", label: "Tempat lahir", peran: "opsional", jenis: "teks", keterangan: "Kota atau kabupaten tempat lahir.", contoh: "Banjarmasin" },
  { kolom: "tanggalLahir", label: "Tanggal lahir", peran: "opsional", jenis: "tanggal", keterangan: "Tanggal lahir; sama dengan delapan angka pertama NIP.", contoh: "1990-01-01" },
  {
    kolom: "jenisKelamin",
    label: "Jenis kelamin",
    peran: "opsional",
    jenis: "teks",
    keterangan: `Salah satu: ${JENIS_KELAMIN.join(" · ")}. Angka ke-15 NIP: 1 laki-laki, 2 perempuan.`,
    contoh: JENIS_KELAMIN[0],
    pilihan: JENIS_KELAMIN,
  },
  {
    kolom: "pendidikanTerakhir",
    label: "Pendidikan terakhir",
    peran: "opsional",
    jenis: "teks",
    keterangan: `Salah satu: ${PENDIDIKAN_TERAKHIR.join(" · ")}.`,
    contoh: "SMA/SMK",
    pilihan: PENDIDIKAN_TERAKHIR,
  },
  // Sebab golongan atau masa kerja golongan berubah, beserta SK-nya (ADR-030). Enam kolom ini kosong
  // pada baris pegawai baru dan pada baris yang hanya meremajakan jabatan atau alamat; terisi pada baris
  // pegawai tercatat yang baru naik pangkat atau baru menerima SK PMK, sehingga peremajaan sesudah
  // kenaikan pangkat periode selesai sekali unggah, bukan dibuka satu per satu di Usulan kolektif.
  // Cara mengisinya per keadaan ada di PANDUAN_DASAR_BARU.
  {
    kolom: "dasarBaruJenis",
    label: "Sebab perubahan golongan/masa kerja",
    peran: "diajukan",
    jenis: "teks",
    keterangan:
      "Hanya untuk pegawai yang sudah tercatat di SIM-KGB, bila golongan atau masa kerja golongan pada baris ini berbeda dari yang tercatat. " +
      "kp: SK kenaikan pangkat atau penyesuaian ijazah. pmk: SK peninjauan masa kerja. koreksi: yang tercatat salah ketik, tanpa SK baru. " +
      "Kosongkan untuk pegawai baru, dan bila golongan serta masa kerjanya tidak berubah.",
    contoh: "",
    pilihan: ["kp", "pmk", "koreksi"],
  },
  {
    kolom: "dasarBaruJenisKp",
    label: "Jenis kenaikan pangkat",
    peran: "diajukan",
    jenis: "teks",
    keterangan: `Hanya bila dasarBaruJenis kp, dibaca dari SK-nya. Salah satu: ${Object.keys(JENIS_KP).join(" · ")}. Selain kp, kosongkan.`,
    contoh: "",
    pilihan: Object.keys(JENIS_KP),
  },
  {
    kolom: "dasarBaruNomorSk",
    label: "Nomor SK sebab perubahan",
    peran: "diajukan",
    jenis: "teks",
    keterangan: "Nomor SK kenaikan pangkat atau SK PMK, persis seperti tertulis di SK. Wajib bila dasarBaruJenis kp atau pmk; kosongkan untuk koreksi.",
    contoh: "",
  },
  {
    kolom: "dasarBaruTanggalSk",
    label: "Tanggal SK sebab perubahan",
    peran: "diajukan",
    jenis: "tanggal",
    keterangan: "Tanggal SK itu ditetapkan, yang tertulis di dekat tanda tangan; bukan TMT-nya.",
    contoh: "",
  },
  {
    kolom: "dasarBaruTmt",
    label: "TMT SK sebab perubahan",
    peran: "diajukan",
    jenis: "tanggal",
    keterangan:
      "kp: TMT pangkat baru. pmk: TMT PMK, tidak boleh lebih awal dari TMT KGB terakhir. Tanggal inilah yang menentukan SK mana yang menjadi dasar SK KGB berikutnya: yang TMT-nya paling baru.",
    contoh: "",
  },
  {
    kolom: "dasarBaruPenetap",
    label: "Pejabat penetap SK",
    peran: "opsional",
    jenis: "teks",
    keterangan: "Jabatan pejabat yang menandatangani SK tersebut, misalnya Kepala Kantor Wilayah.",
    contoh: "",
  },
];

/** Satu keadaan pegawai beserta isian keenam kolom dasarBaru dan kolom golongan pada barisnya. */
export interface ContohDasarBaru {
  keadaan: string;
  /** Contoh perubahannya, misalnya "III/a → III/b". */
  misalnya: string;
  isian: Readonly<Record<KolomDasarBaru, string>>;
  /** Cara mengisi golongan, masa kerja golongan, dan TMT pada baris yang sama. */
  barisLain: string;
}

const tanpaDasar: Record<KolomDasarBaru, string> = {
  dasarBaruJenis: "",
  dasarBaruJenisKp: "",
  dasarBaruNomorSk: "",
  dasarBaruTanggalSk: "",
  dasarBaruTmt: "",
  dasarBaruPenetap: "",
};

/**
 * Cara mengisi keenam kolom dasarBaru menurut keadaan pegawai. Dipakai lembar panduan templat Excel, layar
 * Unggah daftar, dan halaman Panduan; diuji terhadap periksaImporUpt agar contohnya selalu lolos pemeriksaan.
 * Nomor SK-nya fiktif.
 */
export const PANDUAN_DASAR_BARU: readonly ContohDasarBaru[] = [
  {
    keadaan: "Pegawai baru: NIP belum tercatat di SIM-KGB",
    misalnya: "pendataan pertama",
    isian: tanpaDasar,
    barisLain:
      "Keenam kolom dikosongkan. Golongan dan TMT golongan diisi keadaan sekarang; masa kerja golongan dan TMT KGB terakhir dari SK KGB terakhir. " +
      "Bila sesudah KGB itu pegawai naik dari golongan II ke III/a, masa kerja golongannya dikurangi 5 tahun.",
  },
  {
    keadaan: "Sudah tercatat; golongan dan masa kerja golongan tidak berubah",
    misalnya: "hanya jabatan atau pendidikan yang diremajakan",
    isian: tanpaDasar,
    barisLain: "Keenam kolom dikosongkan. Golongan, masa kerja, dan TMT ditulis sama dengan yang tercatat.",
  },
  {
    keadaan: "Sudah tercatat; naik pangkat reguler",
    misalnya: "III/a → III/b",
    isian: {
      dasarBaruJenis: "kp",
      dasarBaruJenisKp: "reguler",
      dasarBaruNomorSk: "W.15-KP.03.01-0123",
      dasarBaruTanggalSk: "2026-03-20",
      dasarBaruTmt: "2026-04-01",
      dasarBaruPenetap: "Kepala Kantor Wilayah",
    },
    barisLain:
      "Golongan diisi golongan baru (III/b). Masa kerja golongan dan TMT golongan dihitung sistem dari SK ini; TMT KGB terakhir tetap dari SK KGB terakhir.",
  },
  {
    keadaan: "Sudah tercatat; penyesuaian ijazah",
    misalnya: "II/d → III/a",
    isian: {
      dasarBaruJenis: "kp",
      dasarBaruJenisKp: "penyesuaian_ijazah",
      dasarBaruNomorSk: "W.15-KP.03.02-0045",
      dasarBaruTanggalSk: "2026-01-15",
      dasarBaruTmt: "2026-02-01",
      dasarBaruPenetap: "Kepala Kantor Wilayah",
    },
    barisLain:
      "Golongan diisi III/a. Masa kerja golongan boleh dibiarkan seperti yang tercatat: sistem memotongnya 5 tahun sendiri. TMT KGB terakhir tidak berubah.",
  },
  {
    keadaan: "Sudah tercatat; peninjauan masa kerja (PMK)",
    misalnya: "masa kerja sebelum CPNS diperhitungkan",
    isian: {
      dasarBaruJenis: "pmk",
      dasarBaruJenisKp: "",
      dasarBaruNomorSk: "W.15-KP.04.03-0007",
      dasarBaruTanggalSk: "2026-05-08",
      dasarBaruTmt: "2026-06-01",
      dasarBaruPenetap: "Kepala Kantor Wilayah",
    },
    barisLain:
      "Golongan tetap. Masa kerja golongan diisi angka pada SK PMK, yaitu masa kerja pada TMT PMK. Pindaian SK PMK ditagih saat diajukan.",
  },
  {
    keadaan: "Sudah tercatat; yang tercatat salah ketik",
    misalnya: "masa kerja tercatat 4 tahun, di SK 6 tahun",
    isian: { ...tanpaDasar, dasarBaruJenis: "koreksi" },
    barisLain: "Golongan dan masa kerja golongan diisi angka yang benar menurut SK. Kolom dasarBaru lainnya dikosongkan.",
  },
];

/** Aturan umum keenam kolom dasarBaru, sebagai butir panduan. */
export const ATURAN_DASAR_BARU: readonly string[] = [
  "Keenam kolom ini menjawab satu pertanyaan: mengapa golongan atau masa kerja golongan pada baris ini berbeda dari yang tercatat di SIM-KGB. Bila tidak berbeda, kosongkan semuanya.",
  "Pegawai baru belum punya data pembanding, jadi kolom ini selalu dikosongkan.",
  "Satu baris hanya menyebut satu SK, yaitu SK dengan TMT paling baru. SK itulah yang tercetak sebagai dasar pada SK KGB berikutnya.",
  "Untuk kp, sistem menghitung sendiri masa kerja golongan, gaji pokok, dan TMT golongan dari SK-nya; jadwal KGB tidak bergeser.",
  "Untuk pmk, golongan tetap dan masa kerja golongan mengikuti SK PMK; jadwal KGB dapat maju.",
  `Isian kosong atau belum lengkap tidak menolak baris; yang kurang ditagih saat diajukan di Usulan kolektif. Isian yang salah tulis (misalnya "KP" atau "naik pangkat") menolak barisnya. Tanggal ditulis ${FORMAT_TANGGAL_DITERIMA}.`,
];

/** Huruf dan angka saja, huruf kecil: "Golongan ruang*" dan "golonganRuang" menjadi sama. */
const ringkasJudul = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const KUNCI_JUDUL = new Map<string, string>(
  KOLOM_TEMPLAT_UPT.flatMap((k) => [
    [ringkasJudul(k.kolom), k.kolom],
    [ringkasJudul(k.label), k.kolom],
  ]),
);

/**
 * Judul kolom pada berkas menjadi kunci templat. Judul yang ditulis sedikit berbeda (huruf besar, spasi,
 * tanda bintang wajib, atau nama isiannya seperti "Golongan/ruang") tetap dikenali; judul lain dibiarkan
 * apa adanya dan kolomnya diabaikan.
 */
export function kunciKolomTemplat(judul: string): string {
  // trim() ikut membuang BOM yang menempel pada judul kolom pertama berkas CSV.
  const bersih = judul.trim();
  return KUNCI_JUDUL.get(ringkasJudul(bersih)) ?? bersih;
}

/** Pilihan kolom dasarBaruJenis, untuk pesan tolak yang menyebutkan apa yang diterima. */
const PILIHAN_DASAR_BARU = "kp · pmk · koreksi";

/**
 * Isi berkas templat: baris kepala dan satu baris contoh. Kepala berkasnya dari lib/csv: BOM agar Excel
 * membaca UTF-8, lalu petunjuk `sep=;` agar kolomnya terbagi saat berkasnya dibuka dengan klik ganda.
 * Keduanya dibuang lagi saat berkas yang sama diunggah kembali.
 */
export function templatCsvUpt(): string {
  return keBerkasCsv([KOLOM_TEMPLAT_UPT.map((k) => k.kolom), KOLOM_TEMPLAT_UPT.map((k) => k.contoh)]);
}

/**
 * Kolom bertanggal pada berkas: isian pegawai, ditambah dua tanggal SK sebab perubahan yang bukan kolom
 * data pegawai sehingga tidak terjaring BIDANG_DIISI, padahal ditulis Excel dengan kebiasaan yang sama.
 */
const KOLOM_TANGGAL: readonly { kunci: string; label: string }[] = [
  ...BIDANG_DIISI.filter((b) => b.jenis === "tanggal").map((b) => ({ kunci: b.kunci as string, label: b.label })),
  { kunci: "dasarBaruTanggalSk", label: "Tanggal SK sebab perubahan" },
  { kunci: "dasarBaruTmt", label: "TMT SK sebab perubahan" },
];

/**
 * Tanggal pada baris berkas diseragamkan ke yyyy-mm-dd. Excel berlokal Indonesia menyimpan ulang tanggal
 * sebagai dd/mm/yyyy, jadi berkas yang disunting di Excel harus tetap terbaca, sama seperti impor Kanwil.
 */
function seragamkanTanggal(row: Record<string, unknown>): { row: Record<string, unknown> } | { galat: string } {
  const hasil = { ...row };
  for (const bidang of KOLOM_TANGGAL) {
    const dibaca = bacaTanggal(teks(row, bidang.kunci));
    if (dibaca.status === "tidak_valid")
      return { galat: `${bidang.label} tidak valid ("${teks(row, bidang.kunci)}"). Gunakan format ${FORMAT_TANGGAL_DITERIMA}.` };
    if (dibaca.status === "valid") hasil[bidang.kunci] = dibaca.tanggal.toISOString().slice(0, 10);
  }
  return { row: hasil };
}

/** Tanggal berpemisah: dua angka, lalu tahun empat angka. Bacaan bakunya hari/bulan/tahun (bacaTanggal). */
const POLA_TANGGAL_BERPEMISAH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/**
 * true bila tanggal berpemisah pada berkas ini tertulis bulan/hari/tahun, bentuk yang ditulis Excel berlokal
 * Inggris saat menyimpan CSV (12/16/1971). Buktinya angka kedua lebih dari 12 sedangkan angka pertama tidak,
 * dan tidak satu tanggal pun membuktikan sebaliknya (angka pertama lebih dari 12). Syarat kedua menjaga berkas
 * hari/bulan yang kebetulan memuat satu salah ketik agar tidak ikut tertolak seluruhnya.
 *
 * Tanpa pemeriksaan sekali sejagat berkas ini, tanggal seperti 4/1/2024 (1 April) terbaca 4 Januari tanpa
 * peringatan apa pun, sebab sebaris demi sebaris tanggal itu memang sah. Kejadian nyata 5 Oktober 2026: berkas
 * Lapas Banjarmasin yang disimpan ulang Excel berbahasa Inggris, 101 baris tertolak dan 59 sisanya bertanggal
 * tertukar.
 */
export function berkasBertanggalBulanHari(baris: readonly Record<string, unknown>[]): boolean {
  let bulanHari = false;
  for (const row of baris)
    for (const { kunci } of KOLOM_TANGGAL) {
      const cocok = POLA_TANGGAL_BERPEMISAH.exec(teks(row, kunci));
      if (!cocok) continue;
      const [a, b] = [Number(cocok[1]), Number(cocok[2])];
      if (a > 12 && b <= 12) return false;
      if (a <= 12 && b > 12) bulanHari = true;
    }
  return bulanHari;
}

/**
 * Batas baris sekali unggah. Satker terbesar di Kalimantan Selatan masih di bawah angka ini, dan
 * batasnya menjaga satu permintaan tidak melampaui waktu jalan Worker.
 */
export const BATAS_BARIS_IMPOR = 500;

/**
 * Hasil penilaian satu baris berkas.
 *
 * - "baru"      : NIP belum tercatat; barisnya menjadi draf usulan pegawai baru.
 * - "perubahan" : NIP sudah tercatat di satker ini dan ada kolom yang berbeda; barisnya menjadi draf
 *                 usulan perbaikan data atas pegawai itu.
 * - "sama"      : NIP sudah tercatat dan tidak ada satu kolom pun yang berbeda; tidak ada yang perlu
 *                 diusulkan, jadi barisnya dilewati. Ini keadaan yang paling sering terjadi ketika UPT
 *                 mengunggah daftar pegawainya secara utuh berulang kali.
 * - "ditolak"   : barisnya tidak dapat dipakai; sebabnya di `galat`.
 */
export type HasilImpor = "baru" | "perubahan" | "sama" | "ditolak";

export interface HasilBarisImpor {
  /** Nomor baris pada berkas, tidak menghitung baris kepala; dipakai menunjuk baris yang salah. */
  baris: number;
  nip: string;
  nama: string;
  hasil: HasilImpor;
  /** Sebab baris ini tidak dapat dipakai; hanya terisi bila `hasil` === "ditolak". */
  galat: string | null;
  /** Yang masih kurang sebelum draf ini boleh diajukan; baris tetap diterima. */
  kurang: string[];
  isian: Partial<UsulanPegawaiRow> | null;
  /** Pegawai yang NIP-nya cocok; terisi untuk "perubahan" dan "sama". */
  pegawaiId: string | null;
  /** Nama yang tercatat pada data induk, supaya operator tahu baris ini mengubah siapa. */
  namaTercatat: string | null;
  /** Kolom yang berbeda dari data tercatat, lama berdampingan dengan baru; hanya untuk "perubahan". */
  beda: PerubahanUsulan[];
  /** SK sebab perubahan golongan atau masa kerja golongan yang disebut baris ini (ADR-030). */
  dasarBaru: DasarBaruUsulan | null;
}

function teks(baris: Record<string, unknown>, kunci: string): string {
  const nilai = baris[kunci];
  if (nilai === null || nilai === undefined) return "";
  // Excel gemar menyimpan NIP sebagai rumus teks ="1990..." agar angka depannya tidak hilang.
  return String(nilai).replace(/^="(.*)"$/, "$1").trim();
}

/**
 * Yang sudah ada di basis data, dibaca pemanggil agar modul ini tetap murni dan dapat diuji tanpa
 * lapisan data.
 */
export interface KonteksImpor {
  /** Pegawai satker ini, dikunci NIP. Baris yang cocok menjadi usulan perbaikan, bukan ditolak. */
  pegawaiSatker: ReadonlyMap<string, PegawaiRow>;
  /**
   * NIP yang tercatat di satker lain, dipetakan ke nama satker itu. UPT tidak boleh mengusulkan
   * perbaikan atas pegawai satker lain, jadi barisnya ditolak; menyebut satkernya membuat operator
   * tahu harus menghubungi siapa, alih-alih mengira NIP-nya salah ketik.
   */
  satkerLain: ReadonlyMap<string, string>;
  /** NIP pada usulan pegawai baru yang belum selesai. */
  nipUsulan: ReadonlySet<string>;
  /**
   * Pegawai yang sedang punya usulan belum selesai. Diperiksa terpisah dari `nipUsulan` karena usulan
   * perbaikan menyimpan pegawaiId dan mengosongkan NIP, sehingga tidak terjaring pemeriksaan NIP.
   */
  pegawaiIdUsulan: ReadonlySet<string>;
}

/**
 * Periksa seluruh baris berkas. Tiap baris dinilai sendiri: satu baris yang salah tidak menggagalkan
 * yang lain, sebab berkas berisi ratusan nama hampir selalu punya satu dua baris bermasalah dan
 * menolak seluruhnya berarti operator mengulang dari awal tanpa tahu mana yang keliru.
 *
 * NIP yang sudah tercatat tidak lagi ditolak. Dulu barisnya dibuang dengan alasan "NIP sudah tercatat
 * sebagai pegawai", padahal justru itu keadaan yang paling lazim: UPT mengunggah daftar pegawainya
 * secara utuh, dan yang sudah tercatat terhitung gagal semua. Sekarang barisnya dibandingkan dengan
 * data induk, dan hanya yang benar-benar berbeda yang menjadi usulan perbaikan.
 */
export function periksaImporUpt(
  baris: readonly Record<string, unknown>[],
  konteks: KonteksImpor,
): HasilBarisImpor[] {
  const terlihat = new Set<string>();
  const bulanHari = berkasBertanggalBulanHari(baris);

  return baris.map((row, i) => {
    const nip = teks(row, "nip");
    const nama = teks(row, "nama");
    const dasar = {
      baris: i + 1,
      nip,
      nama,
      isian: null,
      kurang: [] as string[],
      pegawaiId: null,
      namaTercatat: null,
      beda: [] as PerubahanUsulan[],
      dasarBaru: null,
    };
    const tolak = (galat: string): HasilBarisImpor => ({ ...dasar, hasil: "ditolak", galat });

    // Susunan NIP diperiksa, bukan hanya panjangnya. NIP yang dirusak Excel tetap 18 digit
    // (197112000000000000), jadi pemeriksaan panjang saja meloloskannya sebagai pegawai baru ber-NIP
    // palsu; kejadian nyata 30 September 2026. Lihat lib/nipPns.ts.
    const periksa = periksaNip(nip);
    if (!periksa.ok) return tolak(periksa.galat.pesan);
    if (!nama) return tolak("Nama lengkap wajib diisi");
    if (terlihat.has(nip)) return tolak("NIP ini muncul lebih dari sekali pada berkas");
    terlihat.add(nip);

    const satkerLain = konteks.satkerLain.get(nip);
    if (satkerLain) return tolak(`NIP ini tercatat di ${satkerLain}. Mintakan pemindahannya lewat Kanwil.`);

    const tercatat = konteks.pegawaiSatker.get(nip) ?? null;
    if (tercatat && konteks.pegawaiIdUsulan.has(tercatat.id))
      return tolak("Pegawai ini sedang punya usulan yang belum selesai di Kanwil");
    if (!tercatat && konteks.nipUsulan.has(nip))
      return tolak("NIP ini sudah ada pada usulan pegawai baru yang belum selesai");

    // Berkas bertanggal bulan/hari: baris bertanggal berpemisah tidak dapat dibaca dengan pasti, jadi ditolak
    // alih-alih diam-diam tertukar. Baris yang tanggalnya sudah yyyy-mm-dd tetap terbaca.
    const ambigu = bulanHari ? KOLOM_TANGGAL.find((k) => POLA_TANGGAL_BERPEMISAH.test(teks(row, k.kunci))) : undefined;
    if (ambigu)
      return tolak(
        `Tanggal pada berkas ini tertulis bulan/hari/tahun, misalnya "${teks(row, ambigu.kunci)}" pada ${ambigu.label}: ` +
          "ciri berkas yang disimpan ulang Excel berbahasa Inggris. Tanggal seperti 4/1/2024 tidak dapat dipastikan 4 Januari " +
          "atau 1 April, jadi tidak dibaca. Unggah templat Excel (.xlsx), atau tulis tanggalnya yyyy-mm-dd.",
      );

    const seragam = seragamkanTanggal(row);
    if ("galat" in seragam) return tolak(seragam.galat);
    const dibaca = bacaIsianBaris(seragam.row);
    if ("galat" in dibaca) return tolak(dibaca.galat);

    // Sebab golongan atau masa kerja berubah (ADR-030). Nilai yang tidak dikenal ditolak di sini alih-alih
    // didiamkan: "KP" atau "naik pangkat" pada kolom ini akan tersimpan sebagai usulan tanpa sebab, lalu
    // tertahan saat diajukan tanpa petunjuk apa pun tentang apa yang salah.
    const sebab = teks(seragam.row, "dasarBaruJenis");
    if (sebab && !isJenisDasarBaru(sebab))
      return tolak(`Kolom dasarBaruJenis hanya menerima ${PILIHAN_DASAR_BARU}; tertulis "${sebab}"`);
    const jenisKp = teks(seragam.row, "dasarBaruJenisKp");
    if (sebab === "kp" && jenisKp && !isJenisKp(jenisKp))
      return tolak(`Kolom dasarBaruJenisKp hanya menerima ${Object.keys(JENIS_KP).join(" · ")}; tertulis "${jenisKp}"`);
    const dasarBaru = bacaDasarBaru((kunci) => teks(seragam.row, kunci));

    if (!tercatat) {
      return {
        ...dasar,
        hasil: "baru",
        galat: null,
        isian: dibaca.isian,
        dasarBaru,
        kurang: kekuranganUsulan({ ...dibaca.isian, ...dasarBaru, nip, nama }, "baru"),
      };
    }

    // Nama pada berkas ikut dibandingkan lewat isian, sehingga pembetulan ejaan nama pun terbaca sebagai
    // perubahan. NIP-nya sudah pasti sama, sebab pencocokannya memakai NIP.
    const beda = bandingkanUsulan(tercatat, { ...dibaca.isian, nama });
    if (beda.length === 0)
      return { ...dasar, hasil: "sama", galat: null, pegawaiId: tercatat.id, namaTercatat: tercatat.nama };

    return {
      ...dasar,
      hasil: "perubahan",
      galat: null,
      isian: { ...dibaca.isian, nama },
      dasarBaru,
      pegawaiId: tercatat.id,
      namaTercatat: tercatat.nama,
      beda,
      kurang: kekuranganUsulan({ ...dibaca.isian, ...dasarBaru, nama }, "perubahan", tercatat),
    };
  });
}

/** Ringkasan hasil pemeriksaan, untuk kalimat yang dibaca operator sebelum menyimpan. */
export function ringkasImpor(hasil: readonly HasilBarisImpor[]): {
  baru: number;
  perubahan: number;
  sama: number;
  ditolak: number;
  /** Baris yang akan tersimpan namun masih perlu dilengkapi sebelum boleh diajukan. */
  belumLengkap: number;
} {
  const hitung = (h: HasilImpor) => hasil.filter((x) => x.hasil === h).length;
  return {
    baru: hitung("baru"),
    perubahan: hitung("perubahan"),
    sama: hitung("sama"),
    ditolak: hitung("ditolak"),
    belumLengkap: hasil.filter((h) => (h.hasil === "baru" || h.hasil === "perubahan") && h.kurang.length > 0).length,
  };
}

/** Baris yang benar-benar tersimpan bila disetujui operator. */
export function dapatDisimpan(hasil: readonly HasilBarisImpor[]): HasilBarisImpor[] {
  return hasil.filter((h) => h.hasil === "baru" || h.hasil === "perubahan");
}
