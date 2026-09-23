import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { bolehUnduhSkUpt, satkerAkunUpt } from "@/lib/aksesUpt";
import { kunciSk, responsBerkasSk } from "@/lib/berkasSk";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";

export const runtime = "nodejs";

/*
 * Unduh SK untuk Admin UPT. Berbeda dengan /api/blob/download yang menerima key berkas apa pun, rute ini
 * menerima id KGB lalu memeriksa sendiri: akunnya Admin UPT dengan satker yang sah, pegawainya pegawai
 * satker itu, dan KGB-nya sudah dikonfirmasi keuangan (lib/aksesUpt.ts).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pengguna = session.user.nip ? await db.user.findUnique({ nip: session.user.nip }) : null;
  const kode = pengguna ? satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker }) : null;
  if (!kode)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const kgb = await db.riwayatKGB.findUnique({ id });
  const [pegawai, surat] = await Promise.all([
    kgb ? db.pegawai.findUnique({ id: kgb.pegawaiId }) : null,
    kgb ? (db.suratKGB.findUnique({ kgbId: kgb.id }) as Promise<SuratKgbTersimpan | null>) : null,
  ]);

  if (!bolehUnduhSkUpt({ kode, kgb, pegawai, pathFile: surat?.pathFile ?? null }))
    return NextResponse.json({ error: "SK tidak tersedia untuk satker Anda" }, { status: 403 });

  const key = kunciSk(surat!.pathFile!);
  if (!key)
    return NextResponse.json({ error: "Berkas SK tidak valid" }, { status: 400 });

  return responsBerkasSk(key, `SK-KGB-${pegawai!.nip}.pdf`);
}
