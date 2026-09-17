// Aturan proses KGB yang dipakai route API: pembacaan tanggal masukan formulir, izin per status
// untuk membuat SK, mengubah data SK terakhir, dan mengunggah SK, penahanan oleh hukuman disiplin,
// serta pemulihan jadwal saat KGB dibatalkan. Modul ini murni (tanpa akses data).

import { tambahBulan } from "./tabelGaji";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

/** Bagian baris SuratKGB yang dibaca route KGB. */
export type SuratKgbTersimpan = {
  id: string;
  kgbId: string;
  nomorSurat: string;
  tanggalSurat: Date | null;
  namaKepalaKanwil: string | null;
  nipKepalaKanwil: string | null;
  pathFile: string | null;
  penandatanganId?: string | null;
  jenisPenandatangan?: string | null;
  jabatanPenandatangan?: string | null;
};

/**
 * Tanggal dari masukan formulir: "yyyy-mm-dd" (tanggal kalender) atau waktu ISO lengkap.
 * Tanggal kalender disimpan sebagai tengah malam UTC, sama dengan new Date("yyyy-mm-dd").
 * Mengembalikan null bila kosong, bukan string, formatnya lain, atau tanggalnya tidak ada
 * (misalnya 31 Februari).
 */
export function bacaTanggalInput(nilai: unknown): Date | null {
  if (typeof nilai !== "string") return null;
  const teks = nilai.trim();
  const cocok = /^(\d{4})-(\d{2})-(\d{2})(T.+)?$/.exec(teks);
  if (!cocok) return null;
  const [tahun, bulan, hari] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])];
  const kalender = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (kalender.getUTCFullYear() !== tahun || kalender.getUTCMonth() !== bulan - 1 || kalender.getUTCDate() !== hari) {
    return null;
  }
  if (!cocok[4]) return kalender;
  const waktu = new Date(teks);
  return Number.isNaN(waktu.getTime()) ? null : waktu;
}

/** Rentang TMT [lo, hi) untuk filter bulan dan tahun; null bila tahun kosong atau tidak valid. */
export function rentangBulanTmt(bulan: string, tahun: string): { lo: Date; hi: Date } | null {
  const teksTahun = tahun.trim();
  if (!/^\d{4}$/.test(teksTahun)) return null;
  const t = Number(teksTahun);
  const teksBulan = bulan.trim();
  const b = /^\d{1,2}$/.test(teksBulan) ? Number(teksBulan) : 0;
  if (b >= 1 && b <= 12) return { lo: new Date(t, b - 1, 1), hi: new Date(t, b, 1) };
  return { lo: new Date(t, 0, 1), hi: new Date(t + 1, 0, 1) };
}

export const PESAN_BELUM_DIINPUT = "KGB ini belum diinput. Input KGB terlebih dahulu sebelum membuat SK.";

/** Alasan SK tidak boleh dibuat untuk status ini; null bila boleh (hanya Sedang Diproses). */
export function alasanTolakBuatSk(status: string): string | null {
  switch (status) {
    case "sedang_diproses":
      return null;
    case "belum_diproses":
      return PESAN_BELUM_DIINPUT;
    case "menunggu_keuangan":
      return "SK yang sudah ditandatangani sudah diunggah dan menunggu konfirmasi keuangan, jadi SK tidak dapat dibuat ulang.";
    case "selesai":
      return "KGB sudah selesai, jadi SK tidak dapat dibuat ulang.";
    case "ditolak":
      return "KGB ini sudah dibatalkan. Input Ulang KGB sebelum membuat SK.";
    default:
      return "Status KGB tidak dikenal, jadi SK tidak dapat dibuat.";
  }
}

/** Alasan data SK terakhir tidak boleh diubah untuk status ini; null bila boleh (hanya Sedang Diproses). */
export function alasanTolakUbahSkTerakhir(status: string): string | null {
  if (status === "sedang_diproses") return null;
  if (status === "belum_diproses") return "KGB ini belum diinput. Isi data SK terakhir melalui Input KGB.";
  return "Data SK terakhir hanya dapat diubah selama KGB berstatus Sedang Diproses.";
}

/** true bila SK sudah dibuat lewat SIM-KGB, sehingga penandatangannya tercatat. */
export function suratSudahDibuat(surat: Partial<SuratKgbTersimpan> | null | undefined): boolean {
  if (!surat) return false;
  if (surat.jabatanPenandatangan?.trim()) return true;
  // Surat lama sebelum kolom jabatan penandatangan ada hanya menyimpan nama.
  const nama = surat.namaKepalaKanwil?.trim() ?? "";
  return nama !== "" && nama !== "-";
}

