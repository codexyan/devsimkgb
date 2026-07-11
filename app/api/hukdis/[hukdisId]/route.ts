import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";
import { canManageHukdis } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ hukdisId: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak: hanya SDM Hukdis dan Super Admin" }, { status: 403 });

  const { hukdisId } = await params;

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const hukdis = await prisma.riwayatHukdis.findUnique({
    where: { id: hukdisId },
    include: { pegawai: true },
  });
  if (!hukdis)
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const pegawai = hukdis.pegawai;

  // Hitung TMT yang dipulihkan jika penundaan KGB
  const restoredTmt = hukdis.berdampakKGB && hukdis.durasiTunda
    ? new Date(pegawai.tmtKgbBerikutnya.getFullYear(), pegawai.tmtKgbBerikutnya.getMonth() - hukdis.durasiTunda, pegawai.tmtKgbBerikutnya.getDate())
    : null;

  const updates: Record<string, unknown> = {};
  if (restoredTmt) updates.tmtKgbBerikutnya = restoredTmt;

  // Cek apakah masih ada hukdis aktif lain untuk pegawai ini
  const sisaHukdis = await prisma.riwayatHukdis.count({
    where: { pegawaiId: pegawai.id, id: { not: hukdisId } },
  });
  if (sisaHukdis === 0) {
    updates.statusHukdis = false;
    updates.tanggalHukdisBerakhir = null;
    updates.jenisHukdis = null;
    updates.keteranganHukdis = null;
  }

  await prisma.$transaction([
    prisma.riwayatHukdis.delete({ where: { id: hukdisId } }),
    prisma.pegawai.update({ where: { id: pegawai.id }, data: updates }),
  ]);

  // Sinkronisasi riwayatKGB placeholder ke TMT yang dipulihkan
  if (restoredTmt) {
    const newTmtBerikutnya = new Date(restoredTmt.getFullYear() + 2, restoredTmt.getMonth(), restoredTmt.getDate());
    const mkgTahunBaru = pegawai.mkgTahun + 2;
    const gajiPokokBaru = getGajiPokok(pegawai.golonganRuang, mkgTahunBaru, pegawai.mkgBulan);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const deadlineRestored = new Date(restoredTmt.getFullYear(), restoredTmt.getMonth() - 1, 0);
    const flagRapelan = todayDate > deadlineRestored;

    await prisma.riwayatKGB.deleteMany({ where: { pegawaiId: pegawai.id, status: "belum_diproses" } });
    await prisma.riwayatKGB.create({
      data: {
        pegawaiId: pegawai.id,
        nomorSK: "",
        tanggalSK: restoredTmt,
        tmtSK: restoredTmt,
        golonganLama: pegawai.golonganRuang,
        gajiPokokLama: pegawai.gajiPokok,
        mkgTahunLama: pegawai.mkgTahun,
        mkgBulanLama: pegawai.mkgBulan,
        golonganBaru: pegawai.golonganRuang,
        gajiPokokBaru,
        mkgTahunBaru,
        mkgBulanBaru: pegawai.mkgBulan,
        tmtKgbBaru: restoredTmt,
        tmtKgbBerikutnya: newTmtBerikutnya,
        status: "belum_diproses",
        flagRapelan,
        createdBy: userLogin.id,
      },
    });
  }

  logAudit({
    userId: userLogin.id,
    aksi: "hapus_hukdis",
    detail: `Hapus hukdis ${hukdis.jenisHukdis} untuk ${pegawai.nama} (${pegawai.nip})${restoredTmt ? ", TMT KGB dipulihkan" : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true });
}
