// Ringkasan usulan UPT yang menunggu, satu butir per UPT, untuk dasbor Super Admin dan Tim SDM (ADR-076).
//
// Satu UPT dapat mengirim puluhan sampai ratusan usulan sekaligus (mis. hasil Unggah daftar), dan daftar satu baris
// per pegawai memenuhi dasbor, apalagi di ponsel. Dasbor cukup menunjukkan UPT mana yang menunggu, berapa banyak, dan
// sudah berapa lama; yang meninjau tiap pegawai dan menyetujui per surat bekerja di halaman Usulan UPT.
//
// Murni: tanpa React dan tanpa jaringan, agar dapat diuji.

export interface UsulanUntukRingkasan {
  unitKerja: string;
  nomorSurat: string | null;
  diajukanAt: string | null;
}

export interface RingkasanUpt {
  /** Kunci saringan UPT di halaman Usulan UPT (kode satker baku bila dikenali, selain itu teks unit kerjanya). */
  kode: string;
  unitKerja: string;
  jumlah: number;
  /** Jumlah nomor surat yang berbeda. */
  surat: number;
  /** Usulan tanpa nomor surat: laporan SK kenaikan pangkat atau PMK, yang berangkat tanpa surat usulan (ADR-046). */
  tanpaSurat: number;
  /** Umur usulan tertua dalam hari penuh; 0 bila belum genap sehari atau tanggalnya tidak diketahui. */
  hariTerlama: number;
}

const SEHARI = 86_400_000;

/** UPT dengan usulan terbanyak lebih dulu, lalu menurut nama. */
export function ringkasUsulanPerUpt(
  daftar: readonly UsulanUntukRingkasan[],
  sekarang: Date,
  kodeDari: (unitKerja: string) => string,
): RingkasanUpt[] {
  const peta = new Map<string, { unitKerja: string; jumlah: number; surat: Set<string>; tanpaSurat: number; tertua: number | null }>();
  for (const u of daftar) {
    const kode = kodeDari(u.unitKerja);
    const butir = peta.get(kode) ?? { unitKerja: u.unitKerja, jumlah: 0, surat: new Set<string>(), tanpaSurat: 0, tertua: null };
    butir.jumlah += 1;
    const surat = u.nomorSurat?.trim();
    if (surat) butir.surat.add(surat);
    else butir.tanpaSurat += 1;
    const waktu = u.diajukanAt ? new Date(u.diajukanAt).getTime() : NaN;
    if (Number.isFinite(waktu) && (butir.tertua === null || waktu < butir.tertua)) butir.tertua = waktu;
    peta.set(kode, butir);
  }
  return [...peta.entries()]
    .map(([kode, b]) => ({
      kode,
      unitKerja: b.unitKerja,
      jumlah: b.jumlah,
      surat: b.surat.size,
      tanpaSurat: b.tanpaSurat,
      hariTerlama: b.tertua === null ? 0 : Math.max(0, Math.floor((sekarang.getTime() - b.tertua) / SEHARI)),
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.unitKerja.localeCompare(b.unitKerja, "id"));
}

/** Keterangan satu UPT dalam satu kalimat pendek: "48 usulan · 2 surat · 3 laporan SK · terlama 5 hari". */
export function keteranganRingkasan(r: RingkasanUpt): string {
  return [
    `${r.jumlah} usulan`,
    r.surat > 0 ? `${r.surat} surat` : null,
    r.tanpaSurat > 0 ? `${r.tanpaSurat} laporan SK` : null,
    r.hariTerlama > 0 ? `terlama ${r.hariTerlama} hari` : "diajukan hari ini",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Nada penanda umur: lewat 14 hari merah, lewat 7 hari kuning; ambang yang sama dengan penanda usulan di dasbor. */
export function nadaUmurUsulan(hari: number): "merah" | "kuning" | "ungu" {
  return hari > 14 ? "merah" : hari > 7 ? "kuning" : "ungu";
}
