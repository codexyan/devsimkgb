import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Satu-satunya font aplikasi (dashboard dan halaman publik)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SIM KGB",
    template: "%s | SIM KGB",
  },
  description: "Sistem pengelolaan Kenaikan Gaji Berkala (KGB) pegawai Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: script bootstrap tema menyetel data-pub-theme
    // dan data-dash-theme pada <html> sebelum React hydrate (pola
    // next-themes); perbedaan atribut di elemen ini disengaja dan aman diabaikan.
    <html lang="id" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Terapkan tema tersimpan SEBELUM hydration (anti-flash). data-pub-theme
            dipasang di semua path untuk halaman publik, data-dash-theme hanya
            di /dashboard. Di root layout agar hanya dirender saat full load
            — React tidak mengeksekusi <script> pada navigasi client-side;
            sinkronisasi selanjutnya ditangani efek DashboardShell dan
            HeaderPublik. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("kgb-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var d=document.documentElement;d.setAttribute("data-pub-theme",t);if(location.pathname.indexOf("/dashboard")===0){d.setAttribute("data-dash-theme",t)}}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
