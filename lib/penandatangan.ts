// Pejabat penandatangan surat KGB.
//
// Kepmen Imipas M.IP-01.OT.01.01 Tahun 2025, Lampiran butir 19: KGB pegawai Kanwil
// dan UPT ditetapkan Kepala Kanwil secara delegasi, atas nama jabatannya sendiri.
// Untuk keadaan yang tidak diatur tegas, Kanwil menetapkan:
//   • Kepala Kanwil berhalangan sementara → Plh. Kepala Kanwil
//   • jabatan Kepala Kanwil kosong        → Plt. Kepala Kanwil
//   • KGB milik pimpinan Kanwil sendiri   → Direktur Jenderal Pemasyarakatan
//
// Modul ini murni (tanpa akses Sheets) agar bisa dipakai di server maupun di halaman.
// Masa berlaku dibandingkan sebagai tanggal kalender WITA.

import { formatTanggalId, tanggalKalender } from "./waktu";

export const JENIS_PENANDATANGAN = ["definitif", "plh", "plt", "dirjen"] as const;
export type JenisPenandatangan = (typeof JENIS_PENANDATANGAN)[number];

export const LABEL_JENIS_PENANDATANGAN: Record<JenisPenandatangan, string> = {
  definitif: "Kepala Kanwil definitif",
  plh: "Plh. Kepala Kanwil",
  plt: "Plt. Kepala Kanwil",
  dirjen: "Direktur Jenderal",
};

export const JABATAN_BAWAAN: Record<JenisPenandatangan, string> = {
  definitif: "Kepala Kantor Wilayah",
  plh: "Kepala Kantor Wilayah",
  plt: "Kepala Kantor Wilayah",
  dirjen: "Direktur Jenderal Pemasyarakatan",
};

type Tanggal = Date | string | null;

