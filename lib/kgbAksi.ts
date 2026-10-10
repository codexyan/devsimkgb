// Pemanggil API aksi KGB untuk komponen modal di dashboard. Aman dipakai di peramban:
// tidak mengimpor lapisan data server. Setiap aksi mengembalikan { ok, data } atau { ok, error }
// dengan pesan galat dari API, sehingga modal cukup punya satu jalur tampilan galat.

import type { DokumenPegawai } from "./dokumenPegawai";
import { BATAS_UKURAN_SK_BYTE, PESAN_SK_TERLALU_BESAR } from "./prosesKgb";
import type { DataSuratKGB } from "./generateSuratKGB";
import { TEKS_DRAF_KANWIL, TEKS_DRAF_UPT, type InfoReviewSk } from "./reviewSkUpt";

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
  /** SK dasar KGB pertama pada data pegawai (ADR-010). */
  nomorSkDasar?: string | null;
  tanggalSkDasar?: string | null;
  penetapSkDasar?: string | null;
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
  /** Golongan dan masa kerja yang disalin dari data pegawai saat Input KGB (data lama di SK). */
  golonganLama?: string | null;
  golonganBaru?: string | null;
  mkgTahunLama?: number | null;
  mkgBulanLama?: number | null;
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

/** PDF SK beserta keadaan review UPT-nya (ADR-077). */
export interface PdfSk {
  blob: Blob;
  /** PDF bertanda air DRAF: SK pegawai UPT yang belum disetujui Admin UPT. */
  draf: boolean;
  /** Keadaan review UPT; null untuk pegawai Kanwil atau selama review belum aktif. */
  reviewSk: InfoReviewSk | null;
  /** Isi surat yang dicetak; tahun surat dipakai nama berkas unduhan. */
  surat: DataSuratKGB;
}

const PESAN_PDF_GAGAL = "PDF surat gagal disusun di peramban. Muat ulang halaman, lalu coba lagi.";

/**
 * Server memeriksa dan mengirim isi surat; PDF-nya disusun di peramban. Pustaka PDF (±1 MB) dimuat
 * hanya saat surat pertama diminta, bukan bersama halaman dashboard. Server juga menentukan apakah SK-nya masih
 * bertanda air DRAF (ADR-077), sehingga setiap jalur unduhan memakai keputusan yang sama.
 */
async function ambilPdf(url: string, init: RequestInit, srikandi: boolean, cadangan: string): Promise<HasilAksi<PdfSk>> {
  const hasil = await kirimJson<{ surat: DataSuratKGB; draf?: boolean; reviewSk?: InfoReviewSk | null }>(url, init, cadangan);
  if (!hasil.ok) return hasil;
  try {
    const { buatPdfSuratKgb } = await import("./generateSuratKGB");
    const draf = hasil.data.draf === true;
    const blob = await buatPdfSuratKgb(hasil.data.surat, srikandi, { draf: draf ? TEKS_DRAF_KANWIL : null });
    return { ok: true, data: { blob, draf, reviewSk: hasil.data.reviewSk ?? null, surat: hasil.data.surat } };
  } catch {
    return { ok: false, error: PESAN_PDF_GAGAL };
  }
}

