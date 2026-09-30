// Inventarisasi data KGB pegawai Kanwil lewat formulir publik (/inventarisasi-kgb).
//
// Formulir mengirim isian dan pindaian SK langsung ke Google Apps Script milik Tim SDM
// (docs/inventarisasi-kgb/Code.gs), yang menyimpannya di Google Drive: satu folder per pegawai, dipisah
// antara pegawai yang sudah dan belum pernah KGB, ditambah satu baris per pegawai di Google Sheet rekap.
// Server SIM-KGB tidak ikut mengolah berkas, karena Worker Cloudflare dibatasi 10 ms CPU per permintaan.
//
// Nama folder, nama berkas, dan kolom rekap ditentukan di sini (murni dan teruji); skrip Drive hanya
// membersihkan dan menjalankannya.

import { BATAS_UNGGAH_BYTE } from "./batasUnggah";
import { SATKER } from "./satker";
import { GOLONGAN_PANGKAT } from "./tabelGaji";
import { formatTanggalId } from "./waktu";

export type KeadaanKgb = "pernah" | "belum";

export const FOLDER_KEADAAN: Record<KeadaanKgb, string> = {
  pernah: "01 Pernah KGB",
  belum: "02 Belum Pernah KGB",
};

export const LABEL_KEADAAN: Record<KeadaanKgb, string> = {
  pernah: "Sudah pernah KGB",
  belum: "Belum pernah KGB",
};

export type JenisBerkasInventaris = "SK-KGB-Terakhir" | "SK-KP-Terakhir" | "SK-PMK" | "SK-CPNS" | "SK-PNS";

export interface AturanBerkas {
  jenis: JenisBerkasInventaris;
  label: string;
  keterangan: string;
  wajib: boolean;
}

/** Berkas per keadaan, sama dengan aturan berkas usulan data di SIM-KGB (lib/usulanPegawai.ts). */
export const BERKAS_KEADAAN: Record<KeadaanKgb, readonly AturanBerkas[]> = {
  pernah: [
    { jenis: "SK-KGB-Terakhir", label: "SK KGB terakhir", keterangan: "SK kenaikan gaji berkala yang terakhir diterima.", wajib: true },
    {
      jenis: "SK-KP-Terakhir",
      label: "SK kenaikan pangkat terakhir",
      keterangan:
        "SK yang menetapkan golongan Anda sekarang, yaitu SK kenaikan pangkat yang paling baru, termasuk SK penyesuaian ijazah (PI). Bila belum pernah naik pangkat, unggah SK CPNS.",
      wajib: true,
    },
  ],
  belum: [
    { jenis: "SK-CPNS", label: "SK CPNS", keterangan: "Keputusan pengangkatan CPNS.", wajib: true },
    {
      jenis: "SK-PNS",
      label: "SK PNS",
      keterangan: "Keputusan pengangkatan menjadi PNS, bila sudah terbit.",
      wajib: false,
    },
  ],
};

/** SK peninjauan masa kerja, wajib bagi pegawai yang mendapat PMK setelah KGB terakhir. */
const BERKAS_PMK: AturanBerkas = {
  jenis: "SK-PMK",
  label: "SK peninjauan masa kerja (PMK)",
  keterangan: "SK PMK yang terbit setelah KGB terakhir.",
  wajib: true,
};

/** Berkas yang diminta untuk isian ini: berkas keadaannya, ditambah SK PMK bila ada PMK setelah KGB terakhir. */
export function berkasUntuk(isian: Pick<IsianInventaris, "keadaan" | "pmkSetelahKgb">): readonly AturanBerkas[] {
  const dasar = BERKAS_KEADAAN[isian.keadaan];
  return isian.keadaan === "pernah" && isian.pmkSetelahKgb === "ya" ? [...dasar, BERKAS_PMK] : dasar;
}

export const BATAS_BERKAS_INVENTARIS_BYTE = BATAS_UNGGAH_BYTE;
/** Berkas terbanyak dalam satu kiriman (SK KGB, SK kenaikan pangkat, SK PMK). */
export const BERKAS_MAKS_PER_KIRIMAN = 3;