type IzinUnggahSk =
  | { ok: true; jenis: "unggah" | "ganti" | "arsip" }
  | { ok: false; error: string };

/**
 * Izin mengunggah SK yang sudah ditandatangani.
 * - Sedang Diproses: SK harus sudah dibuat, lalu status berpindah ke Menunggu Keuangan.
 * - Menunggu Keuangan: file SK diganti, status tetap.
 * - Selesai: hanya record arsip (SK diterbitkan di luar SIM-KGB), status tetap.
 */
export function izinUnggahSk(input: { status: string; isArsip: boolean; skSudahDibuat: boolean }): IzinUnggahSk {
  switch (input.status) {
    case "sedang_diproses":
      return input.skSudahDibuat
        ? { ok: true, jenis: "unggah" }
        : { ok: false, error: "Buat SK terlebih dahulu sebelum mengunggah SK yang sudah ditandatangani." };
    case "menunggu_keuangan":
      return { ok: true, jenis: "ganti" };
    case "selesai":
      return input.isArsip
        ? { ok: true, jenis: "arsip" }
        : { ok: false, error: "KGB ini sudah dikonfirmasi keuangan, jadi SK tidak dapat diganti." };
    case "belum_diproses":
      return { ok: false, error: "KGB ini belum diinput. Input KGB dan buat SK terlebih dahulu sebelum mengunggah SK." };
    case "ditolak":
      return { ok: false, error: "KGB ini sudah dibatalkan. Input Ulang KGB sebelum mengunggah SK." };
    default:
      return { ok: false, error: "Status KGB tidak dikenal, jadi SK tidak dapat diunggah." };
  }
}

/** Pesan penolakan Input KGB atau Arsip KGB saat pegawai masih punya KGB aktif; null bila tidak aktif. */
export function pesanKgbMasihAktif(status: string): string | null {
  if (status === "sedang_diproses") {
    return "Pegawai ini masih memiliki KGB berstatus Sedang Diproses. Selesaikan atau batalkan KGB tersebut terlebih dahulu.";
  }
  if (status === "menunggu_keuangan") {
    return "Pegawai ini masih memiliki KGB berstatus Menunggu Keuangan. Tunggu konfirmasi keuangan atas KGB tersebut terlebih dahulu.";
  }
  return null;
}

export interface HukdisUntukKgb {
  berdampakKGB: boolean | null;
  tmtBerakhir: NilaiTanggal;
  /** Tanggal mulai; kosong atau tidak valid berarti hukdis dianggap berlaku untuk KGB mana pun. */
  tmtMulai?: NilaiTanggal;
}

/**
 * Hukuman disiplin yang menahan proses KGB pada `hariIni`: yang ditandai berdampak KGB dan masih
 * berlaku sampai dengan tanggal berakhirnya (tanpa tanggal berakhir dianggap masih berlaku), sama
 * dengan hukdisMasihBerlaku di lib/hukdisKedaluwarsa.ts. Hukdis yang mulai sesudah `tmtKgb` menunda
 * KGB berikutnya, bukan KGB dengan TMT itu, sehingga tidak menahannya. Data lama tanpa riwayat hukdis
 * memakai penanda di data pegawai. `berakhir` null berarti tanggal berakhir belum ditetapkan.
 */
