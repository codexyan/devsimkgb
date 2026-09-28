// Bagian server cadangan data bulanan (ADR-018): baris data tiap jenis menurut hak akses akun, dan daftar
// PDF SK yang ikut dicadangkan. Isi cadangan sama persis dengan yang boleh dilihat akun itu di SIM-KGB;
// sandi pengguna tidak pernah ikut, dan Admin UPT hanya mendapat hukdis sebatas penanda (ADR-016).

import { db } from "./db";
import { ROLES, canManageHukdis } from "./auth/roles";
import { bolehUnduhSkUpt, dipegangKeuanganKanwil, pegawaiSatker, satkerAkunUpt } from "./aksesUpt";
import { hukdisMasihBerlaku } from "./hukdisKedaluwarsa";
import { tabelBelumAda } from "./laporanHukdisServer";
import { cakupanPeran, type JenisCadangan } from "./cadangan";
import type { LaporanHukdisRow, LaporanMutasiRow, PegawaiRow, RiwayatKGBRow, UserRow, UsulanPegawaiRow } from "./sheets/tables";
import type { SuratKgbTersimpan } from "./prosesKgb";

type Baris = Record<string, unknown>;

interface Lingkup {
  role: string;
  /** Kode satker bila akunnya Admin UPT. */
  kode: string | null;
  pegawai: PegawaiRow[];
  idPegawai: Set<string>;
}

/** Pegawai yang boleh dilihat akun ini; dasar penyaring semua jenis data lain. */
async function lingkupAkun(pengguna: Pick<UserRow, "role" | "satker">): Promise<Lingkup> {
  const semua = (await db.pegawai.findMany()) as PegawaiRow[];
  const kode = pengguna.role === ROLES.ADMIN_UPT ? satkerAkunUpt(pengguna) : null;
  const pegawai =
    pengguna.role === ROLES.ADMIN_UPT
      ? (kode ? pegawaiSatker(semua, kode) : [])
      : pengguna.role === ROLES.KEUANGAN
        ? semua.filter((p) => dipegangKeuanganKanwil(p.unitKerja))
        : semua;
  return { role: pengguna.role, kode, pegawai, idPegawai: new Set(pegawai.map((p) => p.id)) };
}

/** Nama dan NIP pegawai ditambahkan ke baris yang hanya menyimpan id-nya, agar cadangan terbaca tanpa SIM-KGB. */
function denganPegawai<T extends { pegawaiId: string | null }>(baris: T[], lingkup: Lingkup): Baris[] {
  const perId = new Map(lingkup.pegawai.map((p) => [p.id, p]));
  return baris.map((b) => {
    const p = b.pegawaiId ? perId.get(b.pegawaiId) : undefined;
    return { namaPegawai: p?.nama ?? "", nipPegawai: p?.nip ?? "", ...b };
  });
}

async function kgbDalamLingkup(lingkup: Lingkup): Promise<RiwayatKGBRow[]> {
  const semua = (await db.riwayatKGB.findMany()) as RiwayatKGBRow[];
  return semua.filter((k) => lingkup.idPegawai.has(k.pegawaiId));
}