/** Jawaban ya/tidak; kosong pada kiriman sebelum pertanyaannya ada. */
export type NaikSetelahKgb = "" | "ya" | "tidak";

export interface IsianInventaris {
  keadaan: KeadaanKgb;
  nip: string;
  nama: string;
  tempatLahir: string;
  /** yyyy-mm-dd */
  tanggalLahir: string;
  jabatan: string;
  bidang: string;
  golonganRuang: string;
  /** yyyy-mm-dd */
  tmtGolongan: string;
  /**
   * Pernah KGB: apakah kenaikan pangkat terakhir (termasuk penyesuaian ijazah) ber-TMT setelah KGB terakhir.
   * Bila "ya", golongan dan MKG diambil dari SK kenaikan pangkat itu, bukan dari SK KGB terakhir: kenaikan
   * lintas golongan memotong MKG (II/x ke III/a dipotong 5 tahun), jadi MKG pada SK KGB lama tidak berlaku lagi.
   */
  naikSetelahKgb: NaikSetelahKgb;
  /**
   * Pernah KGB: apakah ada SK peninjauan masa kerja (PMK) ber-TMT setelah KGB terakhir. PMK menambah MKG dan
   * menetapkan gaji pokok baru, dan tidak seperti kenaikan pangkat, dapat menggeser jadwal KGB berikutnya.
   */
  pmkSetelahKgb: NaikSetelahKgb;
  /** TMT PMK, yyyy-mm-dd; hanya bila pmkSetelahKgb "ya". */
  tmtPmk: string;
  /** Tanggal SK PMK, yyyy-mm-dd; hanya bila pmkSetelahKgb "ya". */
  tanggalSkPmk: string;
  /**
   * Pernah KGB: MKG pada SK terbaru yang menetapkan gaji pokok: SK KGB terakhir, atau SK kenaikan pangkat/PI atau
   * SK PMK bila terbit setelahnya.
   */
  mkgTahun: string;
  mkgBulan: string;
  /** Pernah KGB: TMT KGB terakhir. Belum pernah: TMT CPNS. yyyy-mm-dd */
  tmtDasar: string;
  /** Pernah KGB: SK KGB terakhir. Belum pernah: SK CPNS. */
  nomorSkDasar: string;
  /** yyyy-mm-dd */
  tanggalSkDasar: string;
  /** Pernah KGB: tanggal SK kenaikan pangkat terakhir. Belum pernah: tanggal SK PNS (bila ada). yyyy-mm-dd */
  tanggalSkPendukung: string;
  nomorWa: string;
  catatan: string;
  /** Kode satker pengisi; hanya pada kegiatan yang templatenya memakai satker (lib/kegiatanInventaris.ts). */
  satker?: string;
}

const RAPIKAN = (s: string) => s.replace(/\s+/g, " ").trim();

