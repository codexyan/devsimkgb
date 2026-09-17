// Pemanggil API aksi KGB untuk komponen modal di dashboard. Aman dipakai di peramban:
// tidak mengimpor lapisan data server. Setiap aksi mengembalikan { ok, data } atau { ok, error }
// dengan pesan galat dari API, sehingga modal cukup punya satu jalur tampilan galat.

import { BATAS_UKURAN_SK_BYTE, PESAN_SK_TERLALU_BESAR } from "./prosesKgb";

export type HasilAksi<T> = { ok: true; data: T } | { ok: false; error: string };

/** Data "Atas Dasar SK Terakhir" dalam format input form (tanggal "yyyy-mm-dd"). */
export interface DataDasarSk {
  nomorSK: string;
  tanggalSK: string;
  tmtSK: string;
  penetapSkDasar: string;
}

/** Data pegawai yang dipakai modal KGB, dari GET /api/pegawai/[id]. */
export interface PegawaiKgb {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbBerikutnya: string | null;
  tmtKgbTerakhir: string | null;
  statusHukdis: boolean;
  tanggalHukdisBerakhir: string | null;
}

/** Satu baris riwayat dari GET /api/kgb?pegawaiId=. */
export interface RiwayatKgbItem {
  id: string;
  status: string;
  isArsip?: boolean;
  flagRapelan: boolean;
  rapelanDitetapkan?: boolean | null;
  nomorSK: string;
  tmtKgbBaru: string;
  gajiPokokLama: number | null;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  /** Kolom Atas Dasar SK Terakhir; pada record arsip berisi data SK yang diarsipkan. */
  tanggalSK?: string | null;
  tmtSK?: string | null;
  penetapSkDasar?: string | null;
  surat: { id?: string; nomorSurat: string; tanggalSurat?: string | null; pathFile?: string | null } | null;
  /** SK sudah dibuat di SIM-KGB (suratSudahDibuat di lib/prosesKgb.ts); syarat Unggah SK TTE. */
  skSudahDibuat?: boolean;
}

export const PESAN_GAGAL_JARINGAN = "Gagal menghubungi server. Periksa koneksi, lalu coba lagi.";

async function pesanGalat(res: Response, cadangan: string): Promise<string> {
  try {
    const isi = (await res.json()) as { error?: unknown } | null;
    if (typeof isi?.error === "string" && isi.error.trim()) return isi.error;
  } catch {
    /* badan respons bukan JSON */
  }
  return cadangan;
}

async function kirimJson<T>(url: string, init: RequestInit, cadangan: string): Promise<HasilAksi<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: PESAN_GAGAL_JARINGAN };
  }
  if (!res.ok) return { ok: false, error: await pesanGalat(res, cadangan) };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: cadangan };
  }
}

async function kirimPdf(url: string, init: RequestInit, cadangan: string): Promise<HasilAksi<Blob>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: PESAN_GAGAL_JARINGAN };
  }
  if (!res.ok) return { ok: false, error: await pesanGalat(res, cadangan) };
  try {
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, error: PESAN_GAGAL_JARINGAN };
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function ambilPegawaiKgb(pegawaiId: string): Promise<HasilAksi<PegawaiKgb>> {
  return kirimJson<PegawaiKgb>(
    `/api/pegawai/${encodeURIComponent(pegawaiId)}`,
    { cache: "no-store" },
    "Data pegawai gagal dimuat.",
  );
}

export async function ambilRiwayatKgb(pegawaiId: string): Promise<HasilAksi<RiwayatKgbItem[]>> {
  const hasil = await kirimJson<RiwayatKgbItem[]>(
    `/api/kgb?pegawaiId=${encodeURIComponent(pegawaiId)}`,
    { cache: "no-store" },
    "Riwayat KGB gagal dimuat.",
  );
  if (!hasil.ok) return hasil;
  return { ok: true, data: Array.isArray(hasil.data) ? hasil.data.filter((k) => !!k?.id) : [] };
}

/** Input KGB dan Input Ulang KGB: POST /api/kgb. */
export function inputKgb(pegawaiId: string, dasar: DataDasarSk): Promise<HasilAksi<{ id: string }>> {
  return kirimJson<{ id: string }>(
    "/api/kgb",
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ pegawaiId, ...dasar }) },
    "Input KGB gagal disimpan.",
  );
}

/** Data SK KGB yang terbit di luar SIM-KGB untuk Arsip KGB (tanggal "yyyy-mm-dd"). */
export interface DataArsipKgb {
  nomorSK: string;
  tanggalSK: string;
  tmtSK: string;
  /** Pejabat yang menetapkan SK yang diarsipkan; boleh kosong. */
  penetapSkArsip: string;
}

/** Badan permintaan POST /api/kgb mode arsip. Penetap hanya dikirim bila diisi. */
export function badanArsipKgb(pegawaiId: string, data: DataArsipKgb): Record<string, unknown> {
  const penetap = data.penetapSkArsip.trim();
  return {
    pegawaiId,
    nomorSK: data.nomorSK.trim(),
    tanggalSK: data.tanggalSK,
    tmtSK: data.tmtSK,
    isArsip: true,
    // Kolom SK pada record arsip menggambarkan SK yang diarsipkan, jadi penetapnya sama. penetapSkArsip
    // dipakai server sebagai penetap SK dasar untuk jadwal KGB berikutnya.
    ...(penetap ? { penetapSkDasar: penetap, penetapSkArsip: penetap } : {}),
  };
}

