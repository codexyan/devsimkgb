import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { kirimanPegawai } from "@/lib/inventarisServer";
import { bandingkanKiriman, peringatanKiriman } from "@/lib/pemutakhiranPegawai";

export const runtime = "nodejs";

/**
 * Kiriman pemutakhiran data seorang pegawai dari semua kegiatan formulir, beserta perbandingannya dengan Data
 * Pegawai dan peringatan otomatis (ADR-023). Hanya Super Admin dan Tim SDM KGB.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const daftar = await kirimanPegawai(pegawai.nip);
  return NextResponse.json(
    daftar.map(({ kegiatan, kiriman }) => ({
      kegiatan,
      kiriman,
      banding: bandingkanKiriman(pegawai, kiriman.isian),
      peringatan: peringatanKiriman(pegawai, kiriman.isian),
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
