"use client";

import { useEffect, useState } from "react";
import { PESAN_TTE_RUSAK, periksaTte, type KeadaanTte } from "@/lib/tteSk";
import { Catatan } from "./BidangForm";

/*
 * Pemeriksaan TTE pada berkas SK yang dipilih, sebelum diunggah (ADR-096). Hasilnya langsung tampil di jendela unggah,
 * sehingga petugas tahu sebelum mengirim bahwa berkas yang dipilih bukan berkas asli dari Srikandi. Server memeriksa ulang
 * dengan aturan yang sama (lib/tteSk.ts) dan menjadi penentunya.
 */

export type KeadaanPemeriksaanTte = KeadaanTte | "memeriksa" | null;

/** Keadaan TTE berkas yang dipilih; "memeriksa" selama berkas dibaca, null bila belum ada berkas. */
export function useTteBerkas(berkas: File | null): KeadaanPemeriksaanTte {
  const [hasil, setHasil] = useState<{ berkas: File; keadaan: KeadaanTte } | null>(null);
  useEffect(() => {
    if (!berkas) return;
    let batal = false;
    void berkas
      .arrayBuffer()
      .then((isi) => periksaTte(new Uint8Array(isi)))
      // Berkas yang tidak terbaca di peramban diserahkan ke pemeriksaan server.
      .then((h) => h.keadaan, () => "takTerperiksa" as const)
      .then((keadaan) => {
        if (!batal) setHasil({ berkas, keadaan });
      });
    return () => {
      batal = true;
    };
  }, [berkas]);
  if (!berkas) return null;
  return hasil?.berkas === berkas ? hasil.keadaan : "memeriksa";
}

/** Boleh diunggah: TTE utuh atau tidak dapat diperiksa, atau tanpa TTE yang dinyatakan sebagai tanda tangan basah. */
export function bolehUnggahTte(keadaan: KeadaanPemeriksaanTte, basah: boolean): boolean {
  if (keadaan === "utuh" || keadaan === "takTerperiksa") return true;
  return keadaan === "tanpa" && basah;
}

export default function PemeriksaanTte({
  keadaan,
  basah,
  onBasah,
  nonaktif,
}: {
  keadaan: KeadaanPemeriksaanTte;
  basah: boolean;
  onBasah: (basah: boolean) => void;
  nonaktif?: boolean;
}) {
  if (!keadaan) return null;
  if (keadaan === "memeriksa") return <Catatan>Memeriksa TTE pada berkas…</Catatan>;
  if (keadaan === "utuh")
    return <Catatan nada="hijau">TTE ditemukan dan utuh: isi SK sama dengan saat ditandatangani di Srikandi.</Catatan>;
  if (keadaan === "takTerperiksa")
    return (
      <Catatan nada="navy">
        Berkas memuat tanda tangan digital, tetapi bentuknya tidak dapat diperiksa SIM-KGB. Pastikan ini berkas asli hasil
        unduhan Srikandi.
      </Catatan>
    );
  if (keadaan === "rusak") return <Catatan nada="merah">{PESAN_TTE_RUSAK}</Catatan>;
  return (
    <Catatan nada="amber">
      <span style={{ display: "block" }}>
        Berkas ini tidak memuat TTE. Bila ini SK TTE dari Srikandi, jangan dikompres atau dicetak ulang: unduh lagi berkas
        aslinya dari Srikandi.
      </span>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={basah} disabled={nonaktif} onChange={(e) => onBasah(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Ini pindaian SK bertanda tangan basah, bukan SK TTE.</span>
      </label>
    </Catatan>
  );
}