async function kirimPdf(url: string, init: RequestInit, srikandi: boolean, cadangan: string): Promise<HasilAksi<Blob>> {
  const hasil = await ambilPdf(url, init, srikandi, cadangan);
  return hasil.ok ? { ok: true, data: hasil.data.blob } : hasil;
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

/** Riwayat kenaikan pangkat pegawai, terbaru dulu (GET /api/pegawai/[id]/pangkat). */
export interface RiwayatPangkatItem {
  id: string;
  jenisKp?: string;
  jenisLabel: string;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtPangkat: string | null;
  golonganLama?: string;
  golonganBaru: string;
  gajiPokokBaru?: number | null;
  penetapSK: string | null;
}

export async function ambilRiwayatPangkat(pegawaiId: string): Promise<HasilAksi<RiwayatPangkatItem[]>> {
  const hasil = await kirimJson<RiwayatPangkatItem[]>(
    `/api/pegawai/${encodeURIComponent(pegawaiId)}/pangkat`,
    { cache: "no-store" },
    "Riwayat kenaikan pangkat gagal dimuat.",
  );
  if (!hasil.ok) return hasil;
  return { ok: true, data: Array.isArray(hasil.data) ? hasil.data : [] };
}

/** Riwayat peninjauan masa kerja pegawai, terbaru dulu (GET /api/pegawai/[id]/pmk). */
export interface RiwayatPmkItem {
  id: string;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtPmk: string | null;
  tambahBulan?: number | null;
  gajiPokokBaru?: number | null;
  penetapSK: string | null;
}

/** Dokumen pegawai dari semua sumber (GET /api/pegawai/[id]/dokumen); hanya Super Admin dan Tim SDM KGB. */
export function ambilDokumenPegawai(pegawaiId: string): Promise<HasilAksi<DokumenPegawai[]>> {
  return kirimJson<DokumenPegawai[]>(
    `/api/pegawai/${encodeURIComponent(pegawaiId)}/dokumen`,
    { cache: "no-store" },
    "Daftar dokumen pegawai gagal dimuat.",
  );
}

export async function ambilRiwayatPmk(pegawaiId: string): Promise<HasilAksi<RiwayatPmkItem[]>> {
  const hasil = await kirimJson<RiwayatPmkItem[]>(
    `/api/pegawai/${encodeURIComponent(pegawaiId)}/pmk`,
    { cache: "no-store" },
    "Riwayat PMK gagal dimuat.",
  );
  if (!hasil.ok) return hasil;
  return { ok: true, data: Array.isArray(hasil.data) ? hasil.data : [] };
}

/** SK dasar dari usulan UPT yang disetujui (GET /api/pegawai/[id]/sk-dasar); null bila tidak ada. */
export interface SkDasarUsulan {
  usulanId: string;
  /** "disetujui", atau "menunggu"/"revisi" bila usulannya belum selesai ditinjau Kanwil. */
  status: string;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtSK: string | null;
  /** Medan berkas pindaian SK-nya pada usulan, untuk /api/usulan/[id]/berkas. */
  berkas: "skCpns" | "skTerakhir" | null;
}

export function ambilSkDasarUsulan(pegawaiId: string): Promise<HasilAksi<SkDasarUsulan | null>> {
  return kirimJson<SkDasarUsulan | null>(
    `/api/pegawai/${encodeURIComponent(pegawaiId)}/sk-dasar`,
    { cache: "no-store" },
    "SK dasar dari usulan UPT gagal dimuat.",
  );
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
  /**
   * Masa kerja golongan dan gaji pokok yang **tertulis pada SK**. Bukan data yang disimpan: server
   * memakainya untuk memastikan arsipnya sama dengan SK-nya, lalu menolak bila berbeda (ADR-035).
   */
  mkgTahunSK: string;
  mkgBulanSK: string;
  gajiPokokSK: string;
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
    mkgTahunSK: data.mkgTahunSK,
    mkgBulanSK: data.mkgBulanSK,
    gajiPokokSK: data.gajiPokokSK,
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
  opsi: { nomorSurat?: string; tanggalSurat?: string; ttdBasah?: boolean } = {},
): Promise<HasilAksi<{ pathFile: string }>> {
  // Batas yang sama dengan server, diperiksa sebelum berkas dikirim.
  if (berkas.size > BATAS_UKURAN_SK_BYTE) return Promise.resolve({ ok: false, error: PESAN_SK_TERLALU_BESAR });
  const fd = new FormData();
  fd.append("file", berkas);
  if (opsi.nomorSurat?.trim()) fd.append("nomorSurat", opsi.nomorSurat.trim());
  if (opsi.tanggalSurat) fd.append("tanggalSurat", opsi.tanggalSurat);
  // Berkas tanpa TTE hanya diterima bila dinyatakan pindaian tanda tangan basah (ADR-096).
  if (opsi.ttdBasah) fd.append("ttdBasah", "1");
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

/** Draf nomor dan tanggal SK baru yang tersimpan di SIM-KGB (ADR-011). */
export function ambilDrafSk(kgbId: string): Promise<HasilAksi<{ drafNomorSurat: string | null; drafTanggalSurat: string | null }>> {
  return kirimJson(`/api/kgb/${encodeURIComponent(kgbId)}`, { cache: "no-store" }, "Draf SK gagal dimuat.");
}

/** Simpan draf nomor dan tanggal SK baru tanpa membuat SK; nomor kosong menghapus drafnya. */
export function simpanDrafSkServer(kgbId: string, draf: { nomorSurat: string; tanggalSurat: string }): Promise<HasilAksi<unknown>> {
  return kirimJson<unknown>(
    `/api/kgb/${encodeURIComponent(kgbId)}`,
    { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ drafSk: draf }) },
    "Draf SK gagal disimpan.",
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
  const query = params.size ? `?${params.toString()}` : "";
  return kirimPdf(
    `/api/kgb/${encodeURIComponent(kgbId)}/pdf${query}`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(skBaru) },
    opsi.srikandi,
    opsi.srikandi ? "SK versi Srikandi gagal dibuat." : "SK gagal dibuat.",
  );
}