export function hukdisMenahanKgb(input: {
  riwayatHukdis: HukdisUntukKgb[];
  pegawai: {
    statusHukdis: boolean | null;
    tanggalHukdisBerakhir: NilaiTanggal;
    jenisHukdis: string | null;
  };
  hariIni: Date;
  /** TMT KGB yang akan diproses; kosong berarti tanggal mulai hukdis tidak diperiksa. */
  tmtKgb?: NilaiTanggal;
}): { menahan: false } | { menahan: true; berakhir: Date | null } {
  // Perbandingan inklusif yang sama dengan hukdisMasihBerlaku. Modul itu tidak diimpor karena
  // modul ini juga dipakai di peramban.
  const hari = new Date(input.hariIni.getFullYear(), input.hariIni.getMonth(), input.hariIni.getDate());
  const masihBerlaku = (tmt: NilaiTanggal) => {
    const berakhir = tanggalKalender(tmt);
    return !berakhir || berakhir >= hari;
  };
  const tmtKgb = tanggalKalender(input.tmtKgb);
  const hukdis = input.riwayatHukdis.find((h) => {
    if (h.berdampakKGB !== true || !masihBerlaku(h.tmtBerakhir)) return false;
    const mulai = tanggalKalender(h.tmtMulai);
    return !(tmtKgb && mulai && mulai > tmtKgb);
  });
  if (hukdis) return { menahan: true, berakhir: tanggalKalender(hukdis.tmtBerakhir) };
  const { pegawai } = input;
  if (
    input.riwayatHukdis.length === 0 &&
    pegawai.statusHukdis &&
    masihBerlaku(pegawai.tanggalHukdisBerakhir) &&
    (!pegawai.jenisHukdis || pegawai.jenisHukdis === "penundaan_kgb")
  ) {
    return { menahan: true, berakhir: tanggalKalender(pegawai.tanggalHukdisBerakhir) };
  }
  return { menahan: false };
}

/**
 * TMT KGB terakhir yang setara dengan keadaan pegawai sebelum Input KGB, untuk dipulihkan saat KGB
 * dibatalkan. Input KGB menambah MKG sebesar langkah tabel gaji atau jarak dari TMT terakhir bila
 * lebih panjang; TMT KGB dikurangi tambahan itu menghasilkan perhitungan yang sama saat KGB
 * diinput ulang. Mengembalikan null bila TMT tidak valid atau tidak ada tambahan MKG.
 */
export function tmtTerakhirSebelumInput(kgb: {
  tmtKgbBaru: NilaiTanggal;
  mkgTahunLama: number;
  mkgBulanLama: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
}): Date | null {
  const tmt = tanggalKalender(kgb.tmtKgbBaru);
  if (!tmt) return null;
  const tambah =
    ((kgb.mkgTahunBaru || 0) * 12 + (kgb.mkgBulanBaru || 0)) - ((kgb.mkgTahunLama || 0) * 12 + (kgb.mkgBulanLama || 0));
  if (!Number.isFinite(tambah) || tambah <= 0) return null;
  return tambahBulan(tmt, -tambah);
}

function waktuDibuat(v: NilaiTanggal): number {
  if (v === null || v === undefined || v === "") return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Id placeholder Belum Diproses kembar yang berlebih untuk dihapus; yang dipertahankan adalah yang
 * paling baru dibuat (lalu id terbesar), sehingga dua permintaan yang berjalan bersamaan memilih
 * placeholder yang sama.
 */
export function placeholderBerlebih(rows: { id: string; createdAt: NilaiTanggal }[]): string[] {
  const urut = [...rows].sort(
    (a, b) => waktuDibuat(b.createdAt) - waktuDibuat(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );
  return urut.slice(1).map((r) => r.id);
}

/**
 * Id record KGB kembar (Input KGB atau Arsip KGB untuk pegawai dan TMT yang sama) yang dibuat oleh
 * permintaan yang berjalan bersamaan. `rows` harus dalam urutan baca penyimpanan, yaitu urutan record
 * ditambahkan (baris spreadsheet; kolom urutan di Supabase). Yang dipertahankan adalah record yang
 * tertulis paling dulu, bukan yang createdAt-nya paling awal: createdAt diisi sebelum penulisan, jadi
 * permintaan yang menghitung waktu lebih dulu bisa menulis belakangan. Permintaan yang membaca sebelum
 * record kedua tertulis hanya melihat record-nya sendiri dan memang yang pertama, sedangkan permintaan
 * kedua melihat record pertama di depan, menghapus record-nya sendiri, lalu menolak.
 */
export function recordKgbKembarBerlebih(rows: { id: string }[]): string[] {
  return rows.slice(1).map((r) => r.id);
}

/** Batas ukuran berkas SK yang diunggah. */
export const BATAS_UKURAN_SK_BYTE = 10 * 1024 * 1024;
export const PESAN_SK_TERLALU_BESAR = "Ukuran file SK paling besar 10 MB.";

const PENANDA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** true bila penanda "%PDF-" ada di dalam `bytes`; pembaca PDF menerima beberapa byte sebelum penanda itu. */
export function adaPenandaPdf(bytes: Uint8Array): boolean {
  for (let i = 0; i + PENANDA_PDF.length <= bytes.length; i++) {
    if (PENANDA_PDF.every((b, j) => bytes[i + j] === b)) return true;
  }
  return false;
}
