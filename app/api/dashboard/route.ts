import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { type RiwayatKGBRow } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { penetapDariSurat } from "@/lib/penetapSk";

export const runtime = "nodejs";

type Surat = {
  id: string; nomorSurat: string; tanggalSurat: Date | null;
  jenisPenandatangan: string | null; jabatanPenandatangan: string | null;
};

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const awalBulanIni = new Date(today.getFullYear(), today.getMonth(), 1);
    const awalBulanDepan = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const bulanIniAkhir = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const rapelanCutoff = new Date(today.getFullYear(), today.getMonth() + 2, 1);
    const tahunBerjalan = today.getFullYear();
    const tahunAwal = new Date(`${tahunBerjalan}-01-01`);
    const tahunAkhir = new Date(`${tahunBerjalan + 1}-01-01`);
    const bulan3Lalu = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    bulan3Lalu.setHours(0, 0, 0, 0);
    const bulan3Depan = new Date(today.getFullYear(), today.getMonth() + 4, 1);

    // Sekali tarik seluruh tab yang dibutuhkan (pengganti banyak query paralel).
    const [allPegawai, allKgb, allSurat, allAudit, allNotif, users] = await Promise.all([
      db.pegawai.findMany(),
      db.riwayatKGB.findMany(),
      db.suratKGB.findMany(),
      db.auditLog.findMany({ orderBy: { field: "waktu", dir: "desc" } }),
      db.notifikasi.findMany(),
      db.user.findMany(),
    ]);

    const pegawaiAktif = allPegawai.filter((p) => p.aktif);
    const kgbByPegawai = new Map<string, RiwayatKGBRow[]>();
    for (const k of allKgb) {
      const arr = kgbByPegawai.get(k.pegawaiId) ?? [];
      arr.push(k);
      kgbByPegawai.set(k.pegawaiId, arr);
    }
    const kgbsFor = (pid: string) => kgbByPegawai.get(pid) ?? [];
    const suratByKgbId = new Map<string, Surat>();
    for (const sRow of allSurat as any[]) {
      suratByKgbId.set(sRow.kgbId, {
        id: sRow.id, nomorSurat: sRow.nomorSurat, tanggalSurat: sRow.tanggalSurat,
        jenisPenandatangan: sRow.jenisPenandatangan ?? null, jabatanPenandatangan: sRow.jabatanPenandatangan ?? null,
      });
    }
    const namaById = new Map(users.map((u) => [u.id, u.nama]));

    // Helper perbandingan tanggal (null → false).
    const inRange = (d: Date | null, lo: Date, hi: Date) => !!d && d >= lo && d < hi;
    const lt = (d: Date | null, x: Date) => !!d && d < x;
    const gte = (d: Date | null, x: Date) => !!d && d >= x;
    const lte = (d: Date | null, x: Date) => !!d && d <= x;
    const proc = ["sedang_diproses", "menunggu_keuangan"];

    // Pegawai jatuh tempo (gabungan beberapa kondisi OR).
    const pegawaiJatuhTempo = pegawaiAktif
      .filter((p) => {
        const ks = kgbsFor(p.id);
        const cA = lt(p.tmtKgbBerikutnya, rapelanCutoff) && !ks.some((k) => k.status === "selesai");
        const cB = gte(p.tmtKgbBerikutnya, rapelanCutoff) && lt(p.tmtKgbBerikutnya, tahunAkhir);
        const cC = ks.some((k) => k.status === "selesai" && inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir) && !k.isArsip);
        const cD = ks.some((k) => proc.includes(k.status) && inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir) && !k.isArsip);
        const cE = ks.some((k) => k.status === "ditolak" && inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir) && !k.isArsip);
        return cA || cB || cC || cD || cE;
      })
      .sort((a, b) => (a.tmtKgbBerikutnya?.getTime() ?? 0) - (b.tmtKgbBerikutnya?.getTime() ?? 0));

    // riwayatKGB per pegawai: non-belum_diproses, terbaru dulu, ambil 2, +surat.
    const riwayatFor = (pid: string) =>
      kgbsFor(pid)
        .filter((k) => k.status !== "belum_diproses")
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        .slice(0, 2)
        .map((k) => ({ ...k, surat: suratByKgbId.get(k.id) ?? null }));

    const totalPegawai = pegawaiAktif.length;
    const totalHukdis = pegawaiAktif.filter((p) => p.statusHukdis).length;
    const totalKGB = allKgb.filter((k) => !k.isArsip).length;

    const sedangDiproses = pegawaiAktif.filter((p) => {
      const ks = kgbsFor(p.id);
      return (
        ks.some((k) => proc.includes(k.status) && !k.isArsip && inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir)) &&
        !ks.some((k) => k.status === "selesai" && !k.isArsip)
      );
    }).length;

    const selesai = allKgb.filter(
      (k) => !k.isArsip && k.status === "selesai" && inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir),
    ).length;

    const ditolak = pegawaiAktif.filter((p) => {
      const ks = kgbsFor(p.id);
      return (
        ks.some((k) => k.status === "ditolak" && !k.isArsip && inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir)) &&
        !ks.some((k) => ["selesai", ...proc].includes(k.status) && !k.isArsip)
      );
    }).length;

    const rapelanKonfirmasi = allKgb.filter((k) => !k.isArsip && k.rapelanDitetapkan === true).length;
    const rapelanBerisiko = allKgb.filter(
      (k) => !k.isArsip && k.flagRapelan && !["selesai", "ditolak"].includes(k.status),
    ).length;

    const belumDiprosesTotal = pegawaiAktif.filter((p) => {
      const ks = kgbsFor(p.id);
      return (
        inRange(p.tmtKgbBerikutnya, tahunAwal, tahunAkhir) &&
        !ks.some((k) => ["selesai", "ditolak", ...proc].includes(k.status) && !k.isArsip)
      );
    }).length;

    const kgbBulanIni = pegawaiAktif.filter(
      (p) => gte(p.tmtKgbBerikutnya, awalBulanIni) && lte(p.tmtKgbBerikutnya, bulanIniAkhir),
    ).length;

    const kgbUntukTren = allKgb.filter(
      (k) => gte(k.tmtKgbBaru, bulan3Lalu) && lt(k.tmtKgbBaru, awalBulanDepan) && !k.isArsip,
    );

    const pegawaiMendatang = pegawaiAktif.filter(
      (p) => gte(p.tmtKgbBerikutnya, awalBulanDepan) && lt(p.tmtKgbBerikutnya, bulan3Depan),
    );

    const activityLog = allAudit.slice(0, 10).map((a) => ({
      id: a.id,
      waktu: a.waktu ? a.waktu.toISOString() : "",
      user: (a.userId ? namaById.get(a.userId) : null) ?? "Sistem",
      aksi: a.aksi,
      detail: a.detail,
    }));

    // Kalender: KGB dengan tmtKgbBaru tahun ini (non-arsip).
    const kgbInYearRaw = allKgb
      .filter((k) => !k.isArsip && inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir))
      .map((k) => ({ pegawaiId: k.pegawaiId, tmtKgbBaru: k.tmtKgbBaru as Date, status: k.status }));

    // Kalender virtual: pegawai dengan tmtKgbBerikutnya tahun ini tapi belum ada riwayat tahun ini.
    const kgbVirtualRaw = pegawaiAktif
      .filter(
        (p) =>
          inRange(p.tmtKgbBerikutnya, tahunAwal, tahunAkhir) &&
          !kgbsFor(p.id).some((k) => inRange(k.tmtKgbBaru, tahunAwal, tahunAkhir) && !k.isArsip),
      )
      .map((p) => ({ id: p.id, tmtKgbBerikutnya: p.tmtKgbBerikutnya as Date }));

    const kgbPerPegawai = new Map<string, { pegawaiId: string; tmtKgbBaru: Date; status: string }>();
    for (const k of kgbInYearRaw) {
      if (!kgbPerPegawai.has(k.pegawaiId)) kgbPerPegawai.set(k.pegawaiId, k);
    }
    const kgbInYearDeduped = [...kgbPerPegawai.values()];

    const kalenderKombinasi = [
      ...kgbInYearDeduped.map((k) => ({ id: k.pegawaiId, tmtKgbBerikutnya: k.tmtKgbBaru.toISOString() })),
      ...kgbVirtualRaw.map((p) => ({ id: p.id, tmtKgbBerikutnya: p.tmtKgbBerikutnya.toISOString() })),
    ];
    const kalenderSelesai = kgbInYearRaw
      .filter((k) => k.status === "selesai")
      .map((k) => ({ tmtKgbBerikutnya: k.tmtKgbBaru.toISOString() }));
    const kgbTahunIniTotal = kalenderKombinasi.length;

    // Distribusi golongan (groupBy golonganRuang).
    const golonganMap = new Map<string, number>();
    for (const p of pegawaiAktif) golonganMap.set(p.golonganRuang, (golonganMap.get(p.golonganRuang) ?? 0) + 1);
    const golonganDistribusi = [...golonganMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([golongan, count]) => ({ golongan, count }));

    const followupNotifs = allNotif
      .filter((n) => n.tipe === "followup_keuangan" && !n.dibaca)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 10)
      .map((n) => ({ id: n.id, pesan: n.pesan, createdAt: n.createdAt ? n.createdAt.toISOString() : "" }));

    // Tren bulanan (-3 s.d. +3 bulan).
    const trenMap: Record<string, { selesai: number; diproses: number; terlambat: number; mendatang: number; isFuture: boolean }> = {};
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      trenMap[key] = { selesai: 0, diproses: 0, terlambat: 0, mendatang: 0, isFuture: i > 0 };
    }
    for (const k of kgbUntukTren) {
      const key = new Date(k.tmtKgbBaru as Date).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      if (!trenMap[key]) continue;
      if (k.status === "selesai") trenMap[key].selesai++;
      else if (proc.includes(k.status)) trenMap[key].diproses++;
      if (k.flagRapelan) trenMap[key].terlambat++;
    }
    for (const p of pegawaiMendatang) {
      const key = new Date(p.tmtKgbBerikutnya as Date).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      if (!trenMap[key]) continue;
      trenMap[key].mendatang++;
    }
    const trenBulanan = Object.entries(trenMap).map(([bulan, val]) => ({ bulan, ...val }));

    const result = pegawaiJatuhTempo.map((p) => {
      const riwayatKGB = riwayatFor(p.id);
      const kgbTerakhir = riwayatKGB.find((k) => !k.isArsip) || null;
      const prevSelesai = riwayatKGB.find((k) => k.status === "selesai") || null;
      const statusKGB = kgbTerakhir?.status || null;

      const effectiveTmt = kgbTerakhir?.tmtKgbBaru
        ? new Date(kgbTerakhir.tmtKgbBaru)
        : new Date(p.tmtKgbBerikutnya as Date);

      const deadlineSDM = new Date(effectiveTmt.getFullYear(), effectiveTmt.getMonth() - 1, 0);
      const inProgress = statusKGB !== "selesai" && statusKGB !== "menunggu_keuangan";
      const flagRapelan = inProgress && todayDate > deadlineSDM;
      const terlambat = inProgress && todayDate > deadlineSDM;

      const unlockDate = new Date(effectiveTmt.getFullYear(), effectiveTmt.getMonth() - 2, 1);
      const isLocked = statusKGB === null && today < unlockDate;

      return {
        id: p.id,
        nama: p.nama,
        nip: p.nip,
        jabatan: p.jabatan,
        golonganRuang: p.golonganRuang,
        unitKerja: p.unitKerja,
        tmtKgbBerikutnya: effectiveTmt,
        deadlineSDM: deadlineSDM.toISOString(),
        statusHukdis: p.statusHukdis,
        tanggalHukdisBerakhir: p.tanggalHukdisBerakhir?.toISOString() ?? null,
        jenisHukdis: p.jenisHukdis ?? null,
        flagRapelan,
        terlambat,
        isLocked,
        unlockDate: unlockDate.toISOString(),
        statusKGB,
        kgbId: kgbTerakhir?.id || null,
        nomorSK: kgbTerakhir?.nomorSK ?? null,
        penetapSkDasar: kgbTerakhir?.penetapSkDasar ?? null,
        sudahGenerateSurat: !!kgbTerakhir?.surat,
        suratNomorSurat: kgbTerakhir?.surat?.nomorSurat ?? null,
        tanggalSK: kgbTerakhir?.tanggalSK?.toISOString() ?? null,
        tmtSK: kgbTerakhir?.tmtSK?.toISOString() ?? null,
        gajiPokokLama: kgbTerakhir?.gajiPokokLama ?? null,
        gajiPokokBaru: kgbTerakhir?.gajiPokokBaru ?? null,
        mkgTahunBaru: kgbTerakhir?.mkgTahunBaru ?? null,
        mkgBulanBaru: kgbTerakhir?.mkgBulanBaru ?? null,
        gajiPokok: p.gajiPokok,
        mkgTahun: p.mkgTahun,
        mkgBulan: p.mkgBulan,
        prevNomorSK: (() => { const n = prevSelesai?.surat?.nomorSurat; return n && n !== "-" ? n : null; })(),
        prevTanggalSK: (() => { const s = prevSelesai?.surat; return s?.nomorSurat && s.nomorSurat !== "-" ? s.tanggalSurat?.toISOString() ?? null : null; })(),
        prevTmtSK: prevSelesai?.tmtKgbBaru?.toISOString() ?? null,
        // SK dasar KGB berikutnya = surat KGB yang terakhir selesai, jadi penetapnya penandatangan surat itu.
        prevPenetapSkDasar: penetapDariSurat(prevSelesai?.surat),
      };
    });

    return NextResponse.json({
      stats: {
        totalPegawai,
        totalHukdis,
        totalKGB,
        kgbTahunIni: kgbTahunIniTotal,
        belumDiproses: belumDiprosesTotal,
        sedangDiproses,
        selesai,
        ditolak,
        rapelanKonfirmasi,
        rapelanBerisiko,
        kgbBulanIni,
      },
      pegawaiJatuhTempo: result,
      pegawaiKalender: kalenderKombinasi,
      selesaiKalender: kalenderSelesai,
      activityLog,
      trenBulanan,
      golonganDistribusi,
      followupNotifs,
    });
  } catch (err) {
    console.error("[dashboard] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
