import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";

export const runtime = "nodejs";

const AWALAN_BATAL = "DITOLAK: ";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const p = await sheets.pegawai.findUnique({ id });
  if (!p)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const pegawai = {
    id: p.id, nip: p.nip, nama: p.nama, jabatan: p.jabatan, pangkat: p.pangkat,
    golonganRuang: p.golonganRuang, unitKerja: p.unitKerja, gajiPokok: p.gajiPokok,
    mkgTahun: p.mkgTahun, mkgBulan: p.mkgBulan, tmtKgbBerikutnya: p.tmtKgbBerikutnya,
  };

  const [riwayatRaw, suratList, serahTerimaList] = await Promise.all([
    sheets.riwayatKGB.findMany({ where: { pegawaiId: id }, orderBy: { field: "tmtKgbBaru", dir: "desc" } }),
    sheets.suratKGB.findMany() as Promise<any[]>,
    sheets.serahTerima.findMany() as Promise<{ kgbId: string; keterangan: string | null }[]>,
  ]);
  const suratByKgb = new Map(suratList.map((sRow) => [sRow.kgbId, sRow]));
  // Alasan pembatalan dicatat di SerahTerima dengan awalan "DITOLAK: ".
  const alasanBatalByKgb = new Map(
    serahTerimaList
      .filter((st) => st.keterangan?.startsWith(AWALAN_BATAL))
      .map((st) => [st.kgbId, (st.keterangan ?? "").slice(AWALAN_BATAL.length)] as const),
  );

  const riwayat = riwayatRaw.map((k) => {
    const sRow = suratByKgb.get(k.id);
    return {
      ...k,
      surat: sRow ? { nomorSurat: sRow.nomorSurat, pathFile: sRow.pathFile } : null,
      alasanBatal: k.status === "ditolak" ? alasanBatalByKgb.get(k.id) ?? null : null,
    };
  });

  return NextResponse.json({ pegawai, riwayat });
}
