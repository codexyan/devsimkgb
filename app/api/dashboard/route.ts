import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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
  // Deadline SDM = akhir bulan ke-2 sebelum TMT (2 bulan sebelum berlaku, untuk masuk rekon)
  // Rapelan ↔ bulan-sebelum-TMT sudah mulai → TMT < awal bulan+2
  const rapelanCutoff = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  const tahunBerjalan = today.getFullYear();
  const tahunAwal = new Date(`${tahunBerjalan}-01-01`);
  const tahunAkhir = new Date(`${tahunBerjalan + 1}-01-01`);
  const bulan3Lalu = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  bulan3Lalu.setHours(0, 0, 0, 0);
  const bulan3Depan = new Date(today.getFullYear(), today.getMonth() + 4, 1);

  // All DB queries run in parallel, single round-trip to the database
  const [
    pegawaiJatuhTempo,
    totalPegawai,
    totalHukdis,
    totalKGB,
    sedangDiproses,
    selesai,
    ditolak,
    rapelanKonfirmasi,
    rapelanBerisiko,
    belumDiprosesTotal,
    kgbBulanIni,
    _kgbTahunIniRaw,
    kgbUntukTren,
    pegawaiMendatang,
    activityLogRaw,
    pegawaiKalender,
    selesaiKalenderRaw,
    golonganDistribusiRaw,
    followupNotifsRaw,
  ] = await Promise.all([
    // Pegawai yang deadline SDM-nya sudah lewat (rapelan) ATAU deadline dalam 3 bulan ke depan
    // deadline SDM = 1st of (TMT.month - 1)
    // rapelan jika TMT < rapelanCutoff | upcoming jika TMT < bulan4Depan
    prisma.pegawai.findMany({
      where: {
        aktif: true,
        OR: [
          {
            tmtKgbBerikutnya: { lt: rapelanCutoff },
            NOT: { riwayatKGB: { some: { status: "selesai" } } },
          },
          { tmtKgbBerikutnya: { gte: rapelanCutoff, lt: tahunAkhir } },
          // tmtKgbBerikutnya di-bump setelah input, tangkap via tmtKgbBaru per status
          {
            riwayatKGB: {
              some: { status: "selesai", tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir }, isArsip: false },
            },
          },
          {
            riwayatKGB: {
              some: { status: { in: ["sedang_diproses", "menunggu_keuangan"] }, tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir }, isArsip: false },
            },
          },
          {
            riwayatKGB: {
              some: { status: "ditolak", tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir }, isArsip: false },
            },
          },
        ],
      },
      select: {
        id: true,
        nama: true,
        nip: true,
        jabatan: true,
        golonganRuang: true,
        unitKerja: true,
        tmtKgbBerikutnya: true,
        statusHukdis: true,
        tanggalHukdisBerakhir: true,
        jenisHukdis: true,
        gajiPokok: true,
        mkgTahun: true,
        mkgBulan: true,
        riwayatKGB: {
          where: { NOT: { status: "belum_diproses" } },
          orderBy: { createdAt: "desc" },
          take: 2,
          select: {
            id: true,
            isArsip: true,
            status: true,
            flagRapelan: true,
            tmtKgbBaru: true,
            createdAt: true,
            nomorSK: true,
            tanggalSK: true,
            tmtSK: true,
            gajiPokokLama: true,
            gajiPokokBaru: true,
            mkgTahunLama: true,
            mkgBulanLama: true,
            mkgTahunBaru: true,
            mkgBulanBaru: true,
            surat: { select: { id: true, nomorSurat: true, tanggalSurat: true } },
          },
        },
      },
      orderBy: { tmtKgbBerikutnya: "asc" },
    }),
    prisma.pegawai.count({ where: { aktif: true } }),
    prisma.pegawai.count({ where: { aktif: true, statusHukdis: true } }),
    prisma.riwayatKGB.count({ where: { isArsip: false } }),
    // sedangDiproses, scoped ke tahun berjalan via tmtKgbBaru (tidak terpengaruh bump tmtKgbBerikutnya)
    prisma.pegawai.count({
      where: {
        aktif: true,
        riwayatKGB: { some: { status: { in: ["sedang_diproses", "menunggu_keuangan"] }, isArsip: false, tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir } } },
        NOT: { riwayatKGB: { some: { status: "selesai", isArsip: false } } },
      },
    }),
    // selesai, scoped ke tahun berjalan via tmtKgbBaru (tidak terpengaruh perubahan tmtKgbBerikutnya)
    prisma.riwayatKGB.count({
      where: {
        isArsip: false,
        status: "selesai",
        tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir },
      },
    }),
    // ditolak, scoped ke tahun berjalan via tmtKgbBaru
    prisma.pegawai.count({
      where: {
        aktif: true,
        riwayatKGB: { some: { status: "ditolak", isArsip: false, tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir } } },
        NOT: { riwayatKGB: { some: { status: { in: ["selesai", "sedang_diproses", "menunggu_keuangan"] }, isArsip: false } } },
      },
    }),
    // rapelanKonfirmasi = KGB yang sudah dikonfirmasi keuangan sebagai rapelan (rapelanDitetapkan=true)
    prisma.riwayatKGB.count({
      where: { isArsip: false, rapelanDitetapkan: true },
    }),
    // rapelanBerisiko = KGB flagRapelan=true yang belum selesai/ditolak (berisiko tapi belum dikonfirmasi)
    prisma.riwayatKGB.count({
      where: {
        isArsip: false,
        flagRapelan: true,
        status: { notIn: ["selesai", "ditolak"] },
      },
    }),
    // Belum diproses tahun berjalan (tidak ada aktivitas sama sekali, murni belum_diproses)
    prisma.pegawai.count({
      where: {
        aktif: true,
        tmtKgbBerikutnya: { gte: tahunAwal, lt: tahunAkhir },
        NOT: {
          riwayatKGB: {
            some: { status: { in: ["sedang_diproses", "menunggu_keuangan", "selesai", "ditolak"] }, isArsip: false },
          },
        },
      },
    }),
    // KGB bulan ini, pegawai dengan TMT di bulan berjalan
    prisma.pegawai.count({
      where: { aktif: true, tmtKgbBerikutnya: { gte: awalBulanIni, lte: bulanIniAkhir } },
    }),
    // KGB tahun ini, dihitung dari riwayatKGB.tmtKgbBaru (placeholder, akan dioverride setelah Promise.all)
    prisma.riwayatKGB.count({
      where: { isArsip: false, tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir } },
    }),
    // Tren historis: 3 bulan lalu s.d. bulan ini (exclude arsip)
    prisma.riwayatKGB.findMany({
      where: { tmtKgbBaru: { gte: bulan3Lalu, lt: awalBulanDepan }, isArsip: false },
      select: { tmtKgbBaru: true, status: true, flagRapelan: true },
    }),
    // Proyeksi: pegawai yang tmtKgbBerikutnya di 3 bulan mendatang
    prisma.pegawai.findMany({
      where: {
        aktif: true,
        tmtKgbBerikutnya: { gte: awalBulanDepan, lt: bulan3Depan },
      },
      select: { tmtKgbBerikutnya: true },
    }),
    // Activity log, 10 terakhir
    prisma.auditLog.findMany({
      orderBy: { waktu: "desc" },
      take: 10,
      include: { user: { select: { nama: true } } },
    }),
    // Kalender: semua riwayatKGB dengan tmtKgbBaru di tahun berjalan (termasuk selesai)
    prisma.riwayatKGB.findMany({
      where: {
        isArsip: false,
        tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir },
      },
      select: { pegawaiId: true, tmtKgbBaru: true, status: true },
    }),
    // Kalender virtual: pegawai dengan tmtKgbBerikutnya di tahun ini tapi belum punya riwayat
    prisma.pegawai.findMany({
      where: {
        aktif: true,
        tmtKgbBerikutnya: { gte: tahunAwal, lt: tahunAkhir },
        NOT: {
          riwayatKGB: {
            some: { tmtKgbBaru: { gte: tahunAwal, lt: tahunAkhir }, isArsip: false },
          },
        },
      },
      select: { id: true, tmtKgbBerikutnya: true },
    }),
    // Distribusi golongan ruang pegawai aktif
    prisma.pegawai.groupBy({
      by: ["golonganRuang"],
      where: { aktif: true },
      _count: { _all: true },
      orderBy: { golonganRuang: "asc" },
    }),
    // Follow-up notifications dari keuangan (belum dibaca)
    prisma.notifikasi.findMany({
      where: { tipe: "followup_keuangan", dibaca: false },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const activityLog = activityLogRaw.map((a) => ({
    id: a.id,
    waktu: a.waktu.toISOString(),
    user: a.user?.nama ?? "Sistem",
    aksi: a.aksi,
    detail: a.detail,
  }));

  // pegawaiKalender = union of:
  //   1. riwayatKGB.tmtKgbBaru dalam tahun ini (sudah punya record, selesai, sedang, dsb)
  //   2. pegawai virtual (tmtKgbBerikutnya dalam tahun ini, belum punya riwayatKGB)
  // Variable names: pegawaiKalender = kgbInYearRaw, selesaiKalenderRaw = kgbVirtualRaw (reused below)
  const kgbInYearRaw = (pegawaiKalender as unknown) as { pegawaiId: string; tmtKgbBaru: Date; status: string }[];
  const kgbVirtualRaw = (selesaiKalenderRaw as unknown) as { id: string; tmtKgbBerikutnya: Date }[];

  // Deduplicate kgbInYearRaw per pegawaiId (ambil yang pertama, dalam satu tahun max 1 KGB aktif)
  const kgbPerPegawai = new Map<string, { pegawaiId: string; tmtKgbBaru: Date; status: string }>();
  for (const k of kgbInYearRaw) {
    if (!kgbPerPegawai.has(k.pegawaiId)) kgbPerPegawai.set(k.pegawaiId, k);
  }
  const kgbInYearDeduped = [...kgbPerPegawai.values()];

  const kalenderKombinasi = [
    ...kgbInYearDeduped.map(k => ({ id: k.pegawaiId, tmtKgbBerikutnya: k.tmtKgbBaru.toISOString() })),
    ...kgbVirtualRaw.map(p => ({ id: p.id, tmtKgbBerikutnya: p.tmtKgbBerikutnya.toISOString() })),
  ];

  const kalenderSelesai = kgbInYearRaw
    .filter(k => k.status === "selesai")
    .map(k => ({ tmtKgbBerikutnya: k.tmtKgbBaru.toISOString() }));

  const kgbTahunIniTotal = kalenderKombinasi.length;

  // Tren bulanan, 3 bulan lalu + bulan ini + 3 bulan ke depan (7 bulan total)
  const trenMap: Record<string, { selesai: number; diproses: number; terlambat: number; mendatang: number; isFuture: boolean }> = {};
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    trenMap[key] = { selesai: 0, diproses: 0, terlambat: 0, mendatang: 0, isFuture: i > 0 };
  }
  for (const k of kgbUntukTren) {
    const key = new Date(k.tmtKgbBaru).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    if (!trenMap[key]) continue;
    if (k.status === "selesai") trenMap[key].selesai++;
    else if (k.status === "sedang_diproses" || k.status === "menunggu_keuangan") trenMap[key].diproses++;
    if (k.flagRapelan) trenMap[key].terlambat++;
  }
  for (const p of pegawaiMendatang) {
    const key = new Date(p.tmtKgbBerikutnya).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    if (!trenMap[key]) continue;
    trenMap[key].mendatang++;
  }
  const trenBulanan = Object.entries(trenMap).map(([bulan, val]) => ({ bulan, ...val }));

  const result = pegawaiJatuhTempo.map((p) => {
    // kgbTerakhir = most recent active (non-archived) non-belum_diproses KGB
    const kgbTerakhir = p.riwayatKGB.find(k => !k.isArsip) || null;
    // prevSelesai = most recent selesai KGB (any archive state), used for pre-fill
    const prevSelesai = p.riwayatKGB.find(k => k.status === "selesai") || null;
    const statusKGB = kgbTerakhir?.status || null;

    // tmtKgbBerikutnya di-bump setelah input (sedang_diproses) maupun selesai.
    // Gunakan tmtKgbBaru sebagai TMT efektif agar kalender & filter akurat.
    const effectiveTmt = kgbTerakhir?.tmtKgbBaru
      ? new Date(kgbTerakhir.tmtKgbBaru)
      : new Date(p.tmtKgbBerikutnya);

    const deadlineSDM = new Date(effectiveTmt.getFullYear(), effectiveTmt.getMonth() - 1, 0);
    const inProgress = statusKGB !== "selesai" && statusKGB !== "menunggu_keuangan";
    const flagRapelan = inProgress && todayDate > deadlineSDM;
    const terlambat = inProgress && todayDate > deadlineSDM;

    // isLocked: belum_diproses items are locked until 2 months before TMT
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
      // prevNomorSK = SK number issued for the previous period (used as "Atas Dasar" for next input)
      // Upload-only arsips get nomorSurat="-" as placeholder, treat that as missing
      prevNomorSK: (() => { const n = prevSelesai?.surat?.nomorSurat; return (n && n !== "-") ? n : null; })(),
      prevTanggalSK: (() => { const s = prevSelesai?.surat as { nomorSurat?: string; tanggalSurat?: Date } | null; return (s?.nomorSurat && s.nomorSurat !== "-") ? s.tanggalSurat?.toISOString() ?? null : null; })(),
      prevTmtSK: prevSelesai?.tmtKgbBaru?.toISOString() ?? null,
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
    golonganDistribusi: golonganDistribusiRaw.map((g) => ({ golongan: g.golonganRuang, count: g._count._all })),
    followupNotifs: followupNotifsRaw.map((n) => ({
      id: n.id, pesan: n.pesan, createdAt: n.createdAt.toISOString(),
    })),
  });
  } catch (err) {
    console.error("[dashboard] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
