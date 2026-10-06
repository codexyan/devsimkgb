import type { Metadata } from "next";
import IsiUsulanKolektif from "./IsiUsulanKolektif";

export const metadata: Metadata = { title: "Usul KGB Kolektif" };

/** Usul KGB Kolektif Admin UPT: banyak pegawai untuk satu surat Srikandi (ADR-015). */
export default function HalamanUsulanKolektif() {
  return <IsiUsulanKolektif />;
}
