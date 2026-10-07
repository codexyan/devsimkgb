// Papan alur KGB satker: satu pegawai, satu kartu (ADR-026).
//
// Papan UPT semula menyusun kartu per dokumen: satu kartu tiap usulan, tiap KGB yang sedang diproses, tiap SK, dan
// tiap laporan. Akibatnya satu orang dapat muncul beberapa kali, padahal judul papannya menjanjikan "tiap pegawai
// berada di kolom tahapnya". Yang paling sering terlihat: pegawai yang usulan perbaikannya dikirim dua kali muncul
// dua kartu di kolom Selesai, dan pegawai yang KGB-nya sedang diproses sekaligus punya usulan berjalan muncul dua
// kartu di kolom Di Kanwil.
//
// Modul ini menggabungkannya: dokumen milik orang yang sama menjadi satu kartu di kolom yang paling perlu
// dikerjakan, dan dokumen lainnya disebut sebagai keterangan di kartu itu. Murni agar dapat diuji tanpa React.

/**
 * "kunci" adalah draf data yang masa usul KGB-nya belum dibuka (ADR-059). Bukan kolom tersendiri di layar: ia tampil
 * terlipat di bawah Perlu dikerjakan. Dipisah di sini supaya kalah dari dokumen lain milik pegawai yang sama, misalnya
 * SK terbit yang harus direkam di Gaji Web, alih-alih menyeretnya ikut terlipat.
 */
export type KolomUpt = "kerja" | "kanwil" | "periksa" | "sk" | "selesai" | "kunci";

/**
 * Urutan pemilihan kartu utama, bukan urutan kolom di layar. Yang menunggu tindakan UPT didahulukan: "kerja"
 * (melengkapi atau memperbaiki usulan), "periksa" (SK KGB buatan Kanwil yang menunggu review UPT, ADR-079), lalu "sk"
 * (merekam di Gaji Web). "kanwil" sedang ditunggu orang lain, dan "selesai" tidak menuntut apa pun.
 */
const URUTAN_KOLOM: Record<KolomUpt, number> = { kerja: 0, periksa: 1, sk: 2, kanwil: 3, selesai: 4, kunci: 5 };

export interface SumberKartu {
  /** Kunci unik sumbernya, mis. "usulan:<id>", "sk:<id>", "proses:<id>". */
  kunci: string;
  kolom: KolomUpt;
  /** Kosong pada usulan pegawai baru yang belum disetujui. */
  pegawaiId: string | null;
  nip: string;
  /** Waktu dokumen ini, ISO atau yyyy-mm-dd; yang terbaru menang bila sekolom. */
  waktu?: string | null;
  /** Kalimat pendek bila kartu ini bukan yang utama, mis. "usulan perbaikan disetujui 26 Sep". */
  ringkas: string;
}

export interface KartuGabung<T extends SumberKartu> {
  /** Kunci sumber utamanya; dipakai sebagai key React. */
  kunci: string;
  kolom: KolomUpt;
  utama: T;
  /** Dokumen lain milik pegawai yang sama, terbaru lebih dulu. */
  lain: T[];
}

/** NIP dalam bentuk pembanding: hanya angka. */
const nipKunci = (nip: string) => nip.replace(/\D/g, "");

/**
 * Identitas pegawai tiap sumber. Sumber yang membawa pegawaiId menyatukan NIP-nya, sehingga usulan pegawai baru
 * (tanpa pegawaiId) tetap tergabung dengan pegawai yang NIP-nya sama.
 */
function petaIdentitas(sumber: readonly SumberKartu[]): Map<string, string> {
  const nipKePegawai = new Map<string, string>();
  for (const s of sumber) {
    const nip = nipKunci(s.nip);
    if (s.pegawaiId && nip) nipKePegawai.set(nip, s.pegawaiId);
  }
  return nipKePegawai;
}

function identitas(s: SumberKartu, nipKePegawai: Map<string, string>): string {
  if (s.pegawaiId) return `p:${s.pegawaiId}`;
  const nip = nipKunci(s.nip);
  const pegawaiId = nip ? nipKePegawai.get(nip) : undefined;
  if (pegawaiId) return `p:${pegawaiId}`;
  return nip ? `n:${nip}` : `k:${s.kunci}`;
}

