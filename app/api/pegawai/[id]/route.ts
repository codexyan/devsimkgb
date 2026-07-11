import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis, canEditPegawai } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const pegawai = await prisma.pegawai.findUnique({
    where: { id },
  });

  if (!pegawai)
    return NextResponse.json(
      { error: "Pegawai tidak ditemukan" },
      { status: 404 },
    );

  const role = session.user.role!;
  const data = canManageHukdis(role)
    ? pegawai
    : { ...pegawai, jenisHukdis: null, keteranganHukdis: null };

  return NextResponse.json(data);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canEditPegawai(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as any;

  if (!body.tmtGolongan || !body.tmtKgbBerikutnya) {
    return NextResponse.json(
      { error: "TMT Golongan dan TMT KGB Berikutnya wajib diisi" },
      { status: 400 },
    );
  }

  let pegawai;
  try {
    pegawai = await prisma.pegawai.update({
    where: { id },
    data: {
      nama: body.nama,
      tempatLahir: body.tempatLahir || null,
      tanggalLahir: body.tanggalLahir ? new Date(body.tanggalLahir) : null,
      jenisKelamin: body.jenisKelamin || null,
      pendidikanTerakhir: body.pendidikanTerakhir || null,
      jabatan: body.jabatan,
      pangkat: body.pangkat,
      golonganRuang: body.golonganRuang,
      unitKerja: body.unitKerja,
      eselon: body.eselon || null,
      jenisJabatan: body.jenisJabatan || null,
      tmtGolongan: new Date(body.tmtGolongan),
      mkgTahun: parseInt(body.mkgTahun) || 0,
      mkgBulan: parseInt(body.mkgBulan) || 0,
      gajiPokok: parseInt(body.gajiPokok),
      tmtKgbBerikutnya: new Date(body.tmtKgbBerikutnya),
      tmtKgbTerakhir: body.tmtKgbTerakhir
        ? new Date(body.tmtKgbTerakhir)
        : (() => { const d = new Date(body.tmtKgbBerikutnya); d.setFullYear(d.getFullYear() - 2); return d; })(),
      statusHukdis: body.statusHukdis || false,
      keteranganHukdis: body.keteranganHukdis || null,
      tanggalHukdisBerakhir: body.tanggalHukdisBerakhir
        ? new Date(body.tanggalHukdisBerakhir)
        : null,
      jenisHukdis: body.jenisHukdis || null,
      aktif: body.aktif !== undefined ? body.aktif : true,
    },
  });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
    throw e;
  }

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "edit_pegawai",
      detail: `Edit data pegawai: ${pegawai.nama} (${pegawai.nip}), ${pegawai.jabatan}, Gol. ${pegawai.golonganRuang}`,
      targetNama: pegawai.nama,
    });
  }

  return NextResponse.json(pegawai);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canEditPegawai(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hapusPermanent = searchParams.get("permanent") === "true";

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });

  if (hapusPermanent) {
    const pegawai = await prisma.pegawai.findUnique({ where: { id }, select: { nama: true, nip: true } });

    const kgbList = await prisma.riwayatKGB.findMany({
      where: { pegawaiId: id },
      select: { id: true },
    });
    const kgbIds = kgbList.map((k) => k.id);

    await prisma.suratKGB.deleteMany({ where: { kgbId: { in: kgbIds } } });
    await prisma.serahTerima.deleteMany({ where: { kgbId: { in: kgbIds } } });
    await prisma.riwayatKGB.deleteMany({ where: { pegawaiId: id } });
    await prisma.pegawai.delete({ where: { id } });

    if (userLogin && pegawai) {
      logAudit({
        userId: userLogin.id,
        aksi: "hapus_pegawai",
        detail: `Hapus permanen pegawai: ${pegawai.nama} (${pegawai.nip})`,
        targetNama: pegawai.nama,
      });
    }

    return NextResponse.json({ message: "Pegawai berhasil dihapus permanen" });
  }

  const pegawai = await prisma.pegawai.findUnique({ where: { id }, select: { nama: true, nip: true } });

  await prisma.pegawai.update({
    where: { id },
    data: { aktif: false },
  });

  if (userLogin && pegawai) {
    logAudit({
      userId: userLogin.id,
      aksi: "hapus_pegawai",
      detail: `Nonaktifkan pegawai: ${pegawai.nama} (${pegawai.nip})`,
      targetNama: pegawai.nama,
    });
  }

  return NextResponse.json({ message: "Pegawai berhasil dinonaktifkan" });
}
