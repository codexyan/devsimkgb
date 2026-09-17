// Pemeriksaan dan ringkasan perubahan isian jenis hukuman disiplin dari halaman Konfigurasi Hukdis.
// Rentang nilainya sama dengan batas masukan di halaman itu. Modul ini murni (tanpa akses data).

export const KATEGORI_HUKDIS = ["ringan", "sedang", "berat"] as const;

/** Isian jenis hukdis; field yang tidak dikirim bernilai undefined. */
export interface IsianJenisHukdis {
  label?: unknown;
  kategori?: unknown;
  dasarHukum?: unknown;
  regulasiId?: unknown;
  durasiHukdis?: unknown;
  berdampakKGB?: unknown;
  durasiTunda?: unknown;
  aktif?: unknown;
}

function bulatDalamRentang(nilai: unknown, min: number, maks: number): boolean {
  return typeof nilai === "number" && Number.isInteger(nilai) && nilai >= min && nilai <= maks;
}

/**
 * Pesan galat pertama untuk isian jenis hukdis; null bila valid. Field yang tidak dikirim tidak
 * diperiksa, sehingga dapat dipakai untuk perubahan sebagian. Lama penundaan KGB boleh null hanya
 * bila jenis itu tidak berdampak KGB.
 */
export function galatIsianJenisHukdis(isian: IsianJenisHukdis): string | null {
  if (isian.label !== undefined && (typeof isian.label !== "string" || !isian.label.trim())) {
    return "Nama jenis wajib diisi";
  }
  if (isian.kategori !== undefined && !(KATEGORI_HUKDIS as readonly unknown[]).includes(isian.kategori)) {
    return "Kategori tidak valid";
  }
  if (isian.dasarHukum !== undefined && isian.dasarHukum !== null && typeof isian.dasarHukum !== "string") {
    return "Dasar peraturan tidak valid";
  }
  if (isian.regulasiId !== undefined && isian.regulasiId !== null && typeof isian.regulasiId !== "string") {
    return "Regulasi tidak valid";
  }
  if (isian.durasiHukdis !== undefined && !bulatDalamRentang(isian.durasiHukdis, 0, 120)) {
    return "Lama hukuman disiplin harus bilangan bulat 0 sampai 120 bulan";
  }
  if (isian.berdampakKGB !== undefined && typeof isian.berdampakKGB !== "boolean") {
    return "Penanda berdampak KGB tidak valid";
  }
  if (isian.aktif !== undefined && typeof isian.aktif !== "boolean") {
    return "Status aktif tidak valid";
  }
  if (isian.durasiTunda !== undefined && isian.durasiTunda !== null && !bulatDalamRentang(isian.durasiTunda, 1, 60)) {
    return "Lama penundaan KGB harus bilangan bulat 1 sampai 60 bulan";
  }
  if (isian.berdampakKGB === true && isian.durasiTunda === null) {
    return "Lama penundaan KGB wajib diisi untuk jenis yang berdampak KGB";
  }
  return null;
}

const KOLOM_PERUBAHAN: { kolom: keyof IsianJenisHukdis; nama: string; format: (v: unknown) => string }[] = [
  { kolom: "label", nama: "nama", format: (v) => `"${String(v ?? "")}"` },
  { kolom: "kategori", nama: "kategori", format: (v) => String(v ?? "-") },
  { kolom: "dasarHukum", nama: "dasar hukum", format: (v) => `"${String(v ?? "")}"` },
  { kolom: "durasiHukdis", nama: "lama hukdis", format: (v) => (v === null || v === undefined ? "-" : `${v} bulan`) },
  { kolom: "berdampakKGB", nama: "berdampak KGB", format: (v) => (v === true ? "Ya" : "Tidak") },
  { kolom: "durasiTunda", nama: "lama penundaan KGB", format: (v) => (v === null || v === undefined ? "-" : `${v} bulan`) },
  { kolom: "aktif", nama: "aktif", format: (v) => (v === true ? "Ya" : "Tidak") },
];

