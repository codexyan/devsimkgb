import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Pengguna yang sudah login tidak perlu melihat halaman login (dulu ditangani
// proxy.ts). Guard sisi-server menggantikan redirect middleware tersebut.
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session) redirect("/dashboard");
  return <>{children}</>;
}
