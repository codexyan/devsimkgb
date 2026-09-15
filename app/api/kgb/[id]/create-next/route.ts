import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { getGajiPokok } from "@/lib/tabelGaji";

export const runtime = "nodejs";

/**
 * POST /api/kgb/[id]/create-next
 * Buat placeholder KGB berikutnya dari KGB yang sudah selesai.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "selesai")
    return NextResponse.json({ error: "Hanya KGB berstatus Selesai yang bisa dibuat placeholder-nya" }, { status: 400 });

  const pegawai = await db.pegawai.findUnique({ id: kgb.pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const tmtNext = new Date(kgb.tmtKgbBerikutnya as Date);
  const tmtNextBerikutnya = new Date(tmtNext);
  tmtNextBerikutnya.setFullYear(tmtNextBerikutnya.getFullYear() + 2);

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

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });

  await db.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });

  await db.pegawai.update(
    { id: pegawai.id },
    {
      golonganRuang: kgb.golonganBaru,
      gajiPokok: kgb.gajiPokokBaru,
      mkgTahun: kgb.mkgTahunBaru,
      mkgBulan: kgb.mkgBulanBaru,
      tmtKgbBerikutnya: tmtNext,
    },
  );

  const next = makeRiwayatKGB({
    pegawaiId: pegawai.id,
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
  });
  await db.riwayatKGB.create(next);

  return NextResponse.json({ success: true, next });
}
