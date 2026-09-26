import type { Metadata } from "next";
import IsiPegawaiUpt from "./IsiPegawaiUpt";

export const metadata: Metadata = { title: "Data Pegawai" };

/** Modul Data Pegawai Admin UPT: tabel pegawai satker beserta seluruh tindakannya. */
export default function HalamanPegawaiUpt() {
  return <IsiPegawaiUpt />;
}
