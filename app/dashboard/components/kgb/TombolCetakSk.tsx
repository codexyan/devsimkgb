"use client";

import MenuTindakan from "@/app/dashboard/components/MenuTindakan";
import type { VersiCetak } from "@/lib/kgbAksi";

/*
 * Tombol Cetak SK berbelah (ADR-095). Klik utama mengunduh versi Srikandi untuk tanda tangan elektronik, cara yang dipakai
 * hampir semua SK; panah di sebelahnya berisi cetak SK biasa untuk tanda tangan basah. Satu SK hanya ditandatangani dengan
 * satu cara, jadi satu klik mengunduh satu berkas. Dulu Cetak SK selalu mengunduh keduanya.
 */
export default function TombolCetakSk({
  nama,
  sibuk,
  onCetak,
  kelasUtama = "dsb-tombol dsb-tombol-kecil",
  nadaUtama = "hijau-penuh",
  kelasPanah,
  urutan,
  labelUtama = "Unduh untuk TTE",
  labelSibuk = "Menyiapkan...",
  judulUtama = "Unduh SK versi Srikandi untuk ditandatangani secara elektronik (TTE), tanpa tanda air",
  labelBasah = "Cetak untuk tanda tangan basah",
  keteranganBasah = "SK biasa dengan ruang tanda tangan kosong, tanpa tanda air",
}: {
  /** Nama pegawai, untuk label menu yang dibacakan pembaca layar. */
  nama: string;
  sibuk: boolean;
  onCetak: (versi: VersiCetak) => void;
  /** Kelas tombol utama; jendela detail memakai kelas tombol kgbm. */
  kelasUtama?: string;
  /** data-nada tombol utama; kosong untuk tombol tanpa warna. */
  nadaUtama?: string;
  /** Kelas tombol panah; bawaannya tombol kecil dasbor. */
  kelasPanah?: string;
  /** Urutan flex pada deretan tombol kartu. */
  urutan?: number;
  /** Label tombol utama dan pilihan menu; tombol ZIP memakai label sendiri (ADR-097). */
  labelUtama?: string;
  labelSibuk?: string;
  judulUtama?: string;
  labelBasah?: string;
  keteranganBasah?: string;
}) {
  return (
    <span className="ctk-belah" style={urutan === undefined ? undefined : { order: urutan }}>
      <button
        type="button"
        className={kelasUtama}
        data-nada={nadaUtama || undefined}
        disabled={sibuk}
        onClick={() => onCetak("tte")}
        title={judulUtama}
      >
        {sibuk ? labelSibuk : labelUtama}
      </button>
      <MenuTindakan
        judul={`Cara cetak lain untuk ${nama}`}
        bentuk="panah"
        kelasPemicu={kelasPanah}
        nonaktif={sibuk}
        item={[
          {
            label: labelBasah,
            keterangan: keteranganBasah,
            onPilih: () => onCetak("basah"),
          },
        ]}
      />
    </span>
  );
}