/** Daftar perubahan yang terbaca untuk riwayat aktivitas, misalnya `berdampak KGB Ya menjadi Tidak`. */
export function ringkasanPerubahanJenisHukdis(lama: IsianJenisHukdis, baru: IsianJenisHukdis): string[] {
  const hasil: string[] = [];
  for (const { kolom, nama, format } of KOLOM_PERUBAHAN) {
    const nilaiBaru = baru[kolom];
    if (nilaiBaru === undefined) continue;
    const nilaiLama = lama[kolom] ?? null;
    if ((nilaiBaru ?? null) === nilaiLama) continue;
    hasil.push(`${nama} ${format(nilaiLama)} menjadi ${format(nilaiBaru)}`);
  }
  return hasil;
}

const KOLOM_ATURAN = ["label", "kategori", "durasiHukdis", "berdampakKGB", "durasiTunda", "aktif"] as const;

/**
 * Field aturan jenis hukdis yang benar-benar berubah dari nilai tersimpan, setelah diperiksa. Field yang
 * sama dengan nilai tersimpan tidak diperiksa ulang, sehingga baris lama dengan sel kosong tetap dapat
 * disimpan. Lama penundaan diperiksa terhadap keadaan akhir: wajib 1 sampai 60 bulan bila jenis
 * berdampak KGB, dan dikosongkan bila tidak (hanya bila salah satu dari kedua field itu dikirim).
 * Dasar hukum dan regulasi diperiksa terpisah.
 */
export function perubahanJenisHukdis(
  lama: IsianJenisHukdis,
  isian: IsianJenisHukdis,
): { perubahan: IsianJenisHukdis; galat?: undefined } | { galat: string } {
  const perubahan: IsianJenisHukdis = {};
  for (const kolom of KOLOM_ATURAN) {
    let nilai = isian[kolom];
    if (nilai === undefined) continue;
    if (kolom === "label" && typeof nilai === "string") nilai = nilai.trim();
    if (nilai === (lama[kolom] ?? null)) continue;
    perubahan[kolom] = nilai;
  }
  const galat = galatIsianJenisHukdis(perubahan);
  if (galat) return { galat };

  const berdampak = perubahan.berdampakKGB !== undefined ? perubahan.berdampakKGB : lama.berdampakKGB;
  const durasiTunda = perubahan.durasiTunda !== undefined ? perubahan.durasiTunda : (lama.durasiTunda ?? null);
  if (berdampak === true) {
    if (!bulatDalamRentang(durasiTunda, 1, 60)) {
      return { galat: "Lama penundaan KGB wajib diisi 1 sampai 60 bulan untuk jenis yang berdampak KGB" };
    }
  } else if (durasiTunda !== null && (isian.berdampakKGB !== undefined || isian.durasiTunda !== undefined)) {
    perubahan.durasiTunda = null;
  }
  return { perubahan };
}

/**
 * TMT berakhir hukdis yang diisi otomatis dari TMT mulai dan masa hukdis, seperti penulisan "s.d." di SK:
 * 1 Januari 2026 selama 12 bulan berakhir 31 Desember 2026. Hari yang tidak ada di bulan tujuan
 * dibulatkan ke akhir bulan sebelum dikurangi satu hari. Masukan dan hasil berbentuk "yyyy-mm-dd";
 * hasil "" bila masukan tidak valid.
 */
export function tmtBerakhirOtomatis(tmtMulai: string, durasiBulan: number): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tmtMulai);
  if (!cocok || !Number.isInteger(durasiBulan) || durasiBulan <= 0) return "";
  const [tahun, bulan, hari] = [Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3])];
  const hariTerakhirBulanTujuan = new Date(tahun, bulan + durasiBulan + 1, 0).getDate();
  const akhir = new Date(tahun, bulan + durasiBulan, Math.min(hari, hariTerakhirBulanTujuan) - 1);
  if (Number.isNaN(akhir.getTime())) return "";
  const b = String(akhir.getMonth() + 1).padStart(2, "0");
  const h = String(akhir.getDate()).padStart(2, "0");
  return `${akhir.getFullYear()}-${b}-${h}`;
}
