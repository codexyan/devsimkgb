// Kegiatan pengumpulan data lewat formulir publik (ADR-022). Super Admin membuat kegiatan, misalnya inventarisasi
// KGB pegawai Kanwil atau pegawai UPT: tiap kegiatan punya template isian, sasaran satker, kode akses, waktu tutup,
// dan tautannya sendiri. Isian tiap template ditulis di kode (lib/inventarisKgb.ts), sehingga pemeriksaannya tetap
// berlaku. Modul ini murni; penyimpanannya di lib/inventarisServer.ts.
//
// Kegiatan "kanwil" adalah formulir inventarisasi pertama. Tautannya (/inventarisasi-kgb) dan letak kirimannya di R2
// (inventaris/<NIP>/) dipertahankan, sehingga kiriman yang sudah masuk tetap terbaca.

import { SATKER } from "./satker";
import { waktuTutup } from "./inventarisKgb";

export type TemplateKegiatan = "kgb-kanwil" | "kgb-upt";

export interface AturanTemplate {
  label: string;
  keterangan: string;
  /** true bila pengisi memilih satkernya; kiriman dikelompokkan per satker. */
  pakaiSatker: boolean;
}

export const TEMPLATE_KEGIATAN: Record<TemplateKegiatan, AturanTemplate> = {
  "kgb-kanwil": {
    label: "Inventarisasi KGB pegawai Kanwil",
    keterangan: "SK KGB terakhir, SK pangkat/PI, SK PMK, atau SK CPNS/PNS pegawai Kantor Wilayah.",
    pakaiSatker: false,
  },
  "kgb-upt": {
    label: "Inventarisasi KGB pegawai UPT",
    keterangan: "Isian yang sama dengan inventarisasi Kanwil, ditambah satker; kiriman dikelompokkan per satker.",
    pakaiSatker: true,
  },
};

export function isTemplateKegiatan(nilai: unknown): nilai is TemplateKegiatan {
  return typeof nilai === "string" && Object.prototype.hasOwnProperty.call(TEMPLATE_KEGIATAN, nilai);
}

export interface Kegiatan {
  /** Bagian tautan /inventarisasi-kgb/<id>; "kanwil" untuk kegiatan pertama (/inventarisasi-kgb). */
  id: string;
  nama: string;
  template: TemplateKegiatan;
  /** Kode satker yang boleh dipilih pengisi (template dengan satker); kosong berarti semua UPT. */
  satker: string[];
  terbuka: boolean;
  /** Kode akses yang diumumkan; dibandingkan tanpa peka huruf besar-kecil. */
  kode: string;
  /** Waktu tutup "yyyy-mm-ddTHH:mm" WITA; kosong berarti tanpa batas. */
  tutupPada?: string;
  /** Teks batas bebas dari pengaturan lama, sebelum ada tutupPada. */
  batas?: string;
  dibuatAt?: string;
  diubahOleh?: string;
  diubahAt?: string;
}

export const ID_KEGIATAN_KANWIL = "kanwil";

/** Pengaturan formulir sebelum ada kegiatan (inventaris/_konfigurasi.json). */
export interface KonfigurasiLama {
  terbuka?: boolean;
  kode?: string;
  tutupPada?: string;
  batas?: string;
  diubahOleh?: string;
  diubahAt?: string;
}

/** Kegiatan pertama dari pengaturan formulir lama, supaya formulir yang berjalan tidak berubah. */
export function kegiatanDariKonfigurasiLama(k: KonfigurasiLama | null): Kegiatan {
  return {
    id: ID_KEGIATAN_KANWIL,
    nama: "Inventarisasi KGB pegawai Kanwil",
    template: "kgb-kanwil",
    satker: [],
    terbuka: k?.terbuka === true,
    kode: k?.kode ?? "",
    tutupPada: k?.tutupPada ?? "",
    batas: k?.batas ?? "",
    diubahOleh: k?.diubahOleh,
    diubahAt: k?.diubahAt,
  };
}

const POLA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function idKegiatanSah(id: string): boolean {
  return id.length >= 3 && id.length <= 40 && POLA_ID.test(id);
}

