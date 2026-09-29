import type { Metadata } from "next";
import IsiUnggahDaftar from "./IsiUnggahDaftar";

export const metadata: Metadata = { title: "Unggah daftar pegawai" };

/**
 * Unggah daftar pegawai Admin UPT: satu berkas CSV menjadi banyak draf, lewat pratinjau dan konfirmasi
 * per baris (ADR-031). Peran selain Admin UPT sudah ditolak layout app/dashboard/upt/layout.tsx.
 */
export default function HalamanUnggahDaftar() {
  return <IsiUnggahDaftar />;
}
