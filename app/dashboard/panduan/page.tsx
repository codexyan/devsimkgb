import { redirect } from "next/navigation";

// Panduan SIM-KGB kini berada di halaman publik /panduan.
export default function PanduanDashboardPage() {
  redirect("/panduan");
}
