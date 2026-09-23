import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { isoTanggalKalender, pilihKgbSiklus, rapelanSiklus } from "@/lib/rekapKgb";
import { kodeSatkerPegawai, rekapPerSatker } from "@/lib/rekapSatker";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { muatKppnSatker } from "@/lib/muatKppnSatker";

export const runtime = "nodejs";

// Satu satker: ringkasan KGB dan daftar pegawai aktifnya dengan status siklus KGB berjalan.
export async function GET(_req: Request, { params }: { params: Promise<{ kode: string }> }) {
  await muatBatasInputSdm();
  await muatKppnSatker();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { kode } = await params;
  const hariIni = hariIniWita();
  const [semuaPegawai, kgb] = await Promise.all([db.pegawai.findMany(), db.riwayatKGB.findMany()]);
  const pegawai = semuaPegawai.map((p) => penandaHukdisBerlaku(p, hariIni));
  const ringkasan = rekapPerSatker({ pegawai, kgb, hariIni, bulanKeDepan: 6 }).satker.find((r) => r.satker.kode === kode);
  if (!ringkasan)
    return NextResponse.json({ error: "Satker tidak ditemukan" }, { status: 404 });

  const kgbPegawai = new Map<string, typeof kgb>();
  for (const k of kgb) kgbPegawai.set(k.pegawaiId, [...(kgbPegawai.get(k.pegawaiId) ?? []), k]);

  const daftar = pegawai
    .filter((p) => p.aktif && kodeSatkerPegawai(p.unitKerja) === kode)
    .map((p) => {
      const { kgbBerjalan } = pilihKgbSiklus({
        tmtKgbBerikutnya: p.tmtKgbBerikutnya,
        kgb: kgbPegawai.get(p.id) ?? [],
        hariIni,
        tahun: hariIni.getFullYear(),
      });
      const tmt = tanggalKalender(kgbBerjalan?.tmtKgbBaru) ?? tanggalKalender(p.tmtKgbBerikutnya);
      const jendela = tmt ? jendelaProsesKgb(tmt, hariIni) : null;
      const status = kgbBerjalan?.status ?? null;
      const { rapelan, terlambat } = tmt
        ? rapelanSiklus(
            {
              status: status ?? "belum_diproses",
              tmtKgbBaru: tmt,
              flagRapelan: kgbBerjalan?.flagRapelan,
              rapelanDitetapkan: kgbBerjalan?.rapelanDitetapkan,
            },
            hariIni,
          )
        : { rapelan: null, terlambat: false };
      return {
        id: p.id,
        nama: p.nama,
        nip: p.nip,
        jabatan: p.jabatan,
        golonganRuang: p.golonganRuang,
        tmtKgb: isoTanggalKalender(tmt),
        deadlineSDM: isoTanggalKalender(jendela?.deadlineSDM ?? null),
        terkunci: status === null && !!jendela?.isLocked,
        statusKGB: status,
        kgbId: kgbBerjalan?.id ?? null,
        terlambat,
        rapelan,
        statusHukdis: p.statusHukdis,
      };
    })
    .sort((a, b) => (a.tmtKgb ?? "9999").localeCompare(b.tmtKgb ?? "9999") || a.nama.localeCompare(b.nama));

  return NextResponse.json({ ringkasan, pegawai: daftar });
}
