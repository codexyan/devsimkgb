import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id },
    include: { pegawai: true, surat: true },
  });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const nomorSuratParam = (formData.get("nomorSurat") as string | null)?.trim() || null;
  const tanggalSuratParam = (formData.get("tanggalSurat") as string | null)?.trim() || null;
  const tanggalSuratFinal = tanggalSuratParam ? new Date(tanggalSuratParam) : new Date();

  if (!file)
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });

  if (file.type !== "application/pdf")
    return NextResponse.json({ error: "Hanya file PDF yang diperbolehkan" }, { status: 400 });

  // Simpan ke Cloudflare R2 (privat; hanya diakses server-side via binding).
  // pathFile = key objek yang disimpan di DB.
  const pathFile = `sk/${kgb.pegawai.nip}_${Date.now()}.pdf`;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const { env } = await getCloudflareContext({ async: true });
    await env.SK_BUCKET.put(pathFile, arrayBuffer, {
      httpMetadata: { contentType: "application/pdf" },
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal menyimpan file. Coba lagi." },
      { status: 500 },
    );
  }

  const nomorSuratFinal = nomorSuratParam ?? kgb.surat?.nomorSurat ?? "-";
  await prisma.suratKGB.upsert({
    where: { kgbId: id },
    update: { pathFile, ...(nomorSuratParam ? { nomorSurat: nomorSuratParam } : {}), ...(tanggalSuratParam ? { tanggalSurat: tanggalSuratFinal } : {}) },
    create: {
      kgbId: id,
      nomorSurat: nomorSuratFinal,
      tanggalSurat: tanggalSuratFinal,
      namaKepalaKanwil: "-",
      nipKepalaKanwil: "-",
      generatedBy: userLogin.id,
      pathFile,
    },
  });

  const sudahSelesai = kgb.status === "selesai";

  if (!sudahSelesai) {
    await prisma.riwayatKGB.update({
      where: { id },
      data: { status: "menunggu_keuangan" },
    });
  }

  logAudit({
    userId: userLogin.id,
    aksi: "upload_sk",
    detail: `Upload SK TTD untuk ${kgb.pegawai.nama} (${kgb.pegawai.nip}), menunggu konfirmasi keuangan`,
    targetNama: kgb.pegawai.nama,
  });

  return NextResponse.json({ pathFile }, { status: 200 });
}
