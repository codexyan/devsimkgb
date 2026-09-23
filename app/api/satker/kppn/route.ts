import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { kppnBerlaku } from "@/lib/kppnSatker";
import { muatKppnSatker } from "@/lib/muatKppnSatker";

export const runtime = "nodejs";

/**
 * KPPN mitra yang berlaku untuk tiap satker.
 *
 * Halaman dasbor memuat daftar satker dari bundel peramban, yang hanya berisi KPPN bawaan. Penyesuaian
 * dari Pengaturan tersimpan di server, sehingga petunjuk "KPPN mitra" pada formulir pegawai dan panduan
 * impor membacanya dari sini agar tidak menyebut kantor bayar yang sudah tidak berlaku.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await muatKppnSatker();
  return NextResponse.json(kppnBerlaku().map(({ kode, kppn }) => ({ kode, kppn })));
}