/** Nama folder pegawai: "NIP - Nama". Karakter yang dilarang di nama berkas Drive/Windows dibuang. */
export function namaFolderPegawai(nip: string, nama: string): string {
  const bersih = RAPIKAN(nama.replace(/[\\/:*?"<>|]/g, " "));
  return `${nip} - ${bersih}`.slice(0, 120);
}

/**
 * Nama berkas: "NIP_JenisSK_TanggalSK.pdf", mis. 199001012015031001_SK-KGB-Terakhir_2024-10-01.pdf. NIP di depan
 * agar berkas tetap dikenali walau dipindah dari foldernya; tanggal SK membedakan SK yang sejenis.
 */
export function namaBerkasInventaris(nip: string, jenis: JenisBerkasInventaris, tanggalSk: string): string {
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(tanggalSk) ? `_${tanggalSk}` : "";
  return `${nip}_${jenis}${tanggal}.pdf`;
}

/** Tanggal SK yang dipakai pada nama berkas tiap jenis. */
export function tanggalUntukBerkas(isian: IsianInventaris, jenis: JenisBerkasInventaris): string {
  if (jenis === "SK-PMK") return isian.tanggalSkPmk ?? "";
  return jenis === "SK-KGB-Terakhir" || jenis === "SK-CPNS" ? isian.tanggalSkDasar : isian.tanggalSkPendukung;
}

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal lahir yang tertulis di NIP (8 angka pertama), yyyy-mm-dd, atau "" bila bukan tanggal yang sah. */
export function tanggalLahirDariNip(nip: string): string {
  if (!/^\d{18}$/.test(nip)) return "";
  const iso = `${nip.slice(0, 4)}-${nip.slice(4, 6)}-${nip.slice(6, 8)}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : "";
}

/** Awal bulan TMT CPNS yang tertulis di NIP (angka ke-9 sampai 14), yyyy-mm-01, atau "" bila tidak sah. */
export function tmtCpnsDariNip(nip: string): string {
  if (!/^\d{18}$/.test(nip)) return "";
  const bulan = Number(nip.slice(12, 14));
  return bulan >= 1 && bulan <= 12 ? `${nip.slice(8, 12)}-${nip.slice(12, 14)}-01` : "";
}

/** Usia pegawai yang wajar pada tanggal lahir yang diisi (CPNS paling muda 18 tahun, pensiun paling lambat 65). */
const USIA_MIN = 18;
const USIA_MAKS = 65;

/**
 * Kekurangan isian sebelum dikirim; kosong berarti siap. Berkas diperiksa terpisah di formulir. `hariIni`
 * (yyyy-mm-dd) hanya dipakai untuk memeriksa usia.
 */
export function periksaIsianInventaris(
  isian: IsianInventaris,
  hariIni = new Date().toISOString().slice(0, 10),
  /** Kode satker yang boleh dipilih pada kegiatan ini; tanpa nilai berarti kegiatan tanpa isian satker. */
  satkerBoleh?: readonly string[],
): string[] {
  const kurang: string[] = [];
  if (satkerBoleh && !satkerBoleh.includes(isian.satker ?? "")) kurang.push("satker tempat Anda bertugas");
  if (!/^\d{18}$/.test(isian.nip)) kurang.push("NIP harus 18 angka");
  if (RAPIKAN(isian.nama).length < 3) kurang.push("nama lengkap");
  if (RAPIKAN(isian.tempatLahir).length < 3) kurang.push("tempat lahir");
  const lahirNip = tanggalLahirDariNip(isian.nip);
  if (!TANGGAL.test(isian.tanggalLahir)) kurang.push("tanggal lahir");
  else if (lahirNip && isian.tanggalLahir !== lahirNip)
    kurang.push(`tanggal lahir tidak sama dengan NIP (NIP Anda menunjukkan ${lahirNip.split("-").reverse().join("-")})`);
  else {
    const usia = Number(hariIni.slice(0, 4)) - Number(isian.tanggalLahir.slice(0, 4)) - (hariIni.slice(5) < isian.tanggalLahir.slice(5) ? 1 : 0);
    if (usia < USIA_MIN || usia > USIA_MAKS) kurang.push("tanggal lahir tidak wajar; periksa tahunnya");
  }
  if (RAPIKAN(isian.jabatan).length < 2) kurang.push("jabatan");
  if (!Object.prototype.hasOwnProperty.call(GOLONGAN_PANGKAT, isian.golonganRuang)) kurang.push("golongan ruang");
  if (!TANGGAL.test(isian.tmtGolongan)) kurang.push("TMT golongan");
  if (!TANGGAL.test(isian.tmtDasar)) kurang.push(isian.keadaan === "pernah" ? "TMT KGB terakhir" : "TMT CPNS");
  if (!RAPIKAN(isian.nomorSkDasar)) kurang.push(isian.keadaan === "pernah" ? "nomor SK KGB terakhir" : "nomor SK CPNS");
  if (!TANGGAL.test(isian.tanggalSkDasar)) kurang.push(isian.keadaan === "pernah" ? "tanggal SK KGB terakhir" : "tanggal SK CPNS");
  if (isian.keadaan === "pernah") {
    const th = Number(isian.mkgTahun);
    const bl = Number(isian.mkgBulan || "0");
    if (!/^\d{1,2}$/.test(isian.mkgTahun) || th > 40) kurang.push("masa kerja golongan (tahun)");
    if (!/^\d{0,2}$/.test(isian.mkgBulan) || bl > 11) kurang.push("masa kerja golongan (bulan) 0 sampai 11");
    if (!TANGGAL.test(isian.tanggalSkPendukung)) kurang.push("tanggal SK kenaikan pangkat terakhir");
    // KGB pertama paling cepat satu tahun sesudah TMT CPNS, jadi TMT KGB terakhir tidak mungkin pada atau
    // sebelum TMT CPNS. Pola ini muncul bila CPNS yang belum pernah KGB memilih "Sudah pernah KGB".
    const tmtCpns = tmtCpnsDariNip(isian.nip);
    if (tmtCpns && TANGGAL.test(isian.tmtDasar) && isian.tmtDasar <= tmtCpns)
      kurang.push("TMT KGB terakhir tidak sesudah TMT CPNS pada NIP: bila belum pernah menerima SK KGB, pilih Belum pernah KGB");
    const dijawab = (v: string | undefined) => v === "ya" || v === "tidak";
    if (!dijawab(isian.naikSetelahKgb) || !dijawab(isian.pmkSetelahKgb)) {
      kurang.push(
        "jawab apakah ada SK kenaikan pangkat/PI atau SK PMK setelah KGB terakhir (muat ulang halaman bila pertanyaannya tidak tampil)",
      );
    } else {
      // Tanggal ISO dapat dibandingkan sebagai teks. TMT yang sama dengan TMT KGB terakhir diterima.
      if (TANGGAL.test(isian.tmtGolongan) && TANGGAL.test(isian.tmtDasar)) {
        if (isian.naikSetelahKgb === "ya" && isian.tmtGolongan < isian.tmtDasar)
          kurang.push("TMT golongan lebih awal dari TMT KGB terakhir, padahal Anda menjawab naik pangkat setelah KGB terakhir");
        if (isian.naikSetelahKgb === "tidak" && isian.tmtGolongan > isian.tmtDasar)
          kurang.push(
            "TMT golongan sesudah TMT KGB terakhir: pada pertanyaan SK setelah KGB terakhir pilih Kenaikan pangkat atau PI, lalu isi MKG dari SK terbaru",
          );
      }
      if (isian.pmkSetelahKgb === "ya") {
        if (!TANGGAL.test(isian.tmtPmk ?? "")) kurang.push("TMT PMK");
        else if (TANGGAL.test(isian.tmtDasar) && isian.tmtPmk < isian.tmtDasar)
          kurang.push("TMT PMK lebih awal dari TMT KGB terakhir: PMK itu sudah tercakup dalam SK KGB terakhir, jadi pilih jawaban tanpa PMK");
        if (!TANGGAL.test(isian.tanggalSkPmk ?? "")) kurang.push("tanggal SK PMK");
      }
    }
  }
  if (isian.nomorWa && !/^(\+?62|0)8\d{7,12}$/.test(isian.nomorWa.replace(/[\s-]/g, "")))
    kurang.push("nomor WhatsApp tidak valid");
  return kurang;
}

/** Judul kolom Google Sheet rekap; urutannya dipakai skrip Drive apa adanya. */
export const KOLOM_REKAP = [
  "Waktu kiriman",
  "Kiriman ke",
  "Keadaan KGB",
  "NIP",
  "Nama",
  "Tempat lahir",
  "Tanggal lahir",
  "Jabatan",
  "Bidang/Bagian",
  "Golongan ruang",
  "Pangkat",
  "TMT golongan",
  "Naik pangkat setelah KGB terakhir",
  "PMK setelah KGB terakhir",
  "TMT PMK",
  "Tanggal SK PMK",
  "MKG tahun",
  "MKG bulan",
  "TMT KGB terakhir / TMT CPNS",
  "Nomor SK dasar",
  "Tanggal SK dasar",
  "Tanggal SK KP terakhir / SK PNS",
  "Nomor WhatsApp",
  "Catatan",
  "Satker",
] as const;

/**
 * Nilai kolom rekap untuk satu isian, mulai kolom "Keadaan KGB" (dua kolom pertama diisi skrip Drive).
 * Pegawai yang belum pernah KGB tercatat dengan masa kerja golongan 0 tahun 0 bulan. MKG berasal dari SK terbaru
 * yang menetapkan gaji pokok: SK kenaikan pangkat/PI atau SK PMK bila kolomnya berisi Ya, selain itu SK KGB terakhir.
 */
export function barisRekap(isian: IsianInventaris): string[] {
  const belum = isian.keadaan === "belum";
  const yaTidak = (v: string | undefined) => (belum ? "" : v === "ya" ? "Ya" : v === "tidak" ? "Tidak" : "");
  const pmk = !belum && isian.pmkSetelahKgb === "ya";
  return [
    LABEL_KEADAAN[isian.keadaan],
    isian.nip,
    RAPIKAN(isian.nama),
    RAPIKAN(isian.tempatLahir),
    isian.tanggalLahir,
    RAPIKAN(isian.jabatan),
    RAPIKAN(isian.bidang),
    isian.golonganRuang,
    GOLONGAN_PANGKAT[isian.golonganRuang as keyof typeof GOLONGAN_PANGKAT] ?? "",
    isian.tmtGolongan,
    yaTidak(isian.naikSetelahKgb),
    yaTidak(isian.pmkSetelahKgb),
    pmk ? isian.tmtPmk : "",
    pmk ? isian.tanggalSkPmk : "",
    belum ? "0" : String(Number(isian.mkgTahun)),
    belum ? "0" : String(Number(isian.mkgBulan || "0")),
    isian.tmtDasar,
    RAPIKAN(isian.nomorSkDasar),
    isian.tanggalSkDasar,
    isian.tanggalSkPendukung,
    isian.nomorWa.replace(/[\s-]/g, ""),
    RAPIKAN(isian.catatan),
    SATKER.find((s) => s.kode === isian.satker)?.nama ?? "",
  ];
}

/** Batas pengisian dari pengaturan: "yyyy-mm-ddTHH:mm" waktu WITA, sama dengan nilai input datetime-local. */
const POLA_TUTUP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Saat formulir tertutup otomatis, atau null bila tanpa batas (atau nilainya tidak sah). */
export function waktuTutup(tutupPada: string | undefined): Date | null {
  if (!tutupPada || !POLA_TUTUP.test(tutupPada)) return null;
  const d = new Date(`${tutupPada}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tutupPadaSah(tutupPada: string): boolean {
  return tutupPada === "" || waktuTutup(tutupPada) !== null;
}

export type KeadaanFormulir = "dibuka" | "ditutup" | "lewat_batas";

/**
 * Keadaan formulir publik saat ini. Formulir yang dibuka Super Admin tertutup sendiri begitu batas pengisian lewat
 * ("lewat_batas"); untuk membukanya lagi, Super Admin menyimpan batas yang baru.
 */
export function keadaanFormulir(
  k: { terbuka: boolean; kode: string; tutupPada?: string },
  sekarang: Date = new Date(),
): KeadaanFormulir {
  if (!k.terbuka || !k.kode) return "ditutup";
  const tutup = waktuTutup(k.tutupPada);
  return tutup && sekarang.getTime() >= tutup.getTime() ? "lewat_batas" : "dibuka";
}

/** Batas pengisian untuk ditampilkan, mis. "Sabtu, 10 Oktober 2026 pukul 23.59 WITA"; teks lama bila belum ada tanggal. */
export function teksBatas(k: { tutupPada?: string; batas?: string }): string {
  const tutup = waktuTutup(k.tutupPada);
  if (!tutup) return k.batas?.trim() ?? "";
  const tanggal = formatTanggalId(tutup, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const jam = formatTanggalId(tutup, { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".");
  return `${tanggal} pukul ${jam} WITA`;
}

/**
 * Letak folder kiriman di dalam ZIP: "<Satker>/<Keadaan>/<NIP - Nama>" bila kiriman membawa satker (kegiatan UPT),
 * selain itu "<Keadaan>/<NIP - Nama>".
 */
export function folderKiriman(isian: Pick<IsianInventaris, "keadaan" | "nip" | "nama" | "satker">): string {
  const satker = SATKER.find((s) => s.kode === isian.satker)?.nama;
  const dalam = `${FOLDER_KEADAAN[isian.keadaan]}/${namaFolderPegawai(isian.nip, isian.nama)}`;
  return satker ? `${satker.replace(/[\\/:*?"<>|]/g, " ")}/${dalam}` : dalam;
}
