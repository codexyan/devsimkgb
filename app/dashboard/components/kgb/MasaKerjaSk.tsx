import { formatMkg } from "./format";
import type { mkgPadaSkTercatat } from "@/lib/dasarSkUsulan";
import { formatTanggalId } from "@/lib/waktu";

/**
 * Masa kerja golongan pegawai pada kartu data kepegawaian (ADR-123). Data pegawai menyimpan masa kerja pada TMT KGB
 * terakhir, dasar hitungan KGB. Bila sesudahnya ada SK kenaikan pangkat atau PMK, SK itu menulis masa kerja pada TMT-nya
 * sendiri; angka itulah yang tampil sebagai angka utama, dan angka tersimpan disebut di bawahnya. Hanya tampilan: hitungan
 * KGB tetap memakai angka tersimpan.
 */
export function NilaiMasaKerja({
  tahun,
  bulan,
  menurutSk,
}: {
  tahun: number | null | undefined;
  bulan: number | null | undefined;
  menurutSk: ReturnType<typeof mkgPadaSkTercatat>;
}) {
  if (!menurutSk) return <>{formatMkg(tahun, bulan)}</>;
  return (
    <>
      {formatMkg(menurutSk.mkg.tahun, menurutSk.mkg.bulan)}
      <span className="kgbm-mkg-ket">
        menurut SK {menurutSk.jenis === "kp" ? "kenaikan pangkat" : "PMK"}, pada TMT {formatTanggalId(menurutSk.tmt)}
      </span>
      <span className="kgbm-mkg-ket">tersimpan {formatMkg(tahun, bulan)} pada TMT KGB terakhir (dasar hitungan)</span>
    </>
  );
}
