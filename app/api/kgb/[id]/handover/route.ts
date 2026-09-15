import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";
import { canProcessKGB } from "@/lib/auth";

export const runtime = "nodejs";

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
  const { keterangan } = (await req.json()) as any;

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  // Catat serah terima
  const serahTerima = {
    id: newId(),
    kgbId: id,
    namaAdmin: session.user.nama!,
    keterangan: keterangan || null,
    tanggalSerahTerima: new Date(),
    createdBy: userLogin.id,
  };
  await db.serahTerima.create(serahTerima);

  // Update status KGB jadi selesai
  const kgbSelesai = await db.riwayatKGB.update({ id }, { status: "selesai" });
  if (!kgbSelesai)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  // Auto-generate KGB berikutnya
  const pegawai = await db.pegawai.findUnique({ id: kgbSelesai.pegawaiId });
  if (pegawai) {
    const tmtNext = new Date(kgbSelesai.tmtKgbBerikutnya as Date);
    const tmtNextBerikutnya = new Date(tmtNext);
    tmtNextBerikutnya.setFullYear(tmtNextBerikutnya.getFullYear() + 2);

    const nextMkgTahunLama = kgbSelesai.mkgTahunBaru;
    const nextMkgBulanLama = kgbSelesai.mkgBulanBaru;
    const nextGolonganLama = kgbSelesai.golonganBaru;
    const nextGajiPokokLama = kgbSelesai.gajiPokokBaru;

    const nextMkgTahunBaru = nextMkgTahunLama + 2;
    const nextMkgBulanBaru = nextMkgBulanLama;
    const nextGajiPokokBaru = getGajiPokok(nextGolonganLama, nextMkgTahunBaru, nextMkgBulanBaru);

    const today = new Date();
    const deadlineSDM = new Date(tmtNext.getFullYear(), tmtNext.getMonth() - 1, 0);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const flagRapelan = todayDate > deadlineSDM;

    await db.pegawai.update(
      { id: pegawai.id },
      {
        golonganRuang: kgbSelesai.golonganBaru,
        gajiPokok: kgbSelesai.gajiPokokBaru,
        mkgTahun: kgbSelesai.mkgTahunBaru,
        mkgBulan: kgbSelesai.mkgBulanBaru,
        tmtKgbBerikutnya: tmtNext,
      },
    );

    await db.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });

    await db.riwayatKGB.create(
      makeRiwayatKGB({
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
        createdBy: userLogin.id,
      }),
    );

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

  const logs = await db.serahTerima.findMany({
    where: { kgbId: id },
    orderBy: { field: "tanggalSerahTerima", dir: "desc" },
  });

  return NextResponse.json(logs);
}
