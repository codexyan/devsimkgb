import type { Metadata } from "next";
import IsiUsulanKolektif from "./IsiUsulanKolektif";

export const metadata: Metadata = { title: "Usulan kolektif" };

/** Usulan kolektif Admin UPT: banyak pegawai untuk satu surat Srikandi (ADR-015). */
export default function HalamanUsulanKolektif() {
  return <IsiUsulanKolektif />;
}