/** Baris satu jenis data untuk akun ini; kosong bila jenis itu bukan cakupannya. */
export async function barisCadangan(jenis: JenisCadangan, pengguna: Pick<UserRow, "role" | "satker">): Promise<Baris[]> {
  if (!cakupanPeran(pengguna.role).includes(jenis)) return [];
  const lingkup = await lingkupAkun(pengguna);
  const lihatHukdis = canManageHukdis(pengguna.role);
  const upt = pengguna.role === ROLES.ADMIN_UPT;

  switch (jenis) {
    case "pegawai":
      return lingkup.pegawai.map((p) => {
        const baris: Baris = { ...p };
        // Rincian hukdis hanya untuk peran yang mengelolanya, sama dengan tampilan dan ekspor pegawai.
        if (!lihatHukdis) {
          delete baris.jenisHukdis;
          delete baris.keteranganHukdis;
        }
        return baris;
      });
    case "riwayat_kgb":
      return denganPegawai(await kgbDalamLingkup(lingkup), lingkup);
    case "surat_kgb": {
      const idKgb = new Set((await kgbDalamLingkup(lingkup)).map((k) => k.id));
      const surat = (await db.suratKGB.findMany()) as (SuratKgbTersimpan & Baris)[];
      return surat.filter((s) => idKgb.has(s.kgbId));
    }
    case "riwayat_pangkat":
      return denganPegawai(
        ((await db.riwayatPangkat.findMany()) as { pegawaiId: string }[]).filter((r) => lingkup.idPegawai.has(r.pegawaiId)),
        lingkup,
      );
    case "riwayat_pmk":
      return denganPegawai(
        ((await db.riwayatPmk.findMany()) as { pegawaiId: string }[]).filter((r) => lingkup.idPegawai.has(r.pegawaiId)),
        lingkup,
      );
    case "riwayat_mutasi":
      return denganPegawai(
        ((await db.riwayatMutasi.findMany()) as { pegawaiId: string }[]).filter((r) => lingkup.idPegawai.has(r.pegawaiId)),
        lingkup,
      );
    case "laporan_mutasi": {
      const semua = (await db.laporanMutasi.findMany()) as LaporanMutasiRow[];
      return denganPegawai(upt ? semua.filter((l) => l.satker === lingkup.kode) : semua, lingkup);
    }
    case "usulan_pegawai": {
      const semua = (await db.usulanPegawai.findMany()) as UsulanPegawaiRow[];
      return denganPegawai(upt ? semua.filter((u) => u.satker === lingkup.kode) : semua, lingkup);
    }
    case "riwayat_hukdis": {
      const semua = ((await db.riwayatHukdis.findMany()) as { pegawaiId: string; berdampakKGB: boolean | null; tmtBerakhir: Date | null }[])
        .filter((h) => lingkup.idPegawai.has(h.pegawaiId));
      // Admin UPT hanya melihat hukdis sebatas status dan dampaknya pada KGB (ADR-016).
      if (upt)
        return denganPegawai(
          semua.map((h) => ({
            pegawaiId: h.pegawaiId,
            masihBerlaku: hukdisMasihBerlaku(h.tmtBerakhir),
            menundaKgb: !!h.berdampakKGB,
            berlakuSampai: h.tmtBerakhir,
          })),
          lingkup,
        );
      return denganPegawai(semua, lingkup);
    }
    case "laporan_hukdis": {
      let semua: LaporanHukdisRow[] = [];
      try {
        semua = (await db.laporanHukdis.findMany()) as LaporanHukdisRow[];
      } catch (e) {
        if (!tabelBelumAda(e)) throw e;
      }
      return denganPegawai(upt ? semua.filter((l) => l.satker === lingkup.kode) : semua, lingkup);
    }
    case "pengguna": {
      const semua = (await db.user.findMany()) as UserRow[];
      // Sandi (hash) tidak pernah ikut cadangan.
      return semua.map(({ password: _sandi, ...u }) => {
        void _sandi;
        return u;
      });
    }
  }
}

export interface BerkasSkCadangan {
  nama: string;
  url: string;
}

/** PDF SK KGB yang sudah terbit dan boleh diunduh akun ini, beserta rute unduhnya. */
export async function daftarSkCadangan(pengguna: Pick<UserRow, "role" | "satker">): Promise<BerkasSkCadangan[]> {
  if (!cakupanPeran(pengguna.role).includes("surat_kgb")) return [];
  const lingkup = await lingkupAkun(pengguna);
  const kgb = await kgbDalamLingkup(lingkup);
  const kgbPerId = new Map(kgb.map((k) => [k.id, k]));
  const pegawaiPerId = new Map(lingkup.pegawai.map((p) => [p.id, p]));
  const surat = (await db.suratKGB.findMany()) as SuratKgbTersimpan[];
  const hasil: BerkasSkCadangan[] = [];
  const dipakai = new Set<string>();
  for (const s of surat) {
    const k = kgbPerId.get(s.kgbId);
    if (!k || !s.pathFile) continue;
    const p = pegawaiPerId.get(k.pegawaiId) ?? null;
    if (lingkup.kode && !bolehUnduhSkUpt({ kode: lingkup.kode, kgb: k, pegawai: p, pathFile: s.pathFile })) continue;
    const tmt = k.tmtKgbBaru ? new Date(k.tmtKgbBaru).toISOString().slice(0, 10) : "tanpa-tmt";
    let nama = `SK-KGB_${p?.nip ?? k.pegawaiId}_${tmt}.pdf`.replace(/[^A-Za-z0-9._-]+/g, "_");
    for (let i = 2; dipakai.has(nama); i++) nama = nama.replace(/(_\d+)?\.pdf$/, `_${i}.pdf`);
    dipakai.add(nama);
    hasil.push({
      nama,
      url: lingkup.kode ? `/api/upt/sk/${k.id}` : `/api/blob/download?key=${encodeURIComponent(s.pathFile)}`,
    });
  }
  return hasil;
}
