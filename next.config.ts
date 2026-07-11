import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Mengaktifkan akses binding Cloudflare (R2, dsb.) saat `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Optimasi gambar dimatikan: satu-satunya pemakaian next/image adalah logo
  // kecil (LogoMark); menghindari kebutuhan sharp/layanan optimasi.
  images: { unoptimized: true },
};

export default nextConfig;
