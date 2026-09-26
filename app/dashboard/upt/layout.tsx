import { requireRole } from "@/lib/authGuard";
import { ROLES } from "@/lib/auth/roles";

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Modul khusus Admin UPT; peran lain diarahkan ke dashboard perannya.
  await requireRole([ROLES.ADMIN_UPT], "/dashboard");
  return <>{children}</>;
}