/** Arsip KGB tahap pertama: SK yang terbit di luar SIM-KGB dicatat sebagai KGB Selesai. */
export function simpanArsipKgb(pegawaiId: string, data: DataArsipKgb): Promise<HasilAksi<{ id: string }>> {
  return kirimJson<{ id: string }>(
    "/api/kgb",
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(badanArsipKgb(pegawaiId, data)) },
    "Arsip KGB gagal disimpan.",
  );
}

/** Unggah berkas SK PDF: POST /api/kgb/[id]/upload-sk. Nomor dan tanggal SK dikirim untuk arsip. */
export function unggahSk(
  kgbId: string,
  berkas: File,
  opsi: { nomorSurat?: string; tanggalSurat?: string } = {},
): Promise<HasilAksi<{ pathFile: string }>> {
  // Batas yang sama dengan server, diperiksa sebelum berkas dikirim.
  if (berkas.size > BATAS_UKURAN_SK_BYTE) return Promise.resolve({ ok: false, error: PESAN_SK_TERLALU_BESAR });
  const fd = new FormData();
  fd.append("file", berkas);
  if (opsi.nomorSurat?.trim()) fd.append("nomorSurat", opsi.nomorSurat.trim());
  if (opsi.tanggalSurat) fd.append("tanggalSurat", opsi.tanggalSurat);
  return kirimJson<{ pathFile: string }>(
    `/api/kgb/${encodeURIComponent(kgbId)}/upload-sk`,
    { method: "POST", body: fd },
    "Berkas SK gagal diunggah.",
  );
}

export function batalkanKgb(kgbId: string, alasan: string): Promise<HasilAksi<unknown>> {
  return kirimJson<unknown>(
    `/api/kgb/${encodeURIComponent(kgbId)}`,
    { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ status: "ditolak", alasanTolak: alasan.trim() }) },
    "KGB gagal dibatalkan.",
  );
}

/** Simpan bagian Atas Dasar SK Terakhir sebelum SK dibuat: PATCH /api/kgb/[id]. */
export function simpanDasarSk(kgbId: string, dasar: DataDasarSk): Promise<HasilAksi<unknown>> {
  return kirimJson<unknown>(
    `/api/kgb/${encodeURIComponent(kgbId)}`,
    { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(dasar) },
    "Data SK terakhir gagal disimpan.",
  );
}

/**
 * PDF SK dari POST /api/kgb/[id]/pdf. Tanpa pratinjau, surat disimpan di SIM-KGB.
 * Versi Srikandi selalu diminta sebagai pratinjau agar surat tidak tercatat dua kali.
 */
export function buatPdfSk(
  kgbId: string,
  skBaru: { nomorSurat: string; tanggalSurat: string },
  opsi: { pratinjau: boolean; srikandi: boolean },
): Promise<HasilAksi<Blob>> {
  const params = new URLSearchParams();
  if (opsi.pratinjau || opsi.srikandi) params.set("preview", "true");
  if (opsi.srikandi) params.set("srikandi", "true");
  const query = params.size ? `?${params.toString()}` : "";
  return kirimPdf(
    `/api/kgb/${encodeURIComponent(kgbId)}/pdf${query}`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(skBaru) },
    opsi.srikandi ? "SK versi Srikandi gagal dibuat." : "SK gagal dibuat.",
  );
}

/** Unduh ulang SK yang pernah dibuat di SIM-KGB, apa adanya (tanpa nomor dan tanggal baru). */
export function unduhUlangSk(kgbId: string): Promise<HasilAksi<Blob>> {
  return kirimPdf(`/api/kgb/${encodeURIComponent(kgbId)}/pdf?preview=true`, { method: "POST" }, "SK gagal diunduh.");
}

/** Tautan berkas SK yang tersimpan (SK bertanda tangan atau berkas arsip). */
export function tautanBerkasSk(pathFile: string): string {
  return `/api/blob/download?url=${encodeURIComponent(pathFile)}`;
}

/**
 * Nama berkas unduhan SK KGB. SK biasa: "KGB Kanwil <nama> <tahun>.pdf"; versi Srikandi:
 * "KGB <nama>.pdf". Karakter yang tidak sah untuk nama berkas diganti spasi.
 */
export function namaFileSk(input: { nama: string; tahun?: number | null; versi: "biasa" | "srikandi" }): string {
  const nama =
    input.nama
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Pegawai";
  if (input.versi === "srikandi") return `KGB ${nama}.pdf`;
  const tahun = typeof input.tahun === "number" && Number.isFinite(input.tahun) ? ` ${input.tahun}` : "";
  return `KGB Kanwil ${nama}${tahun}.pdf`;
}

/** Unduh Blob sebagai berkas di peramban. */
export function unduhBlob(blob: Blob, namaFile: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Dicabut setelah jeda agar unduhan sempat dimulai.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
