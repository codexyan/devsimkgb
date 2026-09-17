// Status hukuman disiplin pegawai menurut tanggal berakhirnya. Hukdis berlaku sampai dengan tanggal
// berakhir menurut WITA; hukdis tanpa tanggal berakhir dianggap masih berlaku.
// Fungsi murni dipakai saat membaca data, sehingga penanda yang sudah lewat tidak ditampilkan
// sebagai hukdis aktif. bersihkanHukdisKedaluwarsa dipanggil cron harian untuk menyelaraskan
// penanda di data pegawai.

import { hariIniWita, tanggalKalender, type NilaiTanggal } from "./waktu";

/** Baris tab RiwayatHukdis. tmtSetelahTunda hanya terisi bila kolomnya sudah ada di tabel. */
export type RiwayatHukdisRow = {
  id: string;
  pegawaiId: string;
  jenisHukdis: string;
  nomorSK: string;
  tanggalSK: Date | null;
  tmtMulai: Date | null;
  tmtBerakhir: Date | null;
  berdampakKGB: boolean | null;
  durasiTunda: number | null;
  dasarHukum: string | null;
  keterangan: string | null;
  createdAt: Date | null;
  createdBy: string;
  tmtSetelahTunda?: Date | null;
};

/** Penanda hukdis yang disimpan pada data pegawai. */
type PenandaHukdisPegawai = {
  statusHukdis: boolean;
  tanggalHukdisBerakhir: Date | null;
  jenisHukdis: string | null;
  keteranganHukdis: string | null;
};

type HukdisUntukRingkasan =Pick<RiwayatHukdisRow, "jenisHukdis" | "tmtBerakhir" | "keterangan">;

const TANPA_HUKDIS: PenandaHukdisPegawai = {
  statusHukdis: false,
  tanggalHukdisBerakhir: null,
  jenisHukdis: null,
  keteranganHukdis: null,
};

/** true bila hukdis dengan tanggal berakhir ini masih berlaku pada hari ini (bawaan: hari ini WITA). */
export function hukdisMasihBerlaku(tmtBerakhir: NilaiTanggal, hariIni: Date = hariIniWita()): boolean {
  const berakhir = tanggalKalender(tmtBerakhir);
  if (!berakhir) return true;
  return berakhir >= new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
}

/** Data pegawai dengan penanda hukdis yang sudah lewat tanggal berakhirnya dibaca sebagai tidak aktif. */
export function penandaHukdisBerlaku<T extends PenandaHukdisPegawai>(pegawai: T, hariIni?: Date): T {
  if (!pegawai.statusHukdis || !pegawai.tanggalHukdisBerakhir) return pegawai;
  if (hukdisMasihBerlaku(pegawai.tanggalHukdisBerakhir, hariIni)) return pegawai;
  return { ...pegawai, ...TANPA_HUKDIS };
}

/**
 * Penanda hukdis pegawai dari riwayat hukdisnya: aktif bila ada yang masih berlaku, dengan jenis,
 * keterangan, dan tanggal berakhir dari hukdis berlaku yang berakhir paling akhir. Bila sama,
 * yang terakhir dalam daftar dipakai, sehingga daftar sebaiknya urut menurut waktu pencatatan.
 */
export function ringkasanHukdisPegawai(daftar: HukdisUntukRingkasan[], hariIni?: Date): PenandaHukdisPegawai {
  let terpilih: HukdisUntukRingkasan | null = null;
  let berakhirTerpilih: Date | null = null;
  for (const h of daftar) {
    if (!hukdisMasihBerlaku(h.tmtBerakhir, hariIni)) continue;
    const berakhir = tanggalKalender(h.tmtBerakhir);
    const lebihAkhir = !terpilih || !berakhir || (berakhirTerpilih !== null && berakhir >= berakhirTerpilih);
    if (lebihAkhir) {
      terpilih = h;
      berakhirTerpilih = berakhir;
    }
  }
  if (!terpilih) return { ...TANPA_HUKDIS };
  return {
    statusHukdis: true,
    tanggalHukdisBerakhir: terpilih.tmtBerakhir ?? null,
    jenisHukdis: terpilih.jenisHukdis || null,
    keteranganHukdis: terpilih.keterangan || null,
  };
}

/**
 * Penanda baru untuk pegawai yang penanda hukdisnya sudah lewat tanggal berakhir; null bila tidak
 * perlu diubah. Bila ada riwayat hukdis lain yang masih berlaku, penanda diambil dari riwayat itu.
 */
export function penyelarasanHukdisPegawai(
  pegawai: PenandaHukdisPegawai,
  riwayat: HukdisUntukRingkasan[],
  hariIni?: Date,
): PenandaHukdisPegawai | null {
  if (penandaHukdisBerlaku(pegawai, hariIni) === pegawai) return null;
  return ringkasanHukdisPegawai(riwayat, hariIni);
}

/**
 * Nonaktifkan penanda hukdis pegawai yang sudah lewat tanggal berakhirnya. Dipanggil cron harian;
 * route baca tidak menulis data. Mengembalikan jumlah pegawai yang diperbarui.
 */
export async function bersihkanHukdisKedaluwarsa(sekarang: Date = new Date()): Promise<{ diperbarui: number }> {
  // Diimpor saat dipanggil agar fungsi murni di atas dapat diuji tanpa lapisan data.
  const { db } = await import("./db");
  const hariIni = hariIniWita(sekarang);

  const kedaluwarsa = (await db.pegawai.findMany({ where: { statusHukdis: true } })).filter(
    (p) => penandaHukdisBerlaku(p, hariIni) !== p,
  );
  if (kedaluwarsa.length === 0) return { diperbarui: 0 };

  const riwayat = (await db.riwayatHukdis.findMany({ orderBy: { field: "createdAt", dir: "asc" } })) as RiwayatHukdisRow[];
  const riwayatPerPegawai = new Map<string, RiwayatHukdisRow[]>();
  for (const h of riwayat) {
    const daftar = riwayatPerPegawai.get(h.pegawaiId);
    if (daftar) daftar.push(h);
    else riwayatPerPegawai.set(h.pegawaiId, [h]);
  }

  const dinonaktifkan: string[] = [];
  let diperbarui = 0;
  for (const p of kedaluwarsa) {
    const penanda = penyelarasanHukdisPegawai(p, riwayatPerPegawai.get(p.id) ?? [], hariIni);
    if (!penanda) continue;
    if (!penanda.statusHukdis) {
      dinonaktifkan.push(p.id);
      continue;
    }
    await db.pegawai.update({ id: p.id }, penanda);
    diperbarui++;
  }
  if (dinonaktifkan.length > 0) {
    diperbarui += await db.pegawai.updateMany({ id: { in: dinonaktifkan } }, { ...TANPA_HUKDIS });
  }
  return { diperbarui };
}
