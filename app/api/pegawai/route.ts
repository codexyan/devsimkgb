import { CI } from "@/lib/searchMode";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis, canEditPegawai } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Auto clear hukdis yang sudah berakhir
    await prisma.pegawai.updateMany({
      where: {
        statusHukdis: true,
        tanggalHukdisBerakhir: { lt: new Date() },
      },
      data: {
        statusHukdis: false,
        tanggalHukdisBerakhir: null,
        jenisHukdis: null,
      },
    });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const pegawai = await prisma.pegawai.findMany({
      where: {
        aktif: status === "nonaktif" ? false : true,
        OR: search
          ? [
              { nama: { contains: search, ...CI } },
              { nip: { contains: search, ...CI } },
              { jabatan: { contains: search, ...CI } },
              { unitKerja: { contains: search, ...CI } },
            ]
          : undefined,
      },
      orderBy: { nama: "asc" },
      // Status KGB terkini (record aktif terbaru) untuk badge & aksi cepat di
      // halaman Pegawai — integrasi Kepegawaian ⇄ KGB.
      include: {
        riwayatKGB: {
          where: { isArsip: false },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
      },
    });

    // Ratakan status KGB ke tiap pegawai; buang array mentahnya dari respons.
    const withKgb = pegawai.map(({ riwayatKGB, ...rest }) => ({
      ...rest,
      statusKGB: riwayatKGB[0]?.status ?? null,
      kgbId: riwayatKGB[0]?.id ?? null,
    }));

    const role = session.user.role!;
    const data = canManageHukdis(role)
      ? withKgb
      : withKgb.map((p) => ({ ...p, jenisHukdis: null, keteranganHukdis: null }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/pegawai error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canEditPegawai(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = await req.json() as any;

  const existing = await prisma.pegawai.findUnique({
    where: { nip: body.nip },
  });
  if (existing)
    return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 400 });

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const pegawai = await prisma.pegawai.create({
    data: {
      nip: body.nip,
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
    },
  });

  // Auto-create KGB pertama
  const { kalkulasiKGB } = await import("@/lib/tabelGaji");
  const hasil = kalkulasiKGB(pegawai);
  const today = new Date();
  const deadlineSDM = new Date(hasil.tmtKgbBaru.getFullYear(), hasil.tmtKgbBaru.getMonth() - 1, 0);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const flagRapelan = todayDate > deadlineSDM;

  await prisma.riwayatKGB.create({
    data: {
      pegawaiId: pegawai.id,
      nomorSK: "",
      tanggalSK: new Date(hasil.tmtKgbBaru),
      tmtSK: new Date(hasil.tmtKgbBaru),
      golonganLama: pegawai.golonganRuang,
      gajiPokokLama: pegawai.gajiPokok,
      mkgTahunLama: pegawai.mkgTahun,
      mkgBulanLama: pegawai.mkgBulan,
      golonganBaru: pegawai.golonganRuang,
      gajiPokokBaru: hasil.gajiPokokBaru,
      mkgTahunBaru: hasil.mkgTahunBaru,
      mkgBulanBaru: hasil.mkgBulanBaru,
      tmtKgbBaru: hasil.tmtKgbBaru,
      tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
      status: "belum_diproses",
      flagRapelan,
      createdBy: userLogin.id,
    },
  });

  logAudit({
    userId: userLogin.id,
    aksi: "tambah_pegawai",
    detail: `Tambah pegawai baru: ${pegawai.nama} (${pegawai.nip}), ${pegawai.jabatan}, ${pegawai.golonganRuang}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json(pegawai, { status: 201 });
}
