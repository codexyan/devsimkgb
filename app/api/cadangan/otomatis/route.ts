import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { ROLES } from "@/lib/auth/roles";
import { logAudit } from "@/lib/auditLog";
import { AWALAN_CADANGAN, buatCadangan, sumberBawaan } from "@/lib/cadanganOtomatis";
import { bucketCadangan, daftarCadanganOtomatis, keadaanJejakData } from "@/lib/pengamanData";

export const runtime = "nodejs";

/** Cadangan manual yang baru saja dibuat tidak diulang dalam rentang ini. */
const JEDA_CADANGAN_MANUAL_MS = 5 * 60_000;

async function superAdmin() {
  const session = await auth();
  if (!session) return { galat: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== ROLES.SUPER_ADMIN) return { galat: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }) };
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return { galat: NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 }) };
  return { pengguna };
}

/**
 * Cadangan otomatis seluruh basis data (ADR-084), khusus Super Admin. Tanpa parameter: daftar cadangan dan keadaan
 * jejak perubahan. `?unduh=<kunci>`: berkas cadangannya.
 */
export async function GET(req: Request) {
  const izin = await superAdmin();
  if ("galat" in izin) return izin.galat;
  const bucket = await bucketCadangan();
  if (!bucket) return NextResponse.json({ error: "Penyimpanan R2 tidak tersedia" }, { status: 503 });

  const unduh = new URL(req.url).searchParams.get("unduh");
  if (unduh !== null) {
    if (!unduh.startsWith(AWALAN_CADANGAN) || unduh.includes("..")) {
      return NextResponse.json({ error: "Kunci cadangan tidak dikenal" }, { status: 400 });
    }
    const objek = await bucket.get(unduh);
    if (!objek) return NextResponse.json({ error: "Cadangan tidak ditemukan" }, { status: 404 });
    logAudit({
      userId: izin.pengguna.id,
      aksi: "unduh_cadangan_otomatis",
      detail: `Super Admin mengunduh cadangan otomatis ${unduh.slice(AWALAN_CADANGAN.length)}`,
    });
    return new Response(objek.body, {
      headers: {
        "content-type": "application/gzip",
        "content-length": String(objek.size),
        "content-disposition": `attachment; filename="sim-kgb-${unduh.slice(AWALAN_CADANGAN.length)}"`,
        "cache-control": "no-store",
      },
    });
  }

  const [cadangan, jejak] = await Promise.all([
    daftarCadanganOtomatis(bucket),
    keadaanJejakData().catch(() => ({ aktif: false, jumlah24Jam: null })),
  ]);
  return NextResponse.json({ cadangan, jejak });
}

/** Buat satu cadangan sekarang, misalnya sebelum Kanwil memproses banyak usulan sekaligus. */
export async function POST() {
  const izin = await superAdmin();
  if ("galat" in izin) return izin.galat;
  const bucket = await bucketCadangan();
  if (!bucket) return NextResponse.json({ error: "Penyimpanan R2 tidak tersedia" }, { status: 503 });

  const [terbaru] = await daftarCadanganOtomatis(bucket);
  if (terbaru && Date.now() - new Date(terbaru.dibuat).getTime() < JEDA_CADANGAN_MANUAL_MS) {
    return NextResponse.json({ error: "Cadangan baru saja dibuat. Coba lagi beberapa menit lagi." }, { status: 429 });
  }
  const hasil = await buatCadangan(bucket, sumberBawaan());
  logAudit({
    userId: izin.pengguna.id,
    aksi: "cadangan_otomatis_manual",
    detail: `Super Admin membuat cadangan basis data: ${hasil.total} baris dari ${Object.keys(hasil.jumlah).length} tabel`,
  });
  return NextResponse.json({ ok: true, cadangan: hasil });
}
