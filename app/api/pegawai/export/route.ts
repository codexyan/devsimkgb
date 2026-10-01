import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canEditPegawai, canManageHukdis } from "@/lib/auth";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { hariIniWita, isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";
import { KEPALA_BERKAS_CSV, PEMISAH_CSV, selCsv } from "@/lib/csv";

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
      selCsv(p.nama),
      selCsv(p.jabatan),
      selCsv(p.pangkat),
      selCsv(p.golonganRuang),
      selCsv(p.unitKerja),
      selCsv(keTanggal(p.tmtGolongan)),
      selCsv(p.mkgTahun),
      selCsv(p.mkgBulan),
      selCsv(p.gajiPokok),
      selCsv(keTanggal(p.tmtKgbTerakhir)),
      selCsv(keTanggal(p.tmtKgbBerikutnya)),
      selCsv(p.tempatLahir),
      selCsv(keTanggal(p.tanggalLahir)),
      selCsv(p.jenisKelamin),
      selCsv(p.pendidikanTerakhir),
      selCsv(p.eselon),
      selCsv(p.statusHukdis),
      selCsv(bolehLihatHukdis ? p.keteranganHukdis : null),
    ].join(PEMISAH_CSV),
  );

  // Kepala berkas dari lib/csv: BOM agar Excel membaca UTF-8, dan petunjuk `sep=;` agar kolomnya terbagi.
  const csv = KEPALA_BERKAS_CSV + [HEADERS.join(PEMISAH_CSV), ...rows].join("\r\n");
  const date = isoTanggalLokal(hariIni);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="pegawai_${date}.csv"`,
    },
  });
}