/** Unduh ulang SK yang pernah dibuat di SIM-KGB, apa adanya (tanpa nomor dan tanggal baru). */
export function unduhUlangSk(kgbId: string): Promise<HasilAksi<Blob>> {
  return kirimPdf(`/api/kgb/${encodeURIComponent(kgbId)}/pdf?preview=true`, { method: "POST" }, false, "SK gagal diunduh.");
}

/**
 * Buat SK (mencatat surat) dan kembalikan keadaan review-nya: untuk pegawai UPT, Buat SK sekaligus meminta review ke
 * Admin UPT (ADR-077), dan PDF-nya bertanda air DRAF sampai UPT menyetujuinya.
 */
export function buatSkDenganReview(kgbId: string, skBaru: { nomorSurat: string; tanggalSurat: string }): Promise<HasilAksi<PdfSk>> {
  return ambilPdf(
    `/api/kgb/${encodeURIComponent(kgbId)}/pdf`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(skBaru) },
    false,
    "SK gagal dibuat.",
  );
}

/** Cara SK ditandatangani: TTE di Srikandi (versi Srikandi) atau tanda tangan basah (SK biasa). */
export type VersiCetak = "tte" | "basah";

/**
 * Cetak SK yang sudah dibuat, tanpa tanda air (ADR-095): versi Srikandi untuk TTE (bawaan), atau SK biasa untuk tanda
 * tangan basah. Satu SK ditandatangani dengan satu cara, jadi yang diunduh hanya satu berkas; dulu keduanya sekaligus.
 */
export async function cetakSk(
  kgbId: string,
  pegawai: { nama: string },
  versi: VersiCetak = "tte",
): Promise<HasilAksi<{ jumlah: number }>> {
  const url = `/api/kgb/${encodeURIComponent(kgbId)}/pdf?preview=true`;
  const hasil = await ambilPdf(url, { method: "POST" }, versi === "tte", "SK gagal diunduh.");
  if (!hasil.ok) return hasil;
  if (hasil.data.draf) return { ok: false, error: alasanBelumBolehCetak(hasil.data.reviewSk) };
  unduhBlob(hasil.data.blob, namaBerkasSk({ nomorSurat: hasil.data.surat.nomorSurat, nama: pegawai.nama, versi }));
  return { ok: true, data: { jumlah: 1 } };
}

function alasanBelumBolehCetak(reviewSk: InfoReviewSk | null): string {
  return reviewSk?.status === "perbaikan"
    ? "UPT meminta perbaikan SK ini. Perbaiki SK lalu tunggu persetujuan UPT sebelum mencetak."
    : "SK ini masih menunggu review Admin UPT, jadi belum dapat dicetak untuk ditandatangani.";
}

/** Angka urut di ujung nomor surat SK, mis. "1758" dari "WP.19-SA.04.04-1758"; tanpa angka di ujung, nomor utuh yang
 * aman dipakai sebagai nama berkas; null bila nomornya kosong. */
export function nomorUrutSk(nomorSurat: string | null | undefined): string | null {
  const nomor = nomorSurat?.trim();
  if (!nomor || nomor === "-") return null;
  const angka = nomor.match(/(\d+)\s*$/);
  if (angka) return angka[1];
  return nomor.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || null;
}

