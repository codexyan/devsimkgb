import type { Metadata } from "next";
import IsiHukdisUpt from "./IsiHukdisUpt";

export const metadata: Metadata = { title: "Hukuman disiplin" };

/** Modul Hukuman Disiplin Admin UPT: laporan ke SDM Hukdis Kanwil dan hukdis yang sudah tercatat (ADR-016). */
export default function HalamanHukdisUpt() {
  return <IsiHukdisUpt />;
}
