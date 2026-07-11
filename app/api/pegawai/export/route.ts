import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pegawai = await prisma.pegawai.findMany({
    orderBy: { nama: "asc" },
  });

  const HEADERS = [
    "nip",
    "nama",
    "jabatan",
    "pangkat",
    "golonganRuang",
    "tmtGolongan",
    "mkgTahun",
    "mkgBulan",
    "gajiPokok",
    "tmtKgbTerakhir",
    "tmtKgbBerikutnya",
    "tempatLahir",
    "tanggalLahir",
    "jenisKelamin",
    "pendidikanTerakhir",
    "eselon",
    "statusHukdis",
    "keteranganHukdis",
  ];

  function toDate(val: Date | null): string {
    if (!val) return "";
    return val.toISOString().split("T")[0];
  }

  function esc(val: string | number | boolean | null | undefined): string {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const rows = pegawai.map((p) =>
    [
      `="${p.nip}"`,
      esc(p.nama),
      esc(p.jabatan),
      esc(p.pangkat),
      esc(p.golonganRuang),
      esc(toDate(p.tmtGolongan)),
      esc(p.mkgTahun),
      esc(p.mkgBulan),
      esc(p.gajiPokok),
      esc(toDate(p.tmtKgbTerakhir)),
      esc(toDate(p.tmtKgbBerikutnya)),
      esc(p.tempatLahir),
      esc(toDate(p.tanggalLahir)),
      esc(p.jenisKelamin),
      esc(p.pendidikanTerakhir),
      esc(p.eselon),
      esc(p.statusHukdis),
      esc(p.keteranganHukdis),
    ].join(",")
  );

  const csv = [HEADERS.join(","), ...rows].join("\n");
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="pegawai_${date}.csv"`,
    },
  });
}
