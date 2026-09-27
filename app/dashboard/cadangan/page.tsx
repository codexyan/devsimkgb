import type { Metadata } from "next";
import IsiCadangan from "./IsiCadangan";

export const metadata: Metadata = { title: "Cadangkan data" };

/** Cadangan data bulanan wajib untuk semua peran (ADR-018). */
export default function HalamanCadanganData() {
  return <IsiCadangan />;
}
