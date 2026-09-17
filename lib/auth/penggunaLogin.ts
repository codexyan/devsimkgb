import type { Session } from "next-auth";
import { db } from "@/lib/db";

export const PESAN_SESI_BERAKHIR = "Sesi tidak berlaku lagi. Silakan masuk kembali.";

/**
 * Baris pengguna pemilik sesi, atau null bila akunnya sudah dihapus (termasuk bila NIP yang sama
 * sudah dipakai akun baru). Rute yang menulis data memanggilnya sebelum perubahan apa pun dan
 * menjawab 401 bila null, sehingga tidak ada perubahan tanpa catatan pelaku.
 */
export async function penggunaLogin(session: Session) {
  const nip = session.user.nip;
  if (!nip) return null;
  const user = await db.user.findUnique({ nip });
  if (!user || (session.user.id && user.id !== session.user.id)) return null;
  return user;
}