/**
 * Nama berkas SK (ADR-097): nomor urut, TTE atau TTD, "KGB", lalu nama pegawai, mis. "1758 TTE KGB Abdul Hayat.pdf".
 * Dipakai unduhan satuan maupun ZIP, sehingga satu SK selalu bernama sama dan berkas terurut menurut nomor agenda.
 */
export function namaBerkasSk(input: { nomorSurat?: string | null; nama: string; versi: VersiCetak }): string {
  const nama = input.nama.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "Pegawai";
  return [nomorUrutSk(input.nomorSurat), input.versi === "tte" ? "TTE" : "TTD", "KGB", nama].filter(Boolean).join(" ") + ".pdf";
}

/** Satu berkas ZIP tanpa kompresi ulang: PDF sudah terkompresi, jadi isinya disimpan apa adanya. */
export async function susunZipSk(berkas: readonly { nama: string; isi: Uint8Array }[]): Promise<Uint8Array> {
  const { zipSync } = await import("fflate");
  const isi: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const b of berkas) isi[b.nama] = [b.isi, { level: 0 }];
  return zipSync(isi);
}

/**
 * Unduh SK dari banyak KGB sekaligus dalam satu ZIP (ADR-095, ADR-097): versi Srikandi untuk TTE, atau SK biasa untuk
 * tanda tangan basah. PDF disusun satu per satu di peramban; SK yang belum boleh dicetak (menunggu review atau perbaikan
 * UPT) dilewati dan namanya dilaporkan.
 */
export async function unduhZipSiapCetak(
  daftar: readonly { kgbId: string; nama: string }[],
  versi: VersiCetak,
  kemajuan?: (selesai: number, total: number) => void,
): Promise<HasilAksi<{ jumlah: number; dilewati: string[] }>> {
  const berkas: { nama: string; isi: Uint8Array }[] = [];
  const dilewati: string[] = [];
  for (const [i, d] of daftar.entries()) {
    kemajuan?.(i, daftar.length);
    const hasil = await ambilPdf(`/api/kgb/${encodeURIComponent(d.kgbId)}/pdf?preview=true`, { method: "POST" }, versi === "tte", "SK gagal disiapkan.");
    if (!hasil.ok || hasil.data.draf) {
      dilewati.push(d.nama);
      continue;
    }
    // Nama kembar (nomor urut sama dari kode klasifikasi lain) diberi akhiran agar tidak saling menimpa di dalam ZIP.
    const dasar = namaBerkasSk({ nomorSurat: hasil.data.surat.nomorSurat, nama: d.nama, versi });
    let nama = dasar;
    for (let n = 2; berkas.some((b) => b.nama === nama); n++) nama = dasar.replace(/\.pdf$/, ` (${n}).pdf`);
    berkas.push({ nama, isi: new Uint8Array(await hasil.data.blob.arrayBuffer()) });
  }
  kemajuan?.(daftar.length, daftar.length);
  if (berkas.length === 0) return { ok: false, error: "Tidak ada SK yang dapat diunduh; semuanya gagal disiapkan atau belum boleh dicetak." };
  const zip = await susunZipSk(berkas);
  const hariIni = new Date();
  const tanggal = `${hariIni.getFullYear()}-${String(hariIni.getMonth() + 1).padStart(2, "0")}-${String(hariIni.getDate()).padStart(2, "0")}`;
  unduhBlob(new Blob([zip.slice().buffer], { type: "application/zip" }), `SK KGB ${versi === "tte" ? "TTE" : "TTD"} ${tanggal}.zip`);
  return { ok: true, data: { jumlah: berkas.length, dilewati } };
}

/** Minta review SK ke Admin UPT untuk SK yang dibuat sebelum review aktif (ADR-077). */
export function mintaReviewSkUpt(kgbId: string): Promise<HasilAksi<{ reviewSk: InfoReviewSk | null }>> {
  return kirimJson(
    `/api/kgb/${encodeURIComponent(kgbId)}/review-sk`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ aksi: "minta" }) },
    "Permintaan review gagal dikirim.",
  );
}

