import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { type RiwayatKGBRow } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { penetapDariSurat } from "@/lib/penetapSk";
import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { suratSudahDibuat, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import {
  entriRekapKgb,
  hitungRekapStatus,
  isoTanggalKalender,
  pilihKgbSiklus,
  rapelanSiklus,
  satuPerSiklus,
  tahunTmt,
} from "@/lib/rekapKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

type KgbDenganSurat = RiwayatKGBRow & { surat: SuratKgbTersimpan | null };

export async function GET() {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role ?? "";
  const bolehLihatFollowup = canProcessKGB(role);

  try {
    // Semua batas tanggal memakai tanggal kalender WITA.
    const hariIni = hariIniWita();
    const tahun = hariIni.getFullYear();
    const bulan = hariIni.getMonth();
    const tahunAwal = new Date(tahun, 0, 1);
    const tahunAkhir = new Date(tahun + 1, 0, 1);
    const awalBulanDepan = new Date(tahun, bulan + 1, 1);
    const bulan3Lalu = new Date(tahun, bulan - 3, 1);
    const bulan3Depan = new Date(tahun, bulan + 4, 1);
    // Pipeline memuat TMT tahun ini dan TMT yang masa inputnya sudah dibuka (sebelum awal bulan ke-3 dari sekarang).
    const batasPipeline = new Date(Math.max(tahunAkhir.getTime(), new Date(tahun, bulan + 3, 1).getTime()));

    const [allPegawai, allKgb, allSurat, followupRows] = await Promise.all([
      db.pegawai.findMany(),
      db.riwayatKGB.findMany(),
      db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
      bolehLihatFollowup
        ? db.notifikasi.findMany({ where: { tipe: "followup_keuangan", dibaca: false } })
        : Promise.resolve([]),
    ]);

    const pegawaiAktif = allPegawai.filter((p) => p.aktif).map((p) => penandaHukdisBerlaku(p, hariIni));
    const suratByKgbId = new Map(allSurat.map((s) => [s.kgbId, s]));
    const kgbByPegawai = new Map<string, KgbDenganSurat[]>();
    for (const k of allKgb) {
      const arr = kgbByPegawai.get(k.pegawaiId) ?? [];
      arr.push({ ...k, surat: suratByKgbId.get(k.id) ?? null });
      kgbByPegawai.set(k.pegawaiId, arr);
    }
    const kgbsFor = (pid: string) => kgbByPegawai.get(pid) ?? [];

    const dalam = (d: Date | null, lo: Date, hi: Date) => !!d && d >= lo && d < hi;

    // Pipeline: satu kartu per pegawai untuk siklus KGB berjalan (lihat pilihKgbSiklus).
    const pegawaiJatuhTempo = pegawaiAktif
      .filter((p) => {
        const tmt = tanggalKalender(p.tmtKgbBerikutnya);
        if (tmt && tmt < batasPipeline) return true;
        return kgbsFor(p.id).some(
          (k) =>
            !k.isArsip &&
            (k.status === "sedang_diproses" ||
              k.status === "menunggu_keuangan" ||
              ((k.status === "selesai" || k.status === "ditolak") && dalam(tanggalKalender(k.tmtKgbBaru), tahunAwal, tahunAkhir))),
        );
      })
      .map((p) => {
        const { kgbBerjalan, selesaiSebelumnya } = pilihKgbSiklus({
          tmtKgbBerikutnya: p.tmtKgbBerikutnya,
          kgb: kgbsFor(p.id),
          hariIni,
          tahun,
        });
        const effectiveTmt = tanggalKalender(kgbBerjalan?.tmtKgbBaru) ?? tanggalKalender(p.tmtKgbBerikutnya);
        return { p, kgbBerjalan, selesaiSebelumnya, effectiveTmt };
      })
      .filter((x): x is typeof x & { effectiveTmt: Date } => x.effectiveTmt !== null)
      .sort((a, b) => a.effectiveTmt.getTime() - b.effectiveTmt.getTime());

    // Hitungan memakai definisi bersama lib/rekapKgb.ts.
    const siklusSemua = satuPerSiklus(entriRekapKgb(allKgb, allPegawai));
    const siklusTahunIni = siklusSemua.filter((k) => tahunTmt(k) === tahun);
    const rekapTahunIni = hitungRekapStatus(siklusTahunIni, hariIni);
    const rekapSemua = hitungRekapStatus(siklusSemua, hariIni);

    const followupNotifs = followupRows
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 10)
      .map((n) => ({ id: n.id, pesan: n.pesan, createdAt: n.createdAt ? n.createdAt.toISOString() : "" }));

    // Tren bulanan (-3 s.d. +3 bulan) menurut bulan TMT.
    const kunciTren = (d: Date) => d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    const trenMap: Record<string, { selesai: number; diproses: number; terlambat: number; mendatang: number; isFuture: boolean }> = {};
    for (let i = -3; i <= 3; i++) {
      trenMap[kunciTren(new Date(tahun, bulan + i, 1))] = { selesai: 0, diproses: 0, terlambat: 0, mendatang: 0, isFuture: i > 0 };
    }
    for (const k of siklusSemua) {
      const tmt = tanggalKalender(k.tmtKgbBaru);
      if (!tmt || !dalam(tmt, bulan3Lalu, awalBulanDepan)) continue;
      const tren = trenMap[kunciTren(tmt)];
      if (!tren) continue;
      if (k.status === "selesai") tren.selesai++;
      else if (k.status === "sedang_diproses" || k.status === "menunggu_keuangan") tren.diproses++;
      if (rapelanSiklus(k, hariIni).rapelan) tren.terlambat++;
    }
    for (const p of pegawaiAktif) {
      const tmt = tanggalKalender(p.tmtKgbBerikutnya);
      if (!tmt || !dalam(tmt, awalBulanDepan, bulan3Depan)) continue;
      const tren = trenMap[kunciTren(tmt)];
      if (tren) tren.mendatang++;
    }
    const trenBulanan = Object.entries(trenMap).map(([bulanLabel, val]) => ({ bulan: bulanLabel, ...val }));

    const result = pegawaiJatuhTempo.map(({ p, kgbBerjalan: k, selesaiSebelumnya: prev, effectiveTmt }) => {
      const statusKGB = k?.status ?? null;
      const jendela = jendelaProsesKgb(effectiveTmt, hariIni)!;
      const { rapelan, terlambat } = rapelanSiklus(
        {
          status: statusKGB ?? "belum_diproses",
          tmtKgbBaru: effectiveTmt,
          flagRapelan: k?.flagRapelan,
          rapelanDitetapkan: k?.rapelanDitetapkan,
        },
        hariIni,
      );
      const nomorPrev = prev?.surat?.nomorSurat;
      const adaNomorPrev = !!nomorPrev && nomorPrev !== "-";

      return {
        id: p.id,
        nama: p.nama,
        nip: p.nip,
        jabatan: p.jabatan,
        golonganRuang: p.golonganRuang,
        tmtKgbBerikutnya: isoTanggalKalender(effectiveTmt),
        deadlineSDM: isoTanggalKalender(jendela.deadlineSDM),
        statusHukdis: p.statusHukdis,
        tanggalHukdisBerakhir: isoTanggalKalender(p.tanggalHukdisBerakhir),
        flagRapelan: rapelan === "berpotensi",
        terlambat,
        isLocked: statusKGB === null && jendela.isLocked,
        statusKGB,
        kgbId: k?.id || null,
        nomorSK: k?.nomorSK ?? null,
        penetapSkDasar: k?.penetapSkDasar ?? null,
        // Syarat yang sama dengan POST /api/kgb/[id]/upload-sk: Unggah SK TTE hanya setelah Buat SK.
        skSudahDibuat: suratSudahDibuat(k?.surat),
        suratNomorSurat: k?.surat?.nomorSurat ?? null,
        suratTanggalSurat: isoTanggalKalender(k?.surat?.tanggalSurat),
        tanggalSK: isoTanggalKalender(k?.tanggalSK),
        tmtSK: isoTanggalKalender(k?.tmtSK),
        gajiPokokLama: k?.gajiPokokLama ?? null,
        gajiPokokBaru: k?.gajiPokokBaru ?? null,
        mkgTahunBaru: k?.mkgTahunBaru ?? null,
        mkgBulanBaru: k?.mkgBulanBaru ?? null,
        prevNomorSK: adaNomorPrev ? nomorPrev : null,
        prevTanggalSK: adaNomorPrev ? isoTanggalKalender(prev?.surat?.tanggalSurat) : null,
        prevTmtSK: isoTanggalKalender(prev?.tmtKgbBaru),
        // SK dasar KGB berikutnya = surat KGB yang terakhir selesai, jadi penetapnya penandatangan surat itu.
        prevPenetapSkDasar: penetapDariSurat(prev?.surat),
      };
    });

    return NextResponse.json({
      stats: {
        totalPegawai: pegawaiAktif.length,
        totalHukdis: pegawaiAktif.filter((p) => p.statusHukdis).length,
        // KGB dengan TMT tahun ini, satu per pegawai per TMT, termasuk yang belum diinput.
        kgbTahunIni: rekapTahunIni.total,
        belumDiproses: rekapTahunIni.belumDiproses,
        // Sedang diproses ditambah menunggu keuangan; rinciannya di menungguKeuangan.
        sedangDiproses: rekapTahunIni.diproses,
        menungguKeuangan: rekapTahunIni.menungguKeuangan,
        selesai: rekapTahunIni.selesai,
        ditolak: rekapTahunIni.ditolak,
        // KGB dengan TMT tahun ini yang ditetapkan rapelan oleh keuangan.
        rapelanKonfirmasi: rekapTahunIni.rapelanDitetapkan,
        // Seluruh KGB yang belum selesai dan berpotensi rapelan, termasuk tahun sebelumnya.
        rapelanBerisiko: rekapSemua.berpotensiRapelan,
        terlambat: rekapSemua.terlambat,
      },
      // Beranda keuangan hanya memakai statistik; data per pegawai, termasuk hukdis, tidak dikirim.
      pegawaiJatuhTempo: NON_KEUANGAN.includes(role) ? result : [],
      trenBulanan,
      followupNotifs,
    });
  } catch (err) {
    console.error("[dashboard] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
