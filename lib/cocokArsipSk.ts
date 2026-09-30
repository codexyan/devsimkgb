// Pencocokan SK yang diarsipkan dengan hitungan sistem (ADR-035).
//
// Arsip KGB mencatat SK yang terbit di luar SIM-KGB. Angka yang tersimpan tidak pernah diambil dari
// ketikan operator: gaji pokok dan masa kerja golongan tetap dihitung dari tabel PP 5/2024 (lib/tabelGaji.ts),
// sebab salah ketik di situ langsung menggeser uang. Yang diketik di sini hanyalah angka yang **tertulis
// pada SK**, dan gunanya sebagai pembanding.
//
// Sebabnya satu kejadian nyata pada September 2026. Sebuah SK KGB yang terlambat beberapa tahun diarsipkan
// berulang kali dan tiap kali menghasilkan angka yang berbeda, tidak satu pun cocok dengan SK-nya. Rumusnya
// ternyata benar: kalkulasiKGB sudah menambah masa kerja sebesar jarak nyata dari TMT terakhir bila KGB
// tertunda. Yang keliru adalah masa kerja golongan pegawainya, meleset tujuh bulan, dan tidak ada yang
// menyadarinya karena sistem tidak pernah membandingkan hasilnya dengan SK yang sedang dipegang operator.
//
// Karena itu ketidakcocokan di sini bukan untuk dilewati, melainkan untuk menghentikan pengarsipan dan
// menunjuk sebab yang sebenarnya: data dasar pegawai perlu diperiksa lebih dulu.

export interface AngkaSk {
  /** Masa kerja golongan yang tertulis pada SK, pada baris "Berdasarkan Masa Kerja". */
  mkgTahun: number;
  mkgBulan: number;
  /** Gaji pokok baru yang tertulis pada SK, dalam rupiah penuh. */
  gajiPokok: number;
}

export interface AngkaSistem {
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
}

export interface BedaArsip {
  label: string;
  sistem: string;
  sk: string;
}

const mkgTeks = (tahun: number, bulan: number) => `${tahun} tahun ${bulan} bulan`;
const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

/**
 * Bandingkan angka pada SK dengan hitungan sistem. Daftar kosong berarti cocok dan arsip boleh dicatat.
 *
 * Gaji pokok dibandingkan apa adanya: bila masa kerjanya sama, tabel gaji pasti menghasilkan angka yang
 * sama, jadi selisih di sini berarti golongan pegawainya yang keliru, bukan sekadar masa kerjanya.
 */
export function bedaArsipSk(sistem: AngkaSistem, sk: AngkaSk): BedaArsip[] {
  const beda: BedaArsip[] = [];
  if (sistem.mkgTahun !== sk.mkgTahun || sistem.mkgBulan !== sk.mkgBulan) {
    beda.push({
      label: "Masa kerja golongan",
      sistem: mkgTeks(sistem.mkgTahun, sistem.mkgBulan),
      sk: mkgTeks(sk.mkgTahun, sk.mkgBulan),
    });
  }
  if (sistem.gajiPokok !== sk.gajiPokok) {
    beda.push({ label: "Gaji pokok", sistem: rupiah(sistem.gajiPokok), sk: rupiah(sk.gajiPokok) });
  }
  return beda;
}

/**
 * Kalimat yang dibaca operator saat angkanya tidak cocok. Sengaja menunjuk data dasar pegawai, bukan
 * menyalahkan SK: SK adalah dokumen yang sudah ditandatangani, sedangkan data dasarlah yang dapat dan
 * perlu diperbaiki lebih dulu.
 */
export function pesanBedaArsip(beda: readonly BedaArsip[]): string {
  if (beda.length === 0) return "";
  const rinci = beda.map((b) => `${b.label} menurut sistem ${b.sistem}, menurut SK ${b.sk}`).join("; ");
  return (
    `Angka pada SK tidak cocok dengan hitungan sistem: ${rinci}. ` +
    "Biasanya masa kerja golongan atau golongan pegawai pada Data Pegawai yang belum sesuai SK dasarnya. " +
    "Periksa dan perbaiki data pegawainya lebih dulu, baru arsipkan SK ini."
  );
}

/** Angka SK dari isian mentah; null bila ada yang belum diisi atau bukan angka yang masuk akal. */
export function bacaAngkaSk(input: {
  mkgTahun?: unknown;
  mkgBulan?: unknown;
  gajiPokok?: unknown;
}): AngkaSk | null {
  const angka = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      // Operator lazim mengetik gaji pokok dengan titik pemisah ribuan, persis seperti tertulis di SK.
      const bersih = Number(v.replace(/[.\s]/g, "").replace(",", "."));
      return Number.isFinite(bersih) ? bersih : null;
    }
    return null;
  };
  const mkgTahun = angka(input.mkgTahun);
  const mkgBulan = angka(input.mkgBulan);
  const gajiPokok = angka(input.gajiPokok);
  if (mkgTahun === null || mkgBulan === null || gajiPokok === null) return null;
  if (mkgTahun < 0 || mkgTahun > 40 || mkgBulan < 0 || mkgBulan > 11 || gajiPokok <= 0) return null;
  return { mkgTahun: Math.trunc(mkgTahun), mkgBulan: Math.trunc(mkgBulan), gajiPokok: Math.trunc(gajiPokok) };
}
