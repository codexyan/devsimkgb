import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";
import { canManageHukdis } from "@/lib/auth";

export const runtime = "nodejs";

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

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const hukdis = (await sheets.riwayatHukdis.findUnique({ id: hukdisId })) as any;
  if (!hukdis)
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const pegawai = await sheets.pegawai.findUnique({ id: hukdis.pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const tmtBerikutnya = pegawai.tmtKgbBerikutnya ? new Date(pegawai.tmtKgbBerikutnya) : new Date();
  // Hitung TMT yang dipulihkan jika penundaan KGB.
  const restoredTmt = hukdis.berdampakKGB && hukdis.durasiTunda
    ? new Date(tmtBerikutnya.getFullYear(), tmtBerikutnya.getMonth() - hukdis.durasiTunda, tmtBerikutnya.getDate())
    : null;

  const updates: Record<string, unknown> = {};
  if (restoredTmt) updates.tmtKgbBerikutnya = restoredTmt;

  // Cek apakah masih ada hukdis aktif lain untuk pegawai ini.
  const sisaHukdis = await sheets.riwayatHukdis.count({ pegawaiId: pegawai.id, id: { not: hukdisId } });
  if (sisaHukdis === 0) {
    updates.statusHukdis = false;
    updates.tanggalHukdisBerakhir = null;
    updates.jenisHukdis = null;
    updates.keteranganHukdis = null;
  }

  // Pengganti $transaction: hapus + update sekuensial (best-effort).
  await sheets.riwayatHukdis.delete({ id: hukdisId });
  await sheets.pegawai.update({ id: pegawai.id }, updates);

  // Sinkronisasi riwayatKGB placeholder ke TMT yang dipulihkan.
  if (restoredTmt) {
    const newTmtBerikutnya = new Date(restoredTmt.getFullYear() + 2, restoredTmt.getMonth(), restoredTmt.getDate());
    const mkgTahunBaru = pegawai.mkgTahun + 2;
    const gajiPokokBaru = getGajiPokok(pegawai.golonganRuang, mkgTahunBaru, pegawai.mkgBulan);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const deadlineRestored = new Date(restoredTmt.getFullYear(), restoredTmt.getMonth() - 1, 0);
    const flagRapelan = todayDate > deadlineRestored;

    await sheets.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });
    await sheets.riwayatKGB.create({
      id: newId(),
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
      isArsip: false,
      konfirmasiKeuanganAt: null,
      konfirmasiKeuanganBy: null,
      rapelanDitetapkan: null,
      inputGajiWebAt: null,
      inputGajiWebBy: null,
      createdBy: userLogin.id,
      createdAt: new Date(),
      penetapSkDasar: null,
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
