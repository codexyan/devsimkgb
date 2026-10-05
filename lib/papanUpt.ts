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
export type KolomUpt = "kerja" | "kanwil" | "sk" | "selesai" | "kunci";

/**
 * Urutan pemilihan kartu utama, bukan urutan kolom di layar. Yang menunggu tindakan UPT didahulukan: "kerja"
 * (melengkapi atau memperbaiki usulan) lalu "sk" (merekam di Gaji Web). "kanwil" sedang ditunggu orang lain, dan
 * "selesai" tidak menuntut apa pun.
 */
const URUTAN_KOLOM: Record<KolomUpt, number> = { kerja: 0, sk: 1, kanwil: 2, selesai: 3, kunci: 4 };

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
  const hasil: Record<KolomUpt, KartuGabung<T>[]> = { kerja: [], kanwil: [], sk: [], selesai: [], kunci: [] };
  for (const g of gabung) hasil[g.kolom].push(g);
  for (const kolom of Object.keys(hasil) as KolomUpt[]) {
    hasil[kolom].sort((a, b) => (urutanKunci.get(a.kunci) ?? 0) - (urutanKunci.get(b.kunci) ?? 0));
  }
  return hasil;
}
