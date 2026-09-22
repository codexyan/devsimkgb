import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";
import { hitungRekapStatus, satuPerSiklus, tanpaBatalYangDiganti, tanpaEntriPegawaiNonaktif } from "@/lib/rekapKgb";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

// Laporan KGB per tahun TMT (opsional bulan dan status). Hitungan memakai definisi bersama
// lib/rekapKgb.ts; daftar tetap memuat entri yang dibatalkan dan belum diganti. Pembatalan yang sudah
// diganti dibuang dari data lengkap sebelum periode disaring, karena penggantinya bisa di periode lain.
export async function GET(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const hariIni = hariIniWita();
  const teksTahun = (searchParams.get("tahun") || "").trim();
  const tahun = /^\d{4}$/.test(teksTahun) ? Number(teksTahun) : hariIni.getFullYear();
  const teksBulan = (searchParams.get("bulan") || "").trim();
  const bulan = /^\d{1,2}$/.test(teksBulan) && Number(teksBulan) >= 1 && Number(teksBulan) <= 12 ? Number(teksBulan) : 0;
  const status = searchParams.get("status") || "";

  const [allKgb, pegawaiList, suratList] = await Promise.all([
    db.riwayatKGB.findMany(),
    db.pegawai.findMany(),
    db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
  ]);
  const pegawaiById = new Map(pegawaiList.map((p) => [p.id, p]));
  const suratByKgbId = new Map(suratList.map((sRow) => [sRow.kgbId, sRow]));

  const dalamPeriode = tanpaBatalYangDiganti(tanpaEntriPegawaiNonaktif(allKgb, pegawaiList))
    .map((k) => ({ k, tmt: tanggalKalender(k.tmtKgbBaru) }))
    .filter(({ k, tmt }) => !k.isArsip && !!tmt && tmt.getFullYear() === tahun && (!bulan || tmt.getMonth() + 1 === bulan))
    .sort((a, b) => a.tmt!.getTime() - b.tmt!.getTime())
    .map(({ k }) => k);

  const kgbList = dalamPeriode
    .filter((k) => (status ? k.status === status : true))
    .map((k) => {
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

  // Entri ganda per TMT dibuang sebelum filter status, agar KGB yang dibatalkan lalu diinput ulang
  // tidak terhitung sebagai Dibatalkan.
  const siklus = satuPerSiklus(dalamPeriode).filter((k) => (status ? k.status === status : true));
  const rekap = hitungRekapStatus(siklus, hariIni);

  const perGolongan: Record<string, number> = {};
  const perUnitKerja: Record<string, number> = {};
  for (const k of siklus) {
    perGolongan[k.golonganBaru] = (perGolongan[k.golonganBaru] || 0) + 1;
    const unit = pegawaiById.get(k.pegawaiId)?.unitKerja ?? "-";
    perUnitKerja[unit] = (perUnitKerja[unit] || 0) + 1;
  }

  return NextResponse.json({
    stats: {
      total: rekap.total,
      selesai: rekap.selesai,
      menungguKeuangan: rekap.menungguKeuangan,
      sedangDiproses: rekap.sedangDiproses,
      belumDiproses: rekap.belumDiproses,
      ditolak: rekap.ditolak,
      rapelanDitetapkan: rekap.rapelanDitetapkan,
      berpotensiRapelan: rekap.berpotensiRapelan,
    },
    perGolongan,
    perUnitKerja,
    kgbList,
  });
}
