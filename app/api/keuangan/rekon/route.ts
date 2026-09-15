import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

/* GET, daftar semua rekon yang pernah dilakukan */
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [rekonList, users] = await Promise.all([
    db.rekonBulanan.findMany({ orderBy: { field: "tanggalInput", dir: "desc" } }) as Promise<any[]>,
    db.user.findMany(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  const list = rekonList.map((r) => {
    const u = userById.get(r.inputBy);
    return { ...r, creator: u ? { nama: u.nama, nip: u.nip } : null };
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

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const body = (await req.json()) as any;
  const bulanTmt: string = body.bulanTmt; // format "YYYY-MM"
  const catatan: string = body.catatan ?? "";

  if (!bulanTmt || !/^\d{4}-\d{2}$/.test(bulanTmt))
    return NextResponse.json({ error: "Format bulanTmt tidak valid (YYYY-MM)" }, { status: 400 });

  const [tYear, tMonth] = bulanTmt.split("-").map(Number);
  const tmtDate = new Date(tYear, tMonth - 1, 1);
  const h1Year = tmtDate.getMonth() === 0 ? tYear - 1 : tYear;
  const h1Month = tmtDate.getMonth() === 0 ? 12 : tMonth - 1;
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const isRekonWindow = todayYear === h1Year && todayMonth === h1Month && todayDay >= 1 && todayDay <= 15;

  if (!isRekonWindow) {
    const bulanH1 = new Date(h1Year, h1Month - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return NextResponse.json(
      { error: `Masa rekon untuk KGB TMT ${bulanTmt} hanya pada tanggal 1–15 ${bulanH1}.` },
      { status: 400 },
    );
  }

  // Cek: sudah pernah direkon?
  const existing = (await db.rekonBulanan.findUnique({ bulanTmt })) as any;
  if (existing)
    return NextResponse.json(
      { error: `Input untuk KGB TMT ${bulanTmt} sudah pernah dilakukan pada ${new Date(existing.tanggalInput).toLocaleDateString("id-ID")}.` },
      { status: 409 },
    );

  const [y, m] = bulanTmt.split("-").map(Number);
  const dateFrom = new Date(y, m - 1, 1);
  const dateTo = new Date(y, m, 1);

  const allKgb = await db.riwayatKGB.findMany({ where: { status: "menunggu_keuangan" } });
  const kgbList = allKgb.filter((k) => k.tmtKgbBaru && k.tmtKgbBaru >= dateFrom && k.tmtKgbBaru < dateTo);

  if (kgbList.length === 0)
    return NextResponse.json({ error: "Tidak ada data KGB yang menunggu konfirmasi untuk bulan ini." }, { status: 404 });

  const now = new Date();

  // Tandai setiap KGB: inputGajiWebAt + inputGajiWebBy.
  await db.riwayatKGB.updateMany(
    { id: { in: kgbList.map((k) => k.id) } },
    { inputGajiWebAt: now, inputGajiWebBy: userLogin.id },
  );

  // Catat rekon.
  const rekonId = newId();
  await db.rekonBulanan.create({
    id: rekonId,
    bulanTmt,
    tanggalInput: now,
    inputBy: userLogin.id,
    jumlahData: kgbList.length,
    catatan: catatan || null,
    createdAt: now,
  });

  const namaBulan = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  logAudit({
    userId: userLogin.id,
    aksi: "rekon_keuangan",
    detail: `Rekap dasar input Sistem Gaji Web, KGB TMT ${namaBulan}, ${kgbList.length} data, Tgl input: ${now.toLocaleDateString("id-ID")}`,
    targetNama: `KGB TMT ${namaBulan}`,
  });

  return NextResponse.json({ ok: true, jumlahData: kgbList.length, rekonId }, { status: 201 });
}
