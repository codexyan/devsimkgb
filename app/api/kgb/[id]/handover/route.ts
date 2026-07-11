import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";
import { canProcessKGB } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const { keterangan } = await req.json() as any;

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json(
      { error: "User tidak ditemukan" },
      { status: 401 },
    );

  // Catat serah terima
  const serahTerima = await prisma.serahTerima.create({
    data: {
      kgbId: id,
      namaAdmin: session.user.nama!,
      keterangan: keterangan || null,
      createdBy: userLogin.id,
    },
  });

  // Update status KGB jadi selesai
  const kgbSelesai = await prisma.riwayatKGB.update({
    where: { id },
    data: { status: "selesai" },
  });

  // Auto-generate KGB berikutnya, gunakan tmtKgbBerikutnya dari record KGB
  const pegawai = await prisma.pegawai.findUnique({
    where: { id: kgbSelesai.pegawaiId },
  });
  if (pegawai) {
    const tmtNext = new Date(kgbSelesai.tmtKgbBerikutnya);
    const tmtNextBerikutnya = new Date(tmtNext);
    tmtNextBerikutnya.setFullYear(tmtNextBerikutnya.getFullYear() + 2);

    // Sumber kebenaran: nilai "baru" dari KGB yang baru selesai
    // Lama untuk placeholder berikutnya = Baru dari KGB selesai
    const nextMkgTahunLama = kgbSelesai.mkgTahunBaru;
    const nextMkgBulanLama = kgbSelesai.mkgBulanBaru;
    const nextGolonganLama = kgbSelesai.golonganBaru;
    const nextGajiPokokLama = kgbSelesai.gajiPokokBaru;

    // Baru untuk placeholder berikutnya = Lama + 2 tahun
    const nextMkgTahunBaru = nextMkgTahunLama + 2;
    const nextMkgBulanBaru = nextMkgBulanLama;
    const nextGajiPokokBaru = getGajiPokok(nextGolonganLama, nextMkgTahunBaru, nextMkgBulanBaru);

    const today = new Date();
    const deadlineSDM = new Date(tmtNext.getFullYear(), tmtNext.getMonth() - 1, 0);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const flagRapelan = todayDate > deadlineSDM;

    // Update pegawai dengan nilai selesai KGB (bukan di-advance saat input)
    await prisma.pegawai.update({
      where: { id: pegawai.id },
      data: {
        golonganRuang: kgbSelesai.golonganBaru,
        gajiPokok: kgbSelesai.gajiPokokBaru,
        mkgTahun: kgbSelesai.mkgTahunBaru,
        mkgBulan: kgbSelesai.mkgBulanBaru,
        tmtKgbBerikutnya: tmtNext,
      },
    });

    // Hapus semua duplikat belum_diproses, buat 1 placeholder bersih
    await prisma.riwayatKGB.deleteMany({
      where: { pegawaiId: pegawai.id, status: "belum_diproses" },
    });

    await prisma.riwayatKGB.create({
      data: {
        pegawaiId: pegawai.id,
        nomorSK: "",
        tanggalSK: tmtNext,
        tmtSK: tmtNext,
        golonganLama: nextGolonganLama,
        gajiPokokLama: nextGajiPokokLama,
        mkgTahunLama: nextMkgTahunLama,
        mkgBulanLama: nextMkgBulanLama,
        golonganBaru: nextGolonganLama,
        gajiPokokBaru: nextGajiPokokBaru,
        mkgTahunBaru: nextMkgTahunBaru,
        mkgBulanBaru: nextMkgBulanBaru,
        tmtKgbBaru: tmtNext,
        tmtKgbBerikutnya: tmtNextBerikutnya,
        status: "belum_diproses",
        flagRapelan,
        createdBy: userLogin.id,
      },
    });
  }

  if (pegawai) {
    logAudit({
      userId: userLogin.id,
      aksi: "serah_terima",
      detail: `Serah terima KGB ${pegawai.nama} (${pegawai.nip}) selesai${keterangan ? `, Catatan: ${keterangan}` : ""}`,
      targetNama: pegawai.nama,
    });
  }

  return NextResponse.json(serahTerima, { status: 201 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const logs = await prisma.serahTerima.findMany({
    where: { kgbId: id },
    orderBy: { tanggalSerahTerima: "desc" },
  });

  return NextResponse.json(logs);
}
