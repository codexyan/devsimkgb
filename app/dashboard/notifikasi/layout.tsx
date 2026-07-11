import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifikasi" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
