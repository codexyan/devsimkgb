import type { MetadataRoute } from "next";

/*
 * SIM-KGB bukan situs untuk mesin pencari: berisi data kepegawaian dan hanya dipakai petugas serta pegawai yang
 * sudah tahu alamatnya. robots.txt melarang semua crawler; lapis lainnya adalah meta robots noindex di
 * app/layout.tsx dan header X-Robots-Tag di worker-entry.js serta public/_headers.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
