import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/authGuard";

export const metadata: Metadata = { title: "Hukuman Disiplin" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(["superAdminCore", "sdm_hukdis"]);
  return <Suspense>{children}</Suspense>;
}
