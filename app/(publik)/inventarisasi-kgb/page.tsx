import type { Metadata } from "next";
import HalamanKegiatan from "./HalamanKegiatan";
import { ID_KEGIATAN_KANWIL } from "@/lib/kegiatanInventaris";

export const metadata: Metadata = {
  title: "Inventarisasi Data KGB Pegawai Kanwil",
  description: "Formulir pemutakhiran data kenaikan gaji berkala pegawai Kantor Wilayah Ditjenpas Kalimantan Selatan.",
};

// Buka-tutup formulir dan batas waktunya diatur Super Admin di dashboard, jadi dibaca saat permintaan.
export const dynamic = "force-dynamic";

/* Tautan pertama formulir inventarisasi, dipertahankan untuk kegiatan "kanwil" (ADR-022). */
export default function HalamanInventarisasi() {
  return <HalamanKegiatan id={ID_KEGIATAN_KANWIL} />;
}
