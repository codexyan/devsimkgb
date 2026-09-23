// Draf usulan UPT: isian yang belum dikirim, disimpan di peramban operator.
//
// Draf sengaja tidak dikirim ke server. Isian yang belum lengkap belum menjadi dokumen usulan, dan
// menyimpannya di Kanwil akan membuat antrian tinjauan berisi usulan setengah jadi yang tidak jelas
// boleh diproses atau tidak. Konsekuensinya dua: draf hanya ada di peramban dan perangkat yang dipakai
// mengetik, dan berkas PDF tidak ikut tersimpan karena peramban tidak mengizinkan berkas dibaca ulang
// tanpa dipilih pengguna. Keduanya disebutkan di layar supaya operator tidak salah sangka.

/** Bagian penyimpanan peramban yang dipakai; dipisah agar dapat diuji tanpa DOM. */
export interface PenyimpananDraf {
  getItem(kunci: string): string | null;
  setItem(kunci: string, nilai: string): void;
  removeItem(kunci: string): void;
  key(indeks: number): string | null;
  readonly length: number;
}

export interface DrafUsulan {
  jenis: "perubahan" | "baru";
  /** NIP yang diketik pada usulan pegawai baru; kosong pada usulan perubahan. */
  nipBaru: string;
  surat: Record<string, string>;
  hukdis: { ada: boolean; jenis: string; nomorSk: string; tmtMulai: string; tmtBerakhir: string; keterangan: string };
  isian: Record<string, string>;
  /** Waktu penyimpanan dalam ISO, dipakai untuk menampilkan "disimpan pukul …" dan membuang draf basi. */
  disimpanAt: string;
}

const AWALAN = "simkgb.draf-usulan.";
/** Draf yang lebih tua dari ini dianggap basi: datanya kemungkinan sudah berubah di Kanwil. */
export const MAKS_UMUR_DRAF_HARI = 30;

/** Kunci penyimpanan satu draf; "baru" untuk usulan pegawai yang belum tercatat. */
export function kunciDraf(satker: string, pegawaiId: string | null): string {
  return `${AWALAN}${satker}.${pegawaiId ?? "baru"}`;
}

function masihSegar(draf: DrafUsulan, sekarang: Date): boolean {
  const disimpan = new Date(draf.disimpanAt).getTime();
  if (!Number.isFinite(disimpan)) return false;
  return sekarang.getTime() - disimpan < MAKS_UMUR_DRAF_HARI * 24 * 60 * 60 * 1000;
}

function bentukBenar(nilai: unknown): nilai is DrafUsulan {
  if (typeof nilai !== "object" || nilai === null) return false;
  const d = nilai as Partial<DrafUsulan>;
  return (
    (d.jenis === "perubahan" || d.jenis === "baru") &&
    typeof d.nipBaru === "string" &&
    typeof d.disimpanAt === "string" &&
    typeof d.surat === "object" && d.surat !== null &&
    typeof d.isian === "object" && d.isian !== null &&
    typeof d.hukdis === "object" && d.hukdis !== null
  );
}

/**
 * Draf tersimpan untuk pegawai ini, atau null bila tidak ada, rusak, atau sudah basi. Draf basi ikut
 * dihapus supaya tidak menumpuk di peramban.
 */
export function bacaDraf(
  penyimpanan: PenyimpananDraf | null | undefined,
  kunci: string,
  sekarang: Date = new Date(),
): DrafUsulan | null {
  if (!penyimpanan) return null;
  try {
    const mentah = penyimpanan.getItem(kunci);
    if (!mentah) return null;
    const urai: unknown = JSON.parse(mentah);
    if (!bentukBenar(urai)) {
      penyimpanan.removeItem(kunci);
      return null;
    }
    if (!masihSegar(urai, sekarang)) {
      penyimpanan.removeItem(kunci);
      return null;
    }
    return urai;
  } catch {
    return null;
  }
}

/** Simpan draf; mengembalikan false bila penyimpanan peramban menolak, misalnya karena penuh. */
export function simpanDraf(
  penyimpanan: PenyimpananDraf | null | undefined,
  kunci: string,
  draf: Omit<DrafUsulan, "disimpanAt">,
  sekarang: Date = new Date(),
): boolean {
  if (!penyimpanan) return false;
  try {
    penyimpanan.setItem(kunci, JSON.stringify({ ...draf, disimpanAt: sekarang.toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function hapusDraf(penyimpanan: PenyimpananDraf | null | undefined, kunci: string): void {
  try {
    penyimpanan?.removeItem(kunci);
  } catch {
    // Penyimpanan yang tidak bisa ditulis tidak perlu menggagalkan apa pun.
  }
}

/**
 * Id pegawai yang punya draf tersimpan pada satker ini, plus "baru" bila ada draf pegawai baru.
 * Dipakai daftar pegawai untuk menandai baris yang isiannya belum terkirim.
 */
export function idBerdraf(
  penyimpanan: PenyimpananDraf | null | undefined,
  satker: string,
  sekarang: Date = new Date(),
): Set<string> {
  const hasil = new Set<string>();
  if (!penyimpanan) return hasil;
  const awalanSatker = `${AWALAN}${satker}.`;
  try {
    const kunci: string[] = [];
    for (let i = 0; i < penyimpanan.length; i++) {
      const k = penyimpanan.key(i);
      if (k && k.startsWith(awalanSatker)) kunci.push(k);
    }
    // Pembacaan dilakukan setelah daftar kunci lengkap, karena bacaDraf dapat menghapus draf basi.
    for (const k of kunci) {
      if (bacaDraf(penyimpanan, k, sekarang)) hasil.add(k.slice(awalanSatker.length));
    }
  } catch {
    return hasil;
  }
  return hasil;
}
