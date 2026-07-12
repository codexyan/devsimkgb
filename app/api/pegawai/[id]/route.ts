import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis, canEditPegawai } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const pegawai = await sheets.pegawai.findUnique({ id });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

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
  const body = (await req.json()) as any;

  if (!body.tmtGolongan || !body.tmtKgbBerikutnya) {
    return NextResponse.json({ error: "TMT Golongan dan TMT KGB Berikutnya wajib diisi" }, { status: 400 });
  }

  const pegawai = await sheets.pegawai.update(
    { id },
    {
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
      tanggalHukdisBerakhir: body.tanggalHukdisBerakhir ? new Date(body.tanggalHukdisBerakhir) : null,
      jenisHukdis: body.jenisHukdis || null,
      aktif: body.aktif !== undefined ? body.aktif : true,
      updatedAt: new Date(),
    },
  );
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
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

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  const pegawai = await sheets.pegawai.findUnique({ id });

  if (hapusPermanent) {
    const kgbList = await sheets.riwayatKGB.findMany({ where: { pegawaiId: id } });
    const kgbIds = kgbList.map((k) => k.id);

    if (kgbIds.length > 0) {
      await sheets.suratKGB.deleteMany({ kgbId: { in: kgbIds } });
      await sheets.serahTerima.deleteMany({ kgbId: { in: kgbIds } });
    }
    await sheets.riwayatKGB.deleteMany({ pegawaiId: id });
    await sheets.pegawai.delete({ id });

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

  await sheets.pegawai.update({ id }, { aktif: false });

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
