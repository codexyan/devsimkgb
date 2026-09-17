import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canEditPegawai, canManageHukdis } from "@/lib/auth";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { hariIniWita, isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";

export const runtime = "nodejs";

// Nama kolom sama dengan kolom import, sehingga hasil export dapat diimport kembali.
const HEADERS = [
  "nip", "nama", "jabatan", "pangkat", "golonganRuang", "unitKerja", "tmtGolongan", "mkgTahun", "mkgBulan",
  "gajiPokok", "tmtKgbTerakhir", "tmtKgbBerikutnya", "tempatLahir", "tanggalLahir",
  "jenisKelamin", "pendidikanTerakhir", "eselon", "statusHukdis", "keteranganHukdis",
];

/** yyyy-mm-dd menurut tanggal kalender WITA; toISOString akan mundur sehari untuk tengah malam WITA. */
function keTanggal(val: NilaiTanggal): string {
  const tanggal = tanggalKalender(val);
  return tanggal ? isoTanggalLokal(tanggal) : "";
}

function esc(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Tombol "Export" hanya tampil untuk peran yang boleh mengelola data pegawai.
  const role = session.user.role!;
  if (!canEditPegawai(role))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  // Keterangan hukdis disembunyikan seperti pada GET /api/pegawai.
  const bolehLihatHukdis = canManageHukdis(role);

  const hariIni = hariIniWita();
  const pegawai = (await db.pegawai.findMany({ orderBy: { field: "nama", dir: "asc" } })).map((p) =>
    penandaHukdisBerlaku(p, hariIni),
  );

  const rows = pegawai.map((p) =>
    [
      `="${p.nip}"`,
      esc(p.nama),
      esc(p.jabatan),
      esc(p.pangkat),
      esc(p.golonganRuang),
      esc(p.unitKerja),
      esc(keTanggal(p.tmtGolongan)),
      esc(p.mkgTahun),
      esc(p.mkgBulan),
      esc(p.gajiPokok),
      esc(keTanggal(p.tmtKgbTerakhir)),
      esc(keTanggal(p.tmtKgbBerikutnya)),
      esc(p.tempatLahir),
      esc(keTanggal(p.tanggalLahir)),
      esc(p.jenisKelamin),
      esc(p.pendidikanTerakhir),
      esc(p.eselon),
      esc(p.statusHukdis),
      esc(bolehLihatHukdis ? p.keteranganHukdis : null),
    ].join(","),
  );

  const csv = [HEADERS.join(","), ...rows].join("\n");
  const date = isoTanggalLokal(hariIni);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="pegawai_${date}.csv"`,
    },
  });
}
