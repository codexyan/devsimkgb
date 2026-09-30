import type { Metadata } from "next";
import IsiHukdisUpt from "./IsiHukdisUpt";

export const metadata: Metadata = { title: "Lapor hukuman disiplin" };

/**
 * Modul Lapor Hukdis Admin UPT: laporan ke SDM Hukdis Kanwil dan hukdis yang sudah tercatat (ADR-016).
 * UPT tidak menjatuhkan hukuman dan tidak menggeser jadwal KGB; keduanya wewenang Kanwil.
 */
export default function HalamanHukdisUpt() {
  return <IsiHukdisUpt />;
}
