import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * SK dasar KGB yang pernah dikirim UPT lewat usulan yang disetujui: nomor dan tanggal SK CPNS (bagi
 * pegawai yang belum pernah KGB) atau SK KGB terakhir, beserta TMT-nya. Dipakai Input KGB sebagai
 * isian awal ketika riwayat KGB belum memuatnya, supaya Tim SDM tidak mengetik ulang yang sudah
 * diketik UPT, dan dapat membuka pindaian SK-nya untuk dicocokkan.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const usulan = (await db.usulanPegawai.findMany({
    where: { pegawaiId: id, status: "disetujui" },
  })) as UsulanPegawaiRow[];
  const terbaru = usulan
    .filter((u) => u.nomorSkTerakhir?.trim() || u.tanggalSkTerakhir)
    .sort((a, b) => new Date(b.ditinjauAt ?? 0).getTime() - new Date(a.ditinjauAt ?? 0).getTime())[0];
  if (!terbaru) return NextResponse.json(null);

  return NextResponse.json({
    usulanId: terbaru.id,
    nomorSK: terbaru.nomorSkTerakhir?.trim() || null,
    tanggalSK: terbaru.tanggalSkTerakhir ? new Date(terbaru.tanggalSkTerakhir).toISOString() : null,
    // Pada formulir UPT, TMT CPNS dan TMT KGB terakhir sama-sama disimpan di kolom ini.
    tmtSK: terbaru.tmtKgbTerakhir ? new Date(terbaru.tmtKgbTerakhir).toISOString() : null,
    // Pindaian yang dapat dibuka lewat /api/usulan/[id]/berkas untuk dicocokkan.
    berkas: terbaru.pathSkCpns ? "skCpns" : terbaru.pathSkTerakhir ? "skTerakhir" : null,
  });
}
