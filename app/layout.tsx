import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { PageTransitionProvider } from "@/lib/ui";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Sans geometris tegas untuk headline halaman publik (landing & login)
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
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
    // suppressHydrationWarning: script bootstrap tema menyetel data-dash-theme
    // pada <html> sebelum React hydrate (pola next-themes); perbedaan atribut
    // di elemen ini disengaja dan aman diabaikan.
    <html lang="id" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Terapkan tema tersimpan SEBELUM hydration (anti-flash, dashboard
            langsung gelap). Di root layout agar hanya dirender saat full load
            — React tidak mengeksekusi <script> pada navigasi client-side,
            sinkronisasi selanjutnya ditangani efek DashboardShell. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("kgb-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(location.pathname.indexOf("/dashboard")===0){document.documentElement.setAttribute("data-dash-theme",t)}}catch(e){}`,
          }}
        />
        <PageTransitionProvider enabled={false}>{children}</PageTransitionProvider>
      </body>
    </html>
  );
}
