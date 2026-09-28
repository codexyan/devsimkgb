import type { Metadata } from "next";
import HalamanKegiatan from "../HalamanKegiatan";

export const metadata: Metadata = {
  title: "Inventarisasi Data KGB",
  description: "Formulir pemutakhiran data kenaikan gaji berkala pegawai pemasyarakatan Kalimantan Selatan.",
};

// Buka-tutup formulir dan batas waktunya diatur Super Admin di dashboard, jadi dibaca saat permintaan.
export const dynamic = "force-dynamic";

/* Formulir satu kegiatan pengumpulan data yang dibuat Super Admin (ADR-022). */
export default async function HalamanKegiatanId({ params }: { params: Promise<{ kegiatan: string }> }) {
  const { kegiatan } = await params;
  return <HalamanKegiatan id={kegiatan} />;
}
