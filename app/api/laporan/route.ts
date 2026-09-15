import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tahun = parseInt(searchParams.get("tahun") || new Date().getFullYear().toString());
  const bulan = searchParams.get("bulan") || "";
  const status = searchParams.get("status") || "";

  const dateFrom = bulan
    ? new Date(tahun, parseInt(bulan) - 1, 1, 0, 0, 0)
    : new Date(tahun, 0, 1, 0, 0, 0);
  const dateTo = bulan
    ? new Date(tahun, parseInt(bulan), 0, 23, 59, 59)
    : new Date(tahun, 11, 31, 23, 59, 59);

  const [allKgb, pegawaiList, suratList] = await Promise.all([
    db.riwayatKGB.findMany({ orderBy: { field: "tmtKgbBaru", dir: "asc" } }),
    db.pegawai.findMany(),
    db.suratKGB.findMany() as Promise<any[]>,
  ]);
  const pegawaiById = new Map(pegawaiList.map((p) => [p.id, p]));
  const suratByKgbId = new Map(suratList.map((sRow) => [sRow.kgbId, sRow]));

  const kgbFiltered = allKgb.filter(
    (k) =>
      !k.isArsip &&
      k.tmtKgbBaru &&
      k.tmtKgbBaru >= dateFrom &&
      k.tmtKgbBaru <= dateTo &&
      (status ? k.status === status : true),
  );

  // Emulasi include pegawai + surat.
  const kgbList = kgbFiltered.map((k) => {
    const p = pegawaiById.get(k.pegawaiId);
    const sRow = suratByKgbId.get(k.id);
    return {
      ...k,
      pegawai: p
        ? { nama: p.nama, nip: p.nip, jabatan: p.jabatan, golonganRuang: p.golonganRuang, unitKerja: p.unitKerja }
        : null,
      surat: sRow ? { nomorSurat: sRow.nomorSurat, tanggalSurat: sRow.tanggalSurat, pathFile: sRow.pathFile } : null,
    };
  });

  const total = kgbList.length;
  const selesai = kgbList.filter((k) => k.status === "selesai").length;
  const sedangDiproses = kgbList.filter((k) => k.status === "sedang_diproses" || k.status === "menunggu_keuangan").length;
  const belumDiproses = kgbList.filter((k) => k.status === "belum_diproses").length;
  const ditolak = kgbList.filter((k) => k.status === "ditolak").length;
  const todayDate = new Date();
  const todayNorm = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const rapelan = kgbList.filter((k) => {
    if (k.status === "selesai" || k.status === "ditolak" || k.status === "menunggu_keuangan") return false;
    const tmt = new Date(k.tmtKgbBaru as Date);
    const deadline = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
    return todayNorm > deadline;
  }).length;

  const perGolongan: Record<string, number> = {};
  kgbList.forEach((k) => {
    perGolongan[k.golonganBaru] = (perGolongan[k.golonganBaru] || 0) + 1;
  });

  const perUnitKerja: Record<string, number> = {};
  kgbList.forEach((k) => {
    const unit = k.pegawai?.unitKerja ?? "-";
    perUnitKerja[unit] = (perUnitKerja[unit] || 0) + 1;
  });

  return NextResponse.json({
    stats: { total, selesai, sedangDiproses, belumDiproses, ditolak, rapelan },
    perGolongan,
    perUnitKerja,
    kgbList,
  });
}
