import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

/* GET, daftar semua rekon yang pernah dilakukan */
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const list = await prisma.rekonBulanan.findMany({
    orderBy: { tanggalInput: "desc" },
    include: { creator: { select: { nama: true, nip: true } } },
  });

  return NextResponse.json(list);
}

/* POST, lakukan bulk input gaji web untuk satu bulan TMT */
export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const body = await req.json() as any;
  const bulanTmt: string = body.bulanTmt; // format "YYYY-MM"
  const catatan: string  = body.catatan ?? "";

  if (!bulanTmt || !/^\d{4}-\d{2}$/.test(bulanTmt))
    return NextResponse.json({ error: "Format bulanTmt tidak valid (YYYY-MM)" }, { status: 400 });

  // Validasi: hanya boleh dilakukan pada tanggal 1–15 bulan H-1
  // H-1 = bulan TMT - 1
  const [tYear, tMonth] = bulanTmt.split("-").map(Number);
  const tmtDate   = new Date(tYear, tMonth - 1, 1);
  const h1Year    = tmtDate.getMonth() === 0 ? tYear - 1 : tYear;
  const h1Month   = tmtDate.getMonth() === 0 ? 12 : tMonth - 1; // 1-indexed
  const today     = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-indexed
  const todayDay  = today.getDate();

  const isRekonWindow =
    todayYear  === h1Year  &&
    todayMonth === h1Month &&
    todayDay   >= 1        &&
    todayDay   <= 15;

  if (!isRekonWindow) {
    const bulanH1 = new Date(h1Year, h1Month - 1, 1).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
    return NextResponse.json(
      { error: `Masa rekon untuk KGB TMT ${bulanTmt} hanya pada tanggal 1–15 ${bulanH1}.` },
      { status: 400 },
    );
  }

  // Cek: sudah pernah direkon?
  const existing = await prisma.rekonBulanan.findUnique({ where: { bulanTmt } });
  if (existing)
    return NextResponse.json(
      { error: `Input untuk KGB TMT ${bulanTmt} sudah pernah dilakukan pada ${new Date(existing.tanggalInput).toLocaleDateString("id-ID")}.` },
      { status: 409 },
    );

  // Ambil semua KGB menunggu_keuangan dengan TMT di bulan tersebut
  const [y, m] = bulanTmt.split("-").map(Number);
  const dateFrom = new Date(y, m - 1, 1);
  const dateTo   = new Date(y, m, 1);

  const kgbList = await prisma.riwayatKGB.findMany({
    where: {
      status: "menunggu_keuangan",
      tmtKgbBaru: { gte: dateFrom, lt: dateTo },
    },
    include: { pegawai: { select: { nama: true, nip: true } } },
  });

  if (kgbList.length === 0)
    return NextResponse.json(
      { error: "Tidak ada data KGB yang menunggu konfirmasi untuk bulan ini." },
      { status: 404 },
    );

  const now = new Date();

  // Tandai setiap KGB: inputGajiWebAt + inputGajiWebBy
  await prisma.riwayatKGB.updateMany({
    where: { id: { in: kgbList.map((k) => k.id) } },
    data: {
      inputGajiWebAt: now,
      inputGajiWebBy: userLogin.id,
    },
  });

  // Catat rekon
  const rekon = await prisma.rekonBulanan.create({
    data: {
      bulanTmt,
      tanggalInput: now,
      inputBy: userLogin.id,
      jumlahData: kgbList.length,
      catatan: catatan || null,
    },
  });

  const namaBulan = new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  logAudit({
    userId: userLogin.id,
    aksi: "rekon_keuangan",
    detail: `Rekap dasar input Sistem Gaji Web, KGB TMT ${namaBulan}, ${kgbList.length} data, Tgl input: ${now.toLocaleDateString("id-ID")}`,
    targetNama: `KGB TMT ${namaBulan}`,
  });

  return NextResponse.json({ ok: true, jumlahData: kgbList.length, rekonId: rekon.id }, { status: 201 });
}
