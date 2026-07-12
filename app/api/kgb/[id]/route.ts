import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canProcessKGB } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as any;

  // Toggle flagRapelan manual
  if (body.flagRapelan !== undefined) {
    const kgb = await sheets.riwayatKGB.update({ id }, { flagRapelan: body.flagRapelan });
    if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
    return NextResponse.json(kgb);
  }

  // Update data SK (dari halaman generate)
  if (body.nomorSK !== undefined) {
    const patch: Record<string, unknown> = { nomorSK: body.nomorSK };
    if (body.tanggalSK) patch.tanggalSK = new Date(body.tanggalSK);
    if (body.tmtSK) patch.tmtSK = new Date(body.tmtSK);
    const kgb = await sheets.riwayatKGB.update({ id }, patch);
    if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
    return NextResponse.json(kgb);
  }

  // Update status
  const validStatus = ["belum_diproses", "sedang_diproses", "selesai", "ditolak"];
  if (!validStatus.includes(body.status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const kgb = await sheets.riwayatKGB.update({ id }, { status: body.status });
  if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });

  const [pegawai, userLogin] = await Promise.all([
    sheets.pegawai.findUnique({ id: kgb.pegawaiId }),
    sheets.user.findUnique({ nip: session.user.nip! }),
  ]);

  // Jika ditolak, catat alasan di SerahTerima
  if (body.status === "ditolak" && body.alasanTolak && userLogin) {
    await sheets.serahTerima.create({
      id: newId(),
      kgbId: id,
      namaAdmin: session.user.nama || userLogin.nama,
      keterangan: `DITOLAK: ${body.alasanTolak}`,
      tanggalSerahTerima: new Date(),
      createdBy: userLogin.id,
    });
  }

  if (userLogin) {
    const statusLabel: Record<string, string> = {
      belum_diproses: "Belum Diproses",
      sedang_diproses: "Sedang Diproses",
      selesai: "Selesai",
      ditolak: "Ditolak",
    };
    const aksi = body.status === "ditolak" ? "reject_kgb" : "approve_kgb";
    logAudit({
      userId: userLogin.id,
      aksi,
      detail: `Status KGB ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}) diubah menjadi "${statusLabel[body.status] ?? body.status}"${body.alasanTolak ? `, Alasan: ${body.alasanTolak}` : ""}`,
      targetNama: pegawai?.nama ?? "-",
    });
  }

  return NextResponse.json({ ...kgb, pegawai: pegawai ? { nama: pegawai.nama, nip: pegawai.nip } : null });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const ok = await sheets.riwayatKGB.delete({ id });
  if (!ok) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ message: "Data KGB berhasil dihapus" });
}
