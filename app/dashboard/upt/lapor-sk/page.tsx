import type { Metadata } from "next";
import IsiLaporSk from "./IsiLaporSk";

export const metadata: Metadata = { title: "Lapor KP/PI/PMK" };

/** Lapor KP/PI/PMK Admin UPT: SK kenaikan pangkat, penyesuaian ijazah, atau PMK untuk beberapa pegawai sekaligus (ADR-074). */
export default function HalamanLaporSk() {
  return <IsiLaporSk />;
}