/** Super Admin melanjutkan SK tanpa menunggu review UPT, dengan alasan yang tercatat (ADR-077). */
export function lewatiReviewSkUpt(kgbId: string, alasan: string): Promise<HasilAksi<{ reviewSk: InfoReviewSk | null }>> {
  return kirimJson(
    `/api/kgb/${encodeURIComponent(kgbId)}/review-sk`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ aksi: "lewati", alasan }) },
    "Review gagal dilewati.",
  );
}

/** Isi SK yang diminta direview, untuk Admin UPT (GET /api/upt/review-sk/[kgbId]). */
export interface ReviewSkUntukUpt {
  surat: DataSuratKGB;
  reviewSk: InfoReviewSk | null;
  pegawai: { nama: string; nip: string; jabatan: string };
  /** SK sama persis dengan usulan UPT yang disetujui (ADR-087): tetap diperiksa, tetapi UPT diberi tahu. */
  sesuaiUsulan?: boolean;
  /** Bedanya dengan usulan UPT yang disetujui (ADR-082); null bila sesuai. */
  bedaUsulan?: { alasan: string; beda: { label: string; usulan: string; sk: string }[] } | null;
}

export function ambilReviewSkUpt(kgbId: string): Promise<HasilAksi<ReviewSkUntukUpt>> {
  return kirimJson(`/api/upt/review-sk/${encodeURIComponent(kgbId)}`, { cache: "no-store" }, "SK gagal dimuat.");
}

/** PDF pratinjau review untuk Admin UPT, selalu bertanda air DRAF. */
export async function pdfReviewSkUpt(surat: DataSuratKGB): Promise<HasilAksi<Blob>> {
  try {
    const { buatPdfSuratKgb } = await import("./generateSuratKGB");
    return { ok: true, data: await buatPdfSuratKgb(surat, false, { draf: TEKS_DRAF_UPT }) };
  } catch {
    return { ok: false, error: PESAN_PDF_GAGAL };
  }
}

/** Tanda air pratinjau SK dari isian usulan yang belum diajukan (ADR-078). */
export const TEKS_PRATINJAU_USULAN = "PRATINJAU USULAN · BELUM DIAJUKAN";

/** Pratinjau SK KGB berikutnya dari isian formulir usulan (POST /api/upt/usulan/pratinjau-sk). */
export interface PratinjauSkUsulan {
  surat: DataSuratKGB;
  /** Hal yang perlu diketahui UPT tentang pratinjau ini, mis. penandatangan yang belum diatur. */
  catatan: string[];
  atasDasar: { label: string; nomorSK: string | null; tmt: string | null } | null;
}

export async function pratinjauSkUsulan(isian: Record<string, string>): Promise<HasilAksi<PratinjauSkUsulan & { pdf: Blob }>> {
  const hasil = await kirimJson<PratinjauSkUsulan>(
    "/api/upt/usulan/pratinjau-sk",
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(isian) },
    "Pratinjau SK gagal disusun.",
  );
  if (!hasil.ok) return hasil;
  try {
    const { buatPdfSuratKgb } = await import("./generateSuratKGB");
    return { ok: true, data: { ...hasil.data, pdf: await buatPdfSuratKgb(hasil.data.surat, false, { draf: TEKS_PRATINJAU_USULAN }) } };
  } catch {
    return { ok: false, error: PESAN_PDF_GAGAL };
  }
}

/** Tanggapan Admin UPT: SK sudah benar, atau minta perbaikan dengan catatan. */
export function tanggapiReviewSkUpt(
  kgbId: string,
  keputusan: "setuju" | "perbaikan",
  catatan: string,
): Promise<HasilAksi<{ reviewSk: InfoReviewSk | null }>> {
  return kirimJson(
    `/api/upt/review-sk/${encodeURIComponent(kgbId)}`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ keputusan, catatan }) },
    "Tanggapan gagal dikirim.",
  );
}

/** Tautan berkas SK yang tersimpan (SK bertanda tangan atau berkas arsip). */
export function tautanBerkasSk(pathFile: string): string {
  return `/api/blob/download?url=${encodeURIComponent(pathFile)}`;
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
