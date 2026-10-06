import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ROLES } from "@/lib/auth/roles";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { tabelBelumAda } from "@/lib/db/tabelBelumAda";
import { idPengumumanSah, kunciBarisDilihat } from "@/lib/pengumumanUpt";

export const runtime = "nodejs";

/*
 * Penanda "sudah melihat" pengumuman Apa yang baru untuk Admin UPT, per akun (ADR-075). Pengumumannya sendiri tidak
 * berisi data apa pun; yang disimpan hanya akun mana yang sudah melihat pengumuman mana.
 *
 * `server: false` berarti tabel pengumuman_dilihat belum dibuat di basis data (migrasi dijalankan manual). Peramban lalu
 * kembali memakai penanda lokalnya, jadi kode ini aman terpasang lebih dulu daripada tabelnya.
 */

/** Pengumuman yang sudah dilihat akun ini. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== ROLES.ADMIN_UPT) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  try {
    const baris = await db.pengumumanDilihat.findMany({ where: { userId: pengguna.id } });
    return NextResponse.json({ server: true, dilihat: baris.map((b) => b.pengumumanId).filter(idPengumumanSah) });
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ server: false, dilihat: [] });
    throw e;
  }
}

/** Catat pengumuman yang baru dilihat akun ini. Id yang tidak dikenal diabaikan; mencatat dua kali tidak berefek. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== ROLES.ADMIN_UPT) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  let ids: unknown;
  try {
    ids = ((await req.json()) as { ids?: unknown }).ids;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  const dicatat = [...new Set(Array.isArray(ids) ? ids.filter(idPengumumanSah) : [])];

  try {
    const sudah = new Set((await db.pengumumanDilihat.findMany({ where: { userId: pengguna.id } })).map((b) => b.pengumumanId));
    for (const id of dicatat.filter((x) => !sudah.has(x))) {
      try {
        await db.pengumumanDilihat.create({ id: kunciBarisDilihat(pengguna.id, id), userId: pengguna.id, pengumumanId: id, dilihatAt: new Date() });
      } catch (e) {
        // Dua peramban akun yang sama mencatat bersamaan: baris yang kalah balapan sudah ada, dan itu yang dikehendaki.
        // Jawabannya dibaca ulang di bawah, jadi galat lain tidak pernah dilaporkan sebagai sudah tercatat.
        if (tabelBelumAda(e)) throw e;
      }
    }
    const akhir = await db.pengumumanDilihat.findMany({ where: { userId: pengguna.id } });
    return NextResponse.json({ server: true, dilihat: akhir.map((b) => b.pengumumanId).filter(idPengumumanSah) });
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ server: false, dilihat: [] });
    throw e;
  }
}
