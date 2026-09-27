import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { SKRIP_GERAK_AWAL } from "@/lib/ui/gerakAwal";

// Teks isi seluruh aplikasi (dashboard dan halaman publik)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Judul dan angka besar: sans rapat berbobot ringan, sepasang dengan Inter (ADR-002, ADR-003)
const hurufJudul = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-judul",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SIM KGB",
    template: "%s | SIM KGB",
  },
  description: "Sistem pengelolaan Kenaikan Gaji Berkala (KGB) pegawai Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
  icons: { icon: "/icon.svg" },
  // Tidak untuk diindeks mesin pencari (lihat juga app/robots.ts dan header X-Robots-Tag di worker-entry.js).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true, "max-snippet": 0, "max-image-preview": "none" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: script bootstrap tema menyetel data-dash-theme
    // pada <html> sebelum React hydrate (pola next-themes); perbedaan atribut
    // di elemen ini disengaja dan aman diabaikan.
    <html lang="id" suppressHydrationWarning className={`${inter.variable} ${hurufJudul.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Terapkan tema dashboard tersimpan SEBELUM hydration (anti-flash).
            Halaman publik hanya bertema terang. Di root layout agar hanya
            dirender saat muat penuh; sinkronisasi berikutnya ditangani efek
            DashboardShell. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname.indexOf("/dashboard")===0){document.documentElement.setAttribute("data-dash-theme",localStorage.getItem("kgb-theme")==="dark"?"dark":"light")}}catch(e){}`,
          }}
        />
        {/* Pilihan animasi (lib/ui/gerak.ts): dipasang sebelum hydration di semua halaman, publik maupun dashboard. */}
        <script dangerouslySetInnerHTML={{ __html: SKRIP_GERAK_AWAL }} />
        {children}
      </body>
    </html>
  );
}