/** Terbaru lebih dulu; yang tanpa waktu paling belakang. */
function lebihBaru(a: SumberKartu, b: SumberKartu): number {
  return (b.waktu ?? "").localeCompare(a.waktu ?? "");
}

/**
 * Gabungkan sumber kartu menjadi satu kartu per pegawai. Kartu utamanya diambil dari kolom yang paling perlu
 * dikerjakan; bila sekolom, dokumen terbaru yang menang. Urutan di dalam tiap kolom mengikuti urutan sumber asli,
 * sehingga penyusunan kolom di layar tidak berubah.
 */
export function gabungKartuUpt<T extends SumberKartu>(sumber: readonly T[]): KartuGabung<T>[] {
  const nipKePegawai = petaIdentitas(sumber);
  const perPegawai = new Map<string, T[]>();
  const urutanMasuk: string[] = [];
  for (const s of sumber) {
    const id = identitas(s, nipKePegawai);
    const daftar = perPegawai.get(id);
    if (daftar) daftar.push(s);
    else {
      perPegawai.set(id, [s]);
      urutanMasuk.push(id);
    }
  }

  const hasil: KartuGabung<T>[] = [];
  for (const id of urutanMasuk) {
    const daftar = perPegawai.get(id)!;
    const urut = [...daftar].sort(
      (a, b) => URUTAN_KOLOM[a.kolom] - URUTAN_KOLOM[b.kolom] || lebihBaru(a, b),
    );
    const [utama, ...lain] = urut;
    hasil.push({ kunci: utama.kunci, kolom: utama.kolom, utama, lain });
  }
  return hasil;
}

/** Kartu gabungan per kolom, urutannya mengikuti urutan sumber asli di kolom itu. */
export function kartuPerKolom<T extends SumberKartu>(
  sumber: readonly T[],
): Record<KolomUpt, KartuGabung<T>[]> {
  const gabung = gabungKartuUpt(sumber);
  const urutanKunci = new Map(sumber.map((s, i) => [s.kunci, i]));
  const hasil: Record<KolomUpt, KartuGabung<T>[]> = { kerja: [], kanwil: [], periksa: [], sk: [], selesai: [], kunci: [] };
  for (const g of gabung) hasil[g.kolom].push(g);
  for (const kolom of Object.keys(hasil) as KolomUpt[]) {
    hasil[kolom].sort((a, b) => (urutanKunci.get(a.kunci) ?? 0) - (urutanKunci.get(b.kunci) ?? 0));
  }
  return hasil;
}

/**
 * Tahap satu KGB dari kacamata UPT (ADR-082). Kartu menampilkannya supaya perpindahan antar-kolom terbaca sebagai maju:
 * kartu yang kembali ke Di Kanwil sesudah Periksa SK sedang menunggu tanda tangan, bukan mundur.
 */
export const TAHAP_KGB_UPT = ["Usulan", "Disetujui", "SK dibuat", "Diperiksa", "TTE", "Direkam"] as const;

export type KeadaanTahap =
  | "usulan_disiapkan"
  | "usulan_ditinjau"
  | "menunggu_proses"
  | "sk_dibuat"
  | "sk_diperiksa"
  | "sk_diperbaiki"
  | "tte"
  | "sk_terbit"
  | "selesai";

/** Indeks tahap yang sedang berjalan (0 sampai 5); 6 berarti semua tahap selesai. */
export function indeksTahap(k: KeadaanTahap): number {
  switch (k) {
    case "usulan_disiapkan":
      return 0;
    case "usulan_ditinjau":
      return 1;
    case "menunggu_proses":
    case "sk_dibuat":
    case "sk_diperbaiki":
      return 2;
    case "sk_diperiksa":
      return 3;
    case "tte":
      return 4;
    case "sk_terbit":
      return 5;
    case "selesai":
      return 6;
  }
}

/** Keadaan tahap KGB yang sedang diproses Kanwil menurut status review SK-nya. */
export function tahapProsesKgb(statusReview: string | null | undefined): KeadaanTahap {
  if (statusReview === "menunggu") return "sk_diperiksa";
  if (statusReview === "perbaikan") return "sk_diperbaiki";
  if (statusReview === "disetujui" || statusReview === "sesuai" || statusReview === "dilewati") return "tte";
  return "sk_dibuat";
}
