// Kartu satker di dasbor Kanwil: pekerjaan tiap satker dipecah per bulan TMT (ADR-036).
//
// Panel Pantau satker sebelumnya hanya memberi lima angka gabungan per satker — lewat batas, perlu input,
// diproses, di keuangan, usulan — tanpa menyebut bulan TMT sama sekali. Akibatnya "Rutan Rantau 5" tidak
// dapat ditindaklanjuti: lima itu jatuh di bulan yang mana, dan mana yang mendesak, tidak terbaca. Panel
// Jadwal input memang memecah per bulan TMT, tetapi se-Kanwil, sehingga tidak menjawab satker mana.
//
// Modul ini menggabungkan keduanya: satu kartu per satker, berisi baris per bulan TMT beserta tahap yang
// paling perlu dikerjakan di bulan itu. Murni, tanpa React dan tanpa lapisan data, supaya urutan dan
// pengelompokannya dapat diuji sendiri.

/** Posisi satu pegawai dalam antrian kerja KGB; sama dengan PosisiAntrian di dasbor. */
export type PosisiKartu = "lewat" | "diproses" | "siap" | "keuangan" | "rekam_upt" | "terkunci" | "selesai";

/**
 * Urutan mendesak, dipakai dua kali: memilih posisi yang mewakili satu bulan, dan mengurutkan satker.
 * Angka kecil berarti lebih perlu dikerjakan. Sama dengan URUTAN_POSISI di dasbor, dan memang harus sama:
 * kartu yang bilang "lewat batas" sementara papannya menaruh orang itu di kolom lain hanya membingungkan.
 */
const URUTAN: Record<PosisiKartu, number> = {
  lewat: 0,
  diproses: 1,
  siap: 2,
  keuangan: 3,
  rekam_upt: 4,
  terkunci: 5,
  selesai: 6,
};

export interface EntriKartu {
  /** Kode satker pegawai ini. */
  kode: string;
  /** Bulan TMT KGB-nya, "yyyy-mm"; null bila TMT-nya belum tercatat. */
  bulanTmt: string | null;
  posisi: PosisiKartu;
}

export interface BulanKartu {
  bulanTmt: string;
  jumlah: number;
  /** Posisi paling mendesak di bulan ini; menentukan warna barisnya. */
  utama: PosisiKartu;
  perPosisi: Partial<Record<PosisiKartu, number>>;
}

export interface KartuSatker {
  kode: string;
  /** Jumlah pegawai yang punya pekerjaan, di luar yang sudah selesai. */
  jumlah: number;
  /** Berapa yang sudah selesai; ditampilkan sebagai keterangan, bukan sebagai pekerjaan. */
  selesai: number;
  /** Usulan data yang menunggu tinjauan dari satker ini. */
  usulan: number;
  /** Posisi paling mendesak di seluruh satker ini. */
  utama: PosisiKartu | null;
  bulan: BulanKartu[];
  /** Bulan TMT yang tidak tercatat; dipisah agar tidak mengarang tanggal. */
  tanpaBulan: number;
}

const lebihMendesak = (a: PosisiKartu, b: PosisiKartu) => (URUTAN[a] <= URUTAN[b] ? a : b);

/**
 * Susun kartu per satker. Satker tanpa pekerjaan dan tanpa usulan tidak menghasilkan kartu: dasbor
 * menyebutkan jumlahnya sebagai satu baris, bukan belasan kartu kosong.
 *
 * Urutannya: yang paling mendesak lebih dulu, lalu yang pekerjaannya paling banyak, lalu abjad kode.
 * Bulan di dalam kartu urut menaik, sebab yang terdekat TMT-nya yang lebih dulu dikerjakan.
 */
export function susunKartuSatker(
  entri: readonly EntriKartu[],
  usulanPerSatker: ReadonlyMap<string, number> = new Map(),
): KartuSatker[] {
  const peta = new Map<string, KartuSatker>();
  const ambil = (kode: string): KartuSatker => {
    const ada = peta.get(kode);
    if (ada) return ada;
    const baru: KartuSatker = { kode, jumlah: 0, selesai: 0, usulan: 0, utama: null, bulan: [], tanpaBulan: 0 };
    peta.set(kode, baru);
    return baru;
  };

  const perBulan = new Map<string, Map<string, BulanKartu>>();

  for (const e of entri) {
    const kartu = ambil(e.kode);
    if (e.posisi === "selesai") {
      kartu.selesai += 1;
      continue;
    }
    kartu.jumlah += 1;
    kartu.utama = kartu.utama ? lebihMendesak(kartu.utama, e.posisi) : e.posisi;
    if (!e.bulanTmt) {
      kartu.tanpaBulan += 1;
      continue;
    }
    const bulanSatker = perBulan.get(e.kode) ?? new Map<string, BulanKartu>();
    perBulan.set(e.kode, bulanSatker);
    const b = bulanSatker.get(e.bulanTmt) ?? { bulanTmt: e.bulanTmt, jumlah: 0, utama: e.posisi, perPosisi: {} };
    b.jumlah += 1;
    b.utama = lebihMendesak(b.utama, e.posisi);
    b.perPosisi[e.posisi] = (b.perPosisi[e.posisi] ?? 0) + 1;
    bulanSatker.set(e.bulanTmt, b);
  }

  for (const [kode, jumlah] of usulanPerSatker) {
    if (jumlah > 0) ambil(kode).usulan = jumlah;
  }

  for (const [kode, bulanSatker] of perBulan) {
    ambil(kode).bulan = [...bulanSatker.values()].sort((a, b) => a.bulanTmt.localeCompare(b.bulanTmt));
  }

  return [...peta.values()]
    .filter((k) => k.jumlah > 0 || k.usulan > 0)
    .sort(
      (a, b) =>
        (a.utama ? URUTAN[a.utama] : 99) - (b.utama ? URUTAN[b.utama] : 99) ||
        b.jumlah - a.jumlah ||
        a.kode.localeCompare(b.kode, "id"),
    );
}

/** Ringkasan satu baris bulan, misalnya "2 lewat batas · 1 di keuangan". */
export const LABEL_POSISI: Record<PosisiKartu, string> = {
  lewat: "lewat batas",
  diproses: "sedang diproses",
  siap: "perlu input",
  keuangan: "di keuangan",
  rekam_upt: "rekam di Gaji Web",
  terkunci: "belum dibuka",
  selesai: "selesai",
};

export function ringkasBulan(b: BulanKartu): string {
  return (Object.keys(URUTAN) as PosisiKartu[])
    .filter((p) => b.perPosisi[p])
    .map((p) => `${b.perPosisi[p]} ${LABEL_POSISI[p]}`)
    .join(" · ");
}
