import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buku Panduan SIM-KGB" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
