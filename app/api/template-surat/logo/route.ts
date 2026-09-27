import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewKGB, isSuperAdmin } from "@/lib/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { kunciLogoSah } from "@/lib/templateSurat";
import { BATAS_LOGO_BYTE, ambilLogo, jenisGambar, simpanLogo } from "@/lib/templateSuratServer";

export const runtime = "nodejs";

/**
 * Logo kop surat (ADR-019). Disajikan kepada peran yang menyusun atau mempratinjau SK, karena PDF-nya
 * disusun di peramban dan memuat logo dari sini. Kunci dibatasi folder template/.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const kunci = new URL(req.url).searchParams.get("key") ?? "";
  if (!kunciLogoSah(kunci)) return NextResponse.json({ error: "Logo tidak ditemukan" }, { status: 404 });
  const logo = await ambilLogo(kunci);
  if (!logo) return NextResponse.json({ error: "Logo tidak ditemukan" }, { status: 404 });
  // Kunci logo tidak pernah ditimpa (nama memuat waktu unggah), jadi aman disimpan lama di peramban.
  return new NextResponse(logo.isi, {
    headers: { "Content-Type": logo.tipe, "Cache-Control": "private, max-age=86400, immutable" },
  });
}

/** Unggah logo kop (PNG atau JPEG, paling besar 500 KB). Logo baru dipakai setelah disimpan dalam versi template. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role ?? ""))
    return NextResponse.json({ error: "Hanya Super Admin yang dapat mengubah template surat" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const berkas = form?.get("logo");
  if (!(berkas instanceof File) || berkas.size === 0) return NextResponse.json({ error: "Pilih berkas logo" }, { status: 400 });
  if (berkas.size > BATAS_LOGO_BYTE) return NextResponse.json({ error: "Logo paling besar 500 KB" }, { status: 413 });
  const isi = await berkas.arrayBuffer();
  const jenis = jenisGambar(new Uint8Array(isi.slice(0, 8)));
  if (!jenis) return NextResponse.json({ error: "Logo harus berupa gambar PNG atau JPEG" }, { status: 400 });

  const kunci = await simpanLogo(isi, jenis);
  if (!kunci) return NextResponse.json({ error: "Penyimpanan berkas tidak tersedia. Coba lagi." }, { status: 503 });
  logAudit({
    userId: pengguna.id,
    aksi: "unggah_logo_surat",
    detail: `Logo kop surat diunggah (${berkas.name || kunci}); dipakai setelah disimpan dalam versi template`,
    targetNama: "Template surat",
  });
  return NextResponse.json({ ok: true, kunci }, { status: 201 });
}
