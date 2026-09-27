import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";
import { hukdisMasihBerlaku, type RiwayatHukdisRow } from "@/lib/hukdisKedaluwarsa";
import { catatHukdis } from "@/lib/catatHukdis";
import { hariIniWita } from "@/lib/waktu";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak: hanya SDM Hukdis dan Super Admin" }, { status: 403 });

  const { id } = await params;
  const list = (await db.riwayatHukdis.findMany({
    where: { pegawaiId: id },
    orderBy: { field: "tmtMulai", dir: "desc" },
  })) as unknown as RiwayatHukdisRow[];

  // Status berlaku diturunkan dari tanggal berakhir menurut WITA.
  const hariIni = hariIniWita();
  return NextResponse.json(list.map((h) => ({ ...h, aktif: hukdisMasihBerlaku(h.tmtBerakhir, hariIni) })));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak: hanya SDM Hukdis dan Super Admin" }, { status: 403 });

  const { id: pegawaiId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  // Pencatatannya sama persis dengan penerimaan laporan hukdis dari UPT (lib/catatHukdis.ts).
  const hasil = await catatHukdis(pegawaiId, body, userLogin.id);
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: hasil.status });

  return NextResponse.json(
    { ...hasil.hukdis, aktif: hasil.aktif, tmtKgbBerikutnya: hasil.tmtKgbBerikutnya },
    { status: 201 },
  );
}
