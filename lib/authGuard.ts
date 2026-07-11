import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Guard peran sisi-server untuk layout dashboard. Menggantikan proteksi berbasis
// middleware (proxy.ts) yang tidak didukung OpenNext/Cloudflare Workers — Next 16
// memaksa proxy ke runtime Node, sedangkan OpenNext hanya menerima Edge middleware.
// Semua API route sudah memeriksa auth() sendiri, jadi guard ini melindungi
// halaman dashboard dari akses URL langsung (defense-in-depth; sidebar juga sudah
// menyaring menu per peran).
export async function requireRole(allowed: string[], fallback = "/dashboard") {
  const session = await auth();
  if (!session) redirect("/login");
  if (!allowed.includes(session.user.role ?? "")) redirect(fallback);
  return session;
}

// Peran non-keuangan (superAdmin, SDM KGB, SDM Hukdis). Keuangan diarahkan ke
// beranda keuangan bila mencoba membuka modul di luar wewenangnya.
export const NON_KEUANGAN = ["superAdminCore", "sdm_kgb", "sdm_hukdis"];