/** Id dari nama kegiatan: huruf kecil, angka, dan tanda hubung; diberi akhiran angka bila sudah dipakai. */
export function idDariNama(nama: string, dipakai: ReadonlySet<string>): string {
  const dasar =
    nama
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36)
      .replace(/-+$/g, "") || "kegiatan";
  const awal = dasar.length >= 3 ? dasar : `${dasar}-data`;
  let id = awal;
  for (let n = 2; dipakai.has(id); n++) id = `${awal}-${n}`;
  return id;
}

/** Tautan publik kegiatan. */
export function tautanKegiatan(id: string): string {
  return id === ID_KEGIATAN_KANWIL ? "/inventarisasi-kgb" : `/inventarisasi-kgb/${id}`;
}

/** Awalan kunci R2 kiriman kegiatan. Kegiatan pertama memakai letak lama, inventaris/<NIP>/. */
export function awalanKegiatan(id: string): string {
  return id === ID_KEGIATAN_KANWIL ? "inventaris/" : `inventaris/k/${id}/`;
}

/** true bila kunci R2 adalah data.json kiriman kegiatan ini (bukan kegiatan lain yang awalannya bertumpuk). */
export function kunciDataKegiatan(id: string, kunci: string): boolean {
  const awalan = awalanKegiatan(id);
  if (!kunci.startsWith(awalan)) return false;
  return /^\d{18}\/data\.json$/.test(kunci.slice(awalan.length));
}

/**
 * Kunci berkas inventaris yang sah: <awalan kegiatan><NIP>/<NIP>_<Jenis>[_yyyy-mm-dd].pdf, pada letak lama
 * (inventaris/<NIP>/) atau letak kegiatan (inventaris/k/<id>/<NIP>/).
 */
export function kunciBerkasInventarisSah(kunci: string): boolean {
  return /^inventaris\/(?:k\/[a-z0-9]+(?:-[a-z0-9]+)*\/)?(\d{18})\/\1_(SK-KGB-Terakhir|SK-KP-Terakhir|SK-PMK|SK-CPNS|SK-PNS)(_\d{4}-\d{2}-\d{2})?\.pdf$/.test(
    kunci,
  );
}

/** Satker yang boleh dipilih pengisi kegiatan: yang ditetapkan Super Admin, atau semua UPT bila kosong. */
export function satkerPilihan(k: Pick<Kegiatan, "template" | "satker">): { kode: string; nama: string }[] {
  if (!TEMPLATE_KEGIATAN[k.template].pakaiSatker) return [];
  const upt = SATKER.filter((s) => s.jenis !== "kanwil");
  const dipilih = k.satker.length > 0 ? upt.filter((s) => k.satker.includes(s.kode)) : upt;
  return dipilih.map((s) => ({ kode: s.kode, nama: s.nama }));
}

/** Nama lengkap satker dari kodenya; kosong bila tidak dikenal. */
export function namaSatker(kode: string | undefined): string {
  return SATKER.find((s) => s.kode === kode)?.nama ?? "";
}

/** Kekurangan pengaturan kegiatan sebelum disimpan; kosong berarti siap. `sekarang` untuk memeriksa waktu tutup. */
export function periksaKegiatan(k: Kegiatan, sekarang: Date = new Date()): string[] {
  const kurang: string[] = [];
  if (!idKegiatanSah(k.id)) kurang.push("Id kegiatan 3 sampai 40 huruf kecil, angka, atau tanda hubung.");
  if (k.nama.trim().length < 3) kurang.push("Nama kegiatan minimal 3 huruf.");
  if (!isTemplateKegiatan(k.template)) kurang.push("Template kegiatan tidak dikenal.");
  const upt = new Set(SATKER.filter((s) => s.jenis !== "kanwil").map((s) => s.kode));
  if (k.satker.some((s) => !upt.has(s))) kurang.push("Satker sasaran tidak dikenal.");
  if (k.terbuka && !/^[A-Z0-9-]{4,30}$/.test(k.kode)) kurang.push("Kode akses 4 sampai 30 huruf atau angka, tanpa spasi.");
  if (k.tutupPada && !waktuTutup(k.tutupPada)) kurang.push("Waktu tutup tidak valid. Pilih tanggal dan jam.");
  const tutup = waktuTutup(k.tutupPada);
  if (k.terbuka && tutup && tutup.getTime() <= sekarang.getTime())
    kurang.push("Waktu tutup sudah lewat. Untuk membuka formulir, pilih tanggal dan jam yang akan datang.");
  return kurang;
}
