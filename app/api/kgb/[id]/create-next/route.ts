import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getGajiPokok } from "@/lib/tabelGaji";

/**
 * POST /api/kgb/[id]/create-next
 * Buat placeholder KGB berikutnya dari KGB yang sudah selesai.
 * Digunakan untuk repair data yang placeholder-nya tidak terbuat.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id },
    include: { pegawai: true },
  });

  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "selesai")
    return NextResponse.json({ error: "Hanya KGB berstatus Selesai yang bisa dibuat placeholder-nya" }, { status: 400 });

  const pegawai = kgb.pegawai;
  const tmtNext = new Date(kgb.tmtKgbBerikutnya);
  const tmtNextBerikutnya = new Date(tmtNext);
  tmtNextBerikutnya.setFullYear(tmtNextBerikutnya.getFullYear() + 2);

  // Sumber kebenaran: Lama = Baru dari KGB selesai, Baru = Lama + 2 tahun
  const nextMkgTahunLama = kgb.mkgTahunBaru;
  const nextMkgBulanLama = kgb.mkgBulanBaru;
  const nextGolonganLama = kgb.golonganBaru;
  const nextGajiPokokLama = kgb.gajiPokokBaru;

  const nextMkgTahunBaru = nextMkgTahunLama + 2;
  const nextMkgBulanBaru = nextMkgBulanLama;
  const nextGajiPokokBaru = getGajiPokok(nextGolonganLama, nextMkgTahunBaru, nextMkgBulanBaru);

  const today = new Date();
  const deadlineSDM = new Date(tmtNext.getFullYear(), tmtNext.getMonth() - 1, 0);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const flagRapelan = todayDate > deadlineSDM;

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });

  // Hapus semua belum_diproses lama (duplikat), buat 1 bersih
  await prisma.riwayatKGB.deleteMany({
    where: { pegawaiId: pegawai.id, status: "belum_diproses" },
  });

  // Update pegawai dengan nilai selesai KGB
  await prisma.pegawai.update({
    where: { id: pegawai.id },
    data: {
      golonganRuang: kgb.golonganBaru,
      gajiPokok: kgb.gajiPokokBaru,
      mkgTahun: kgb.mkgTahunBaru,
      mkgBulan: kgb.mkgBulanBaru,
      tmtKgbBerikutnya: tmtNext,
    },
  });

  const next = await prisma.riwayatKGB.create({
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
      createdBy: userLogin?.id ?? "",
    },
  });

  return NextResponse.json({ success: true, next });
}