export interface PenandatanganRow {
  id: string;
  jenis: JenisPenandatangan;
  nama: string;
  nip: string;
  jabatan: string;
  dasarPenunjukan: string | null;
  berlakuMulai: Date | null;
  berlakuSampai: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

/** Bentuk longgar: baris dari Sheets (Date) maupun dari JSON API (string). */
export type Penandatangan = Omit<PenandatanganRow, "berlakuMulai" | "berlakuSampai" | "updatedAt"> & {
  berlakuMulai: Tanggal;
  berlakuSampai: Tanggal;
  updatedAt?: Tanggal;
};

type DataPenandatangan = Pick<
  PenandatanganRow,
  "jenis" | "nama" | "nip" | "jabatan" | "dasarPenunjukan" | "berlakuMulai" | "berlakuSampai"
>;

/** Jabatan seperti tercetak di blok tanda tangan, dengan awalan Plh./Plt. */
export function jabatanTercetak(p: Pick<Penandatangan, "jenis" | "jabatan">): string {
  if (p.jenis === "plh") return `Plh. ${p.jabatan}`;
  if (p.jenis === "plt") return `Plt. ${p.jabatan}`;
  return p.jabatan;
}

/**
 * Tanggal kalender WITA dalam milidetik; null bila kosong atau tidak valid. Tanggal tersimpan dapat
 * berupa tengah malam UTC atau tengah malam WITA (16.00 UTC hari sebelumnya), jadi getter lokal
 * saja akan menggeser masa berlaku sehari pada proses UTC.
 */
function hari(t: Tanggal): number | null {
  return tanggalKalender(t)?.getTime() ?? null;
}

/** Berlaku pada tanggal tertentu; tanggal akhir ikut dihitung. */
export function berlakuPada(p: Pick<Penandatangan, "berlakuMulai" | "berlakuSampai">, tanggal: Date): boolean {
  const mulai = hari(p.berlakuMulai);
  const t = hari(tanggal);
  if (mulai === null || t === null || mulai > t) return false;
  const sampai = hari(p.berlakuSampai);
  return sampai === null || sampai >= t;
}

export function rentangBerlaku(p: Pick<Penandatangan, "berlakuMulai" | "berlakuSampai">): string {
  const f = (t: Tanggal) => (t ? formatTanggalId(t, { day: "numeric", month: "short", year: "numeric" }) : "");
  return `${f(p.berlakuMulai)} – ${p.berlakuSampai ? f(p.berlakuSampai) : "sekarang"}`;
}

const normalNip = (nip: string | null | undefined) => (nip ?? "").replace(/\s/g, "");

function terbaru<T extends Penandatangan>(daftar: T[], jenis: JenisPenandatangan): T | undefined {
  return daftar
    .filter((p) => p.jenis === jenis)
    .sort((a, b) => (hari(b.berlakuMulai) ?? 0) - (hari(a.berlakuMulai) ?? 0))[0];
}

type HasilPenandatangan<T extends Penandatangan = Penandatangan> =
  | { ok: true; penandatangan: T; jabatan: string; milikPimpinan: boolean }
  | { ok: false; error: string };

/**
 * Pilih penandatangan surat KGB bertanggal `tanggalSurat` milik pegawai `nipPegawai`.
 * Plh menggantikan pimpinan yang berhalangan sementara; Plt memimpin saat jabatan kosong.
 * Bila pegawai itu pimpinan Kanwil atau penandatangan sendiri, surat ditandatangani Dirjen.
 */
export function tentukanPenandatangan<T extends Penandatangan>(
  daftar: T[],
  tanggalSurat: Date,
  nipPegawai: string | null | undefined,
): HasilPenandatangan<T> {
  const aktif = daftar.filter((p) => berlakuPada(p, tanggalSurat));
  const pimpinan = terbaru(aktif, "definitif") ?? terbaru(aktif, "plt");
  const kanwil = terbaru(aktif, "plh") ?? pimpinan;
  if (!kanwil) {
    return {
      ok: false,
      error: "Belum ada penandatangan yang berlaku pada tanggal surat. Tambahkan di Pengaturan, bagian Penandatangan Surat KGB.",
    };
  }

  const nip = normalNip(nipPegawai);
  const milikPimpinan = nip !== "" && [pimpinan?.nip, kanwil.nip].some((n) => normalNip(n) === nip);
  if (!milikPimpinan) return { ok: true, penandatangan: kanwil, jabatan: jabatanTercetak(kanwil), milikPimpinan };

  const dirjen = terbaru(aktif, "dirjen");
  if (!dirjen) {
    return {
      ok: false,
      error:
        "KGB ini milik pimpinan Kanwil sehingga ditandatangani Direktur Jenderal, tetapi data Direktur Jenderal yang berlaku pada tanggal surat belum diisi di Pengaturan.",
    };
  }
  return { ok: true, penandatangan: dirjen, jabatan: jabatanTercetak(dirjen), milikPimpinan };
}

/** Definitif dan Plt sama-sama memimpin, jadi masa berlakunya tidak boleh bertabrakan. */
const kelompok = (jenis: JenisPenandatangan) => (jenis === "plt" ? "definitif" : jenis);

function bertabrakan(
  a: Pick<Penandatangan, "berlakuMulai" | "berlakuSampai">,
  b: Pick<Penandatangan, "berlakuMulai" | "berlakuSampai">,
): boolean {
  const aSampai = hari(a.berlakuSampai) ?? Infinity;
  const bSampai = hari(b.berlakuSampai) ?? Infinity;
  return (hari(a.berlakuMulai) ?? 0) <= bSampai && (hari(b.berlakuMulai) ?? 0) <= aSampai;
}

export function cariBentrok<T extends Penandatangan>(
  daftar: T[],
  calon: Pick<Penandatangan, "jenis" | "berlakuMulai" | "berlakuSampai">,
  abaikanId?: string,
): T | undefined {
  return daftar.find(
    (p) => p.id !== abaikanId && kelompok(p.jenis) === kelompok(calon.jenis) && bertabrakan(p, calon),
  );
}

export function pesanBentrok(p: Pick<Penandatangan, "jenis" | "nama" | "berlakuMulai" | "berlakuSampai">): string {
  return `Masa berlaku bertabrakan dengan ${LABEL_JENIS_PENANDATANGAN[p.jenis]} ${p.nama} (${rentangBerlaku(p)}). Isi tanggal akhir berlaku pada data lama terlebih dahulu.`;
}

export function validasiPenandatangan(
  input: Record<string, unknown>,
): { ok: true; data: DataPenandatangan } | { ok: false; error: string } {
  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const tanggal = (v: unknown) => {
    const s = teks(v);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const jenis = teks(input.jenis) as JenisPenandatangan;
  if (!(JENIS_PENANDATANGAN as readonly string[]).includes(jenis)) return { ok: false, error: "Pilih jenis penandatangan" };
  const nama = teks(input.nama);
  if (!nama) return { ok: false, error: "Nama penandatangan wajib diisi" };
  const nip = teks(input.nip).replace(/\s/g, "");
  if (!/^\d{18}$/.test(nip)) return { ok: false, error: "NIP harus 18 digit angka" };
  const jabatan = teks(input.jabatan).replace(/^(plh|plt)\.?\s+/i, "") || JABATAN_BAWAAN[jenis];
  const dasarPenunjukan = teks(input.dasarPenunjukan) || null;
  if ((jenis === "plh" || jenis === "plt") && !dasarPenunjukan) {
    return { ok: false, error: "Dasar penunjukan wajib diisi untuk Plh dan Plt" };
  }
  const berlakuMulai = tanggal(input.berlakuMulai);
  if (!berlakuMulai) return { ok: false, error: "Tanggal mulai berlaku wajib diisi" };
  const berlakuSampai = tanggal(input.berlakuSampai);
  if (berlakuSampai === undefined) return { ok: false, error: "Tanggal akhir berlaku tidak valid" };
  if (berlakuSampai && berlakuSampai < berlakuMulai) {
    return { ok: false, error: "Tanggal akhir berlaku tidak boleh sebelum tanggal mulai" };
  }
  return { ok: true, data: { jenis, nama, nip, jabatan, dasarPenunjukan, berlakuMulai, berlakuSampai } };
}
