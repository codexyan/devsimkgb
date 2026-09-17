import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { suratSudahDibuat, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import { hariIniWita } from "@/lib/waktu";

export const runtime = "nodejs";

const AWALAN_BATAL = "DITOLAK: ";

type SerahTerimaRingkas = { kgbId: string; keterangan: string | null };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Riwayat per pegawai (termasuk status hukdis) tidak dipakai halaman keuangan.
  if (!NON_KEUANGAN.includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;

  const p = await db.pegawai.findUnique({ id });
  if (!p)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  // Hukdis yang sudah lewat tanggal berakhirnya dibaca tidak aktif.
  const hukdis = penandaHukdisBerlaku(p, hariIniWita());
  const pegawai = {
    id: p.id, nip: p.nip, nama: p.nama, jabatan: p.jabatan, pangkat: p.pangkat,
    golonganRuang: p.golonganRuang, gajiPokok: p.gajiPokok,
    mkgTahun: p.mkgTahun, mkgBulan: p.mkgBulan, tmtKgbBerikutnya: p.tmtKgbBerikutnya,
    statusHukdis: hukdis.statusHukdis,
  };

  const riwayatRaw = await db.riwayatKGB.findMany({
    where: { pegawaiId: id },
    orderBy: { field: "tmtKgbBaru", dir: "desc" },
  });
  const kgbIds = riwayatRaw.map((k) => k.id);

  const [suratList, serahTerimaList] = kgbIds.length === 0
    ? [[], []]
    : await Promise.all([
        db.suratKGB.findMany({ where: { kgbId: { in: kgbIds } } }) as unknown as Promise<SuratKgbTersimpan[]>,
        db.serahTerima.findMany({ where: { kgbId: { in: kgbIds } } }) as unknown as Promise<SerahTerimaRingkas[]>,
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
      surat: sRow ? { nomorSurat: sRow.nomorSurat, tanggalSurat: sRow.tanggalSurat, pathFile: sRow.pathFile } : null,
      // Syarat yang sama dengan POST /api/kgb/[id]/upload-sk: Unggah SK TTE hanya setelah Buat SK.
      skSudahDibuat: suratSudahDibuat(sRow),
      alasanBatal: k.status === "ditolak" ? alasanBatalByKgb.get(k.id) ?? null : null,
    };
  });

  return NextResponse.json({ pegawai, riwayat });
}
