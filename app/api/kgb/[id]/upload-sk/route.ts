import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  const kgb = await sheets.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });
  const [pegawai, existingSurat] = await Promise.all([
    sheets.pegawai.findUnique({ id: kgb.pegawaiId }),
    sheets.suratKGB.findUnique({ kgbId: id }) as Promise<any>,
  ]);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const nomorSuratParam = (formData.get("nomorSurat") as string | null)?.trim() || null;
  const tanggalSuratParam = (formData.get("tanggalSurat") as string | null)?.trim() || null;
  const tanggalSuratFinal = tanggalSuratParam ? new Date(tanggalSuratParam) : new Date();

  if (!file)
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });

  if (file.type !== "application/pdf")
    return NextResponse.json({ error: "Hanya file PDF yang diperbolehkan" }, { status: 400 });

  // Simpan ke Cloudflare R2 (privat).
  const pathFile = `sk/${pegawai?.nip ?? "unknown"}_${Date.now()}.pdf`;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const { env } = await getCloudflareContext({ async: true });
    await env.SK_BUCKET.put(pathFile, arrayBuffer, {
      httpMetadata: { contentType: "application/pdf" },
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan file. Coba lagi." }, { status: 500 });
  }

  const nomorSuratFinal = nomorSuratParam ?? existingSurat?.nomorSurat ?? "-";
  if (existingSurat) {
    await sheets.suratKGB.update(
      { kgbId: id },
      {
        pathFile,
        ...(nomorSuratParam ? { nomorSurat: nomorSuratParam } : {}),
        ...(tanggalSuratParam ? { tanggalSurat: tanggalSuratFinal } : {}),
      } as any,
    );
  } else {
    await sheets.suratKGB.create({
      id: newId(),
      kgbId: id,
      nomorSurat: nomorSuratFinal,
      tanggalSurat: tanggalSuratFinal,
      namaKepalaKanwil: "-",
      nipKepalaKanwil: "-",
      pathFile,
      generatedAt: new Date(),
      generatedBy: userLogin.id,
    } as any);
  }

  const sudahSelesai = kgb.status === "selesai";
  if (!sudahSelesai) {
    await sheets.riwayatKGB.update({ id }, { status: "menunggu_keuangan" });
  }

  logAudit({
    userId: userLogin.id,
    aksi: "upload_sk",
    detail: `Upload SK TTD untuk ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}), menunggu konfirmasi keuangan`,
    targetNama: pegawai?.nama ?? "-",
  });

  return NextResponse.json({ pathFile }, { status: 200 });
}
