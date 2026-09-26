import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * SK dasar KGB yang dikirim UPT lewat usulan: nomor dan tanggal SK CPNS (bagi pegawai yang belum pernah
 * KGB) atau SK KGB terakhir, beserta TMT-nya. Dipakai Input KGB sebagai isian awal ketika riwayat KGB dan
 * data pegawai belum memuatnya, supaya Tim SDM tidak mengetik ulang yang sudah diketik UPT, dan dapat
 * membuka pindaian SK-nya untuk dicocokkan.
 *
 * Usulan yang disetujui didahulukan. Bila belum ada, usulan yang sudah diajukan tetapi belum selesai
 * ditinjau (menunggu atau dikembalikan) ikut dipakai, dengan statusnya disebut agar peninjau tahu datanya
 * belum diperiksa. Draf tidak pernah dipakai: Kanwil belum boleh melihatnya sebelum diajukan UPT.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const usulan = (await db.usulanPegawai.findMany({
    where: { pegawaiId: id, status: { in: ["disetujui", "menunggu", "revisi"] } },
  })) as UsulanPegawaiRow[];
  const waktu = (u: UsulanPegawaiRow) => new Date(u.ditinjauAt ?? u.diajukanAt ?? 0).getTime();
  const terbaru = usulan
    .filter((u) => u.nomorSkTerakhir?.trim() || u.tanggalSkTerakhir)
    .sort((a, b) => Number(b.status === "disetujui") - Number(a.status === "disetujui") || waktu(b) - waktu(a))[0];
  if (!terbaru) return NextResponse.json(null);

  return NextResponse.json({
    usulanId: terbaru.id,
    status: terbaru.status,
    nomorSK: terbaru.nomorSkTerakhir?.trim() || null,
    tanggalSK: terbaru.tanggalSkTerakhir ? new Date(terbaru.tanggalSkTerakhir).toISOString() : null,
    // Pada formulir UPT, TMT CPNS dan TMT KGB terakhir sama-sama disimpan di kolom ini.
    tmtSK: terbaru.tmtKgbTerakhir ? new Date(terbaru.tmtKgbTerakhir).toISOString() : null,
    // Pindaian yang dapat dibuka lewat /api/usulan/[id]/berkas untuk dicocokkan.
    berkas: terbaru.pathSkCpns ? "skCpns" : terbaru.pathSkTerakhir ? "skTerakhir" : null,
  });
}
