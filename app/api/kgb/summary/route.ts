import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const rapelanCutoff = new Date(today.getFullYear(), today.getMonth() + 2, 1);

  const [allKgb, pegawaiList] = await Promise.all([
    db.riwayatKGB.findMany(),
    db.pegawai.findMany(),
  ]);
  const pegAktif = pegawaiList.filter((p) => p.aktif);
  const aktifStatus = ["belum_diproses", "sedang_diproses", "menunggu_keuangan"];
  const activePegIds = new Set(allKgb.filter((k) => aktifStatus.includes(k.status)).map((k) => k.pegawaiId));
  const selesaiPegIds = new Set(allKgb.filter((k) => k.status === "selesai").map((k) => k.pegawaiId));

  const belumDiproses = allKgb.filter((k) => k.status === "belum_diproses").length;
  const sedangDiproses = allKgb.filter((k) => k.status === "sedang_diproses" && !k.isArsip).length;
  const menungguKeuangan = allKgb.filter((k) => k.status === "menunggu_keuangan" && !k.isArsip).length;
  const selesai = allKgb.filter((k) => k.status === "selesai" && !k.isArsip).length;
  const ditolak = allKgb.filter((k) => k.status === "ditolak" && !k.isArsip).length;
  const virtualCount = pegAktif.filter((p) => !activePegIds.has(p.id)).length;
  const rapelan = pegAktif.filter(
    (p) => p.tmtKgbBerikutnya && p.tmtKgbBerikutnya < rapelanCutoff && !selesaiPegIds.has(p.id),
  ).length;

  const totalBelumDiproses = belumDiproses + virtualCount;
  const total = totalBelumDiproses + sedangDiproses + menungguKeuangan + selesai + ditolak;

  return NextResponse.json({
    total,
    belum_diproses: totalBelumDiproses,
    sedang_diproses: sedangDiproses + menungguKeuangan,
    menunggu_keuangan: menungguKeuangan,
    selesai,
    ditolak,
    rapelan,
  });
}
