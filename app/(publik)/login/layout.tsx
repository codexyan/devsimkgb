import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Masuk",
};

// Pengguna yang sudah masuk langsung diarahkan ke dashboard (pengganti
// redirect middleware proxy.ts).
export default async function LoginLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth();
  if (session) redirect("/dashboard");
  return <>{children}</>;
}
