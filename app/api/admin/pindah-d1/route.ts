import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { ROLES } from "@/lib/auth/roles";
import { logAudit } from "@/lib/auditLog";
import { backendData } from "@/lib/db";
import { bandingkan, salinSemua, salinSusulan, selaraskanPerubahan, waktuSalinTerakhir } from "@/lib/pindahD1";

export const runtime = "nodejs";

async function superAdmin() {
  const session = await auth();
  if (!session) return { galat: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== ROLES.SUPER_ADMIN) return { galat: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }) };
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return { galat: NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 }) };
  return { pengguna };
}

function pesanGalat(e: unknown): string {
  const pesan = e instanceof Error ? e.message : String(e);
  if (/no such table/i.test(pesan)) return "Tabel D1 belum dibuat. Migrasi d1/migrations belum dijalankan ke D1 produksi.";
  if (/DB\) belum dipasang/.test(pesan)) return "Binding D1 belum terpasang di Worker ini.";
  return pesan;
}

/** Pemindahan Supabase → D1 (ADR-085), khusus Super Admin. GET: basis data aktif dan perbandingan isi kedua sisi. */
export async function GET() {
  const izin = await superAdmin();
  if ("galat" in izin) return izin.galat;
  try {
    return NextResponse.json({ backend: backendData(), banding: await bandingkan() });
  } catch (e) {
    return NextResponse.json({ backend: backendData(), error: pesanGalat(e) }, { status: 500 });
  }
}

/** POST { mode: "salin" | "susulan" | "selaras" }. */
export async function POST(req: Request) {
  const izin = await superAdmin();
  if ("galat" in izin) return izin.galat;
  const { mode } = (await req.json().catch(() => ({}))) as { mode?: string };
  if (mode === "selaras") return selaras(izin.pengguna.id);
  if (mode !== "salin" && mode !== "susulan") return NextResponse.json({ error: "Mode tidak dikenal" }, { status: 400 });
  // Salin semua mengosongkan D1. Sesudah peralihan, D1 adalah basis data aktif: menyalin ulang dari Supabase akan menimpa
  // semua yang tertulis sejak peralihan. Panel menyembunyikan tombolnya, tetapi tab yang dibuka sebelum peralihan masih
  // menampilkannya sampai dimuat ulang.
  if (mode === "salin" && backendData() === "d1")
    return NextResponse.json(
      { error: "Basis data aktif sudah D1. Salin semua dinonaktifkan supaya data D1 tidak tertimpa; pakai Salin yang tertinggal." },
      { status: 409 },
    );
  try {
    const hasil = mode === "salin" ? await salinSemua() : await salinSusulan();
    logAudit({
      userId: izin.pengguna.id,
      aksi: mode === "salin" ? "pindah_d1_salin" : "pindah_d1_susulan",
      detail: `${mode === "salin" ? "Salin seluruh data" : "Salin data yang tertinggal"} dari Supabase ke Cloudflare D1: ${hasil.total} baris`,
    });
    return NextResponse.json({ ok: true, hasil, backend: backendData(), banding: await bandingkan() });
  } catch (e) {
    console.error(`[pindah-d1] ${mode} gagal:`, e);
    return NextResponse.json({ error: pesanGalat(e) }, { status: 500 });
  }
}

/**
 * Perubahan dan penghapusan di Supabase sesudah Salin semua yang terakhir, diterapkan ke D1. Hanya sesudah peralihan:
 * sebelumnya Salin semua sudah membawa semuanya.
 */
async function selaras(userId: string) {
  if (backendData() !== "d1")
    return NextResponse.json({ error: "Selaraskan perubahan dipakai sesudah DATA_BACKEND beralih ke D1." }, { status: 409 });
  try {
    const sejak = await waktuSalinTerakhir();
    if (!sejak) return NextResponse.json({ error: "Belum ada Salin semua yang tercatat di log audit D1." }, { status: 409 });
    const hasil = await selaraskanPerubahan(sejak);
    const daftar = (d: { tabel: string; id: string }[]) => d.map((x) => `${x.tabel} ${x.id}`).join(", ") || "-";
    logAudit({
      userId,
      aksi: "pindah_d1_selaras",
      detail:
        `Selaraskan perubahan Supabase sesudah salinan ${hasil.sejak} ke Cloudflare D1: ` +
        `ditimpa ${daftar(hasil.ditimpa)}; dihapus ${daftar(hasil.dihapus)}; ditambah ${daftar(hasil.ditambah)}; ` +
        `bentrok, dibiarkan ${daftar(hasil.bentrok)}`,
    });
    return NextResponse.json({ ok: true, selaras: hasil, backend: backendData(), banding: await bandingkan() });
  } catch (e) {
    console.error("[pindah-d1] selaras gagal:", e);
    return NextResponse.json({ error: pesanGalat(e) }, { status: 500 });
  }
}
