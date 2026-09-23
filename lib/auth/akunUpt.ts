// Penjaga rute yang hanya boleh dipakai akun Admin UPT: memastikan sesinya masih sah, akunnya masih
// ada, dan satkernya benar-benar UPT. Dipakai bersama oleh rute usulan agar aturannya satu tempat.

import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "./penggunaLogin";
import { satkerAkunUpt } from "@/lib/aksesUpt";

/**
 * Akun Admin UPT pemilik sesi beserta kode satkernya. Bila tidak sah, hasilnya berisi `galat`: jawaban
 * siap kirim, 401 untuk sesi yang sudah tidak berlaku dan 403 untuk akun yang bukan Admin UPT.
 */
export async function akunUpt(session: Session | null, pesanTolak: string) {
  if (!session) return { galat: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return { galat: NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 }) };
  const kode = satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker });
  if (!kode) return { galat: NextResponse.json({ error: pesanTolak }, { status: 403 }) };
  return { pengguna, kode };
}
