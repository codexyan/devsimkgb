// Pegawai baru dari UPT langsung terdata begitu data utama drafnya terisi (ADR-112, ADR-113).
//
// Dulu pegawai baru dari UPT baru masuk data induk setelah Kanwil menyetujui usulannya. Kini mendata dan mengusulkan KGB
// dipisah: begitu draf pegawai baru lengkap disimpan, barisnya di tabel pegawai dibuat saat itu juga, tanpa surat dan tanpa
// tinjauan. Surat Srikandi dan tinjauan Kanwil tetap diperlukan, tetapi saat KGB diusulkan: drafnya tidak berubah (jenis
// "baru", status draf, menunggu, atau revisi) dan tertaut ke pegawainya lewat `usulan_pegawai.pegawaiId`. Saat disetujui,
// persetujuan melanjutkan pegawai yang sudah ada (lib/setujuiUsulan.ts) dan Input KGB dibuka (lib/usulanMenahan.ts).
//
// "Data belum ditinjau" tidak punya kolom sendiri: itu keadaan pegawai yang punya usulan pegawai baru tertaut yang belum
// disetujui (`usulanBaruBelumDitinjau`), sehingga tidak ada migrasi.

import { db } from "./db";
import { BELUM_SELESAI, kekuranganPendataanBaru } from "./usulanPegawai";
import { isiPembaruanPegawaiBaru, susunPegawaiBaru } from "./pegawaiBaruDariUsulan";
import { newId } from "./sheets/id";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

export type HasilTerdatakan =
  | { hasil: "dibuat" | "diperbarui"; pegawaiId: string }
  | {
      hasil: "belum";
      /** bukan_pegawai_baru: usulan perbaikan; belum_lengkap: masih kurang isian; nip_sudah_tercatat: sudah ada pegawai ber-NIP itu. */
      alasan: "bukan_pegawai_baru" | "bukan_di_tangan_upt" | "belum_lengkap" | "nip_sudah_tercatat" | "tidak_dapat_disusun";
      kurang?: string[];
    };

/**
 * Buat (atau perbarui) baris pegawai dari usulan pegawai baru yang lengkap. Aman dipanggil berulang: usulan yang sudah
 * tertaut memperbarui pegawainya di tempat, dan yang belum lengkap atau NIP-nya sudah dipakai pegawai lain dibiarkan
 * (usulannya tetap berjalan seperti biasa, dan NIP yang sudah tercatat ditangani ADR-091 saat diajukan).
 */
export async function terdatakanPegawaiBaru(usulan: UsulanPegawaiRow, sekarang: Date = new Date()): Promise<HasilTerdatakan> {
  if (usulan.jenis !== "baru") return { hasil: "belum", alasan: "bukan_pegawai_baru" };
  // Yang sudah disetujui atau ditolak sudah selesai: datanya tidak disentuh lagi dari sini.
  if (!BELUM_SELESAI.includes(usulan.status)) return { hasil: "belum", alasan: "bukan_di_tangan_upt" };

  // Cukup data utamanya (ADR-113); berkas dan pejabat penetap baru ditagih saat usulannya diajukan.
  const kurang = kekuranganPendataanBaru(usulan);
  if (kurang.length > 0) return { hasil: "belum", alasan: "belum_lengkap", kurang };

  // Sudah tertaut: pegawainya diperbarui di tempat selama datanya belum ditinjau. Tautan yang menggantung (pegawainya sudah
  // tidak ada) dibuatkan lagi di bawah.
  if (usulan.pegawaiId) {
    const ada = (await db.pegawai.findUnique({ id: usulan.pegawaiId })) as PegawaiRow | null;
    if (ada) {
      const susun = susunPegawaiBaru(usulan, ada.id, sekarang);
      if (!susun.ok) return { hasil: "belum", alasan: "tidak_dapat_disusun", kurang: [susun.pesan] };
      await db.pegawai.update({ id: ada.id }, isiPembaruanPegawaiBaru(susun.pegawai, { jagaJadwal: await jadwalDigeserHukdis(ada.id) }));
      return { hasil: "diperbarui", pegawaiId: ada.id };
    }
  }

  const nip = usulan.nip ?? "";
  if (await db.pegawai.findUnique({ nip })) return { hasil: "belum", alasan: "nip_sudah_tercatat" };

  const susun = susunPegawaiBaru(usulan, newId(), sekarang);
  if (!susun.ok) return { hasil: "belum", alasan: "tidak_dapat_disusun", kurang: [susun.pesan] };
  try {
    await db.pegawai.create(susun.pegawai);
  } catch (e) {
    // Dua permintaan serentak untuk NIP yang sama: yang kalah dibiarkan, dan NIP yang sudah tercatat ditangani saat diajukan.
    if (await db.pegawai.findUnique({ nip })) return { hasil: "belum", alasan: "nip_sudah_tercatat" };
    throw e;
  }
  await db.usulanPegawai.update({ id: usulan.id }, { pegawaiId: susun.pegawai.id });
  return { hasil: "dibuat", pegawaiId: susun.pegawai.id };
}

/**
 * Usulan pegawai baru tertaut yang belum disetujui untuk pegawai ini: tanda "data belum ditinjau" (ADR-112). Dipilih yang
 * menunggu tinjauan lebih dulu, sebab hanya itu yang sudah ada di meja Kanwil.
 */
export function usulanBaruBelumDitinjau<T extends Pick<UsulanPegawaiRow, "jenis" | "status" | "pegawaiId">>(
  daftar: readonly T[],
  pegawaiId: string,
): T | null {
  const tertaut = daftar.filter((u) => u.jenis === "baru" && u.pegawaiId === pegawaiId && BELUM_SELESAI.includes(u.status));
  return tertaut.find((u) => u.status === "menunggu") ?? tertaut[0] ?? null;
}

/**
 * Id pegawai yang datanya belum ditinjau Kanwil: punya usulan pegawai baru tertaut yang belum disetujui (ADR-112). Satu
 * pembacaan ringan untuk seluruh daftar; dipakai Data Pegawai, dasbor, dan pengingat KGB.
 */
export async function idPegawaiBelumDitinjau(): Promise<Set<string>> {
  const baris = await db.usulanPegawai.findKolom(["pegawaiId"], { where: { jenis: "baru", status: { in: [...BELUM_SELESAI] } } });
  return new Set(baris.map((b) => b.pegawaiId).filter((id): id is string => !!id));
}

/**
 * Jadwal KGB pegawai ini sudah digeser hukuman disiplin yang menunda KGB (dicatat Kanwil sesudah pegawainya terdata,
 * ADR-113). Simpan ulang draf dan persetujuan tidak boleh menimpa jadwal itu dengan hitungan dari isian draf.
 */
export async function jadwalDigeserHukdis(pegawaiId: string): Promise<boolean> {
  const hukdis = (await db.riwayatHukdis.findMany({ where: { pegawaiId } })) as { berdampakKGB: boolean | null }[];
  return hukdis.some((h) => !!h.berdampakKGB);
}
