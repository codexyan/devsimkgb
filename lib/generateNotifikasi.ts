import { prisma } from "@/lib/prisma";

export interface NotifikasiResult {
  created: number;
  details: string[];
}

/**
 * Generate notifikasi otomatis:
 *  - H-14 sebelum deadline SDM  → prioritas "info"
 *  - H-7  sebelum deadline SDM  → prioritas "warning"
 *  - Rapelan (deadline terlewat) → prioritas "critical"
 *  - Hukdis akan berakhir       → prioritas "warning"
 *
 * Deduplication:
 *  - kgb_jatuh_tempo: tidak dibuat ulang jika sudah ada dalam 7 hari terakhir
 *  - rapelan: tidak dibuat ulang jika sudah ada dalam 30 hari terakhir
 *  - hukdis_berakhir: tidak dibuat ulang jika sudah ada dalam 30 hari terakhir
 */
export async function generateNotifikasi(): Promise<NotifikasiResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Ambang peringatan KGB dapat dikonfigurasi (Pengaturan). Default 14/7.
  const cfg = await prisma.konfigurasiKanwil.findUnique({
    where: { id: "default" },
    select: { notifKgbH1: true, notifKgbH2: true },
  });
  const H1 = cfg?.notifKgbH1 ?? 14; // ambang "info" (peringatan awal)
  const H2 = cfg?.notifKgbH2 ?? 7;  // ambang "warning" (mendesak)

  const sevenDaysAgo  = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);
  const sebulanLagi   = new Date(today); sebulanLagi.setMonth(today.getMonth() + 1);

  const details: string[] = [];
  let created = 0;

  // -- 1. Hukdis akan berakhir dalam 30 hari ----------------------------------
  const pegawaiHukdis = await prisma.pegawai.findMany({
    where: {
      aktif: true,
      statusHukdis: true,
      tanggalHukdisBerakhir: { gte: today, lte: sebulanLagi },
    },
    select: { id: true, nama: true, nip: true, tanggalHukdisBerakhir: true, jenisHukdis: true },
  });

  if (pegawaiHukdis.length > 0) {
    const ids = pegawaiHukdis.map((p) => p.id);
    const sudahAda = await prisma.notifikasi.findMany({
      where: { tipe: "hukdis_berakhir", referenceId: { in: ids }, createdAt: { gte: thirtyDaysAgo } },
      select: { referenceId: true },
    });
    const sudahAdaSet = new Set(sudahAda.map((n) => n.referenceId));

    const rows = pegawaiHukdis
      .filter((p) => !sudahAdaSet.has(p.id))
      .map((p) => ({
        judul: "Hukdis Segera Berakhir",
        pesan: `Masa Hukuman Disiplin ${p.nama} (${p.nip}) akan berakhir pada ${new Date(p.tanggalHukdisBerakhir!).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}. ${p.jenisHukdis === "penundaan_kgb" ? "Status KGB akan aktif kembali secara otomatis." : "Masa hukuman disiplin akan segera berakhir."}`,
        tipe: "hukdis_berakhir",
        referenceId: p.id,
        prioritas: "warning",
        linkHref: "/dashboard/pegawai",
        kategori: "hukdis",
      }));

    if (rows.length > 0) {
      await prisma.notifikasi.createMany({ data: rows });
      created += rows.length;
      details.push(`Hukdis berakhir: ${rows.length} notifikasi`);
    }
  }

  // -- 2. KGB, H-14, H-7, Rapelan --------------------------------------------
  const pegawaiAktif = await prisma.pegawai.findMany({
    where: { aktif: true, statusHukdis: false },
    select: {
      id: true, nama: true, nip: true, tmtKgbBerikutnya: true,
      riwayatKGB: {
        where: { isArsip: false },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  if (pegawaiAktif.length > 0) {
    const ids = pegawaiAktif.map((p) => p.id);

    // Batch: notifikasi kgb_jatuh_tempo dalam 7 hari terakhir
    const recentJatuhTempo = await prisma.notifikasi.findMany({
      where: { tipe: "kgb_jatuh_tempo", referenceId: { in: ids }, createdAt: { gte: sevenDaysAgo } },
      select: { referenceId: true },
    });
    const recentJatuhTempoSet = new Set(recentJatuhTempo.map((n) => n.referenceId));

    // Batch: notifikasi rapelan dalam 30 hari terakhir
    const recentRapelan = await prisma.notifikasi.findMany({
      where: { tipe: "rapelan", referenceId: { in: ids }, createdAt: { gte: thirtyDaysAgo } },
      select: { referenceId: true },
    });
    const recentRapelanSet = new Set(recentRapelan.map((n) => n.referenceId));

    const rows: {
      judul: string; pesan: string; tipe: string; referenceId: string;
      prioritas: string; linkHref: string; kategori: string;
    }[] = [];

    for (const p of pegawaiAktif) {
      const tmt      = new Date(p.tmtKgbBerikutnya);
      const deadline = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
      deadline.setHours(0, 0, 0, 0);

      const statusKGB   = p.riwayatKGB[0]?.status;
      const belumSelesai = !statusKGB || statusKGB !== "selesai";
      const selisih      = Math.floor((deadline.getTime() - today.getTime()) / 86_400_000);

      const tmtStr      = tmt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const deadlineStr = deadline.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      if (!belumSelesai) continue;

      if (selisih < 0) {
        // Deadline terlewat → RAPELAN
        if (!recentRapelanSet.has(p.id)) {
          rows.push({
            judul: "KGB Terlambat: Rapelan",
            pesan: `KGB ${p.nama} (${p.nip}) sudah melewati deadline SDM (${deadlineStr}). TMT berlaku ${tmtStr}. Segera proses untuk menghindari tunggakan rapelan yang lebih besar.`,
            tipe: "rapelan",
            referenceId: p.id,
            prioritas: "critical",
            linkHref: "/dashboard/kgb",
            kategori: "kgb",
          });
        }
      } else if (selisih <= H2) {
        // Ambang mendesak (default H-7) atau kurang
        if (!recentJatuhTempoSet.has(p.id)) {
          const hLabel = selisih === 0 ? "HARI INI" : `H-${selisih}`;
          rows.push({
            judul: `Deadline KGB ${hLabel}: ${p.nama}`,
            pesan: `Deadline input KGB ${p.nama} (${p.nip}) tinggal ${selisih === 0 ? "hari ini" : `${selisih} hari lagi`} (${deadlineStr}). TMT berlaku ${tmtStr}. Segera lakukan input dan proses.`,
            tipe: "kgb_jatuh_tempo",
            referenceId: p.id,
            prioritas: "warning",
            linkHref: "/dashboard/kgb",
            kategori: "kgb",
          });
        }
      } else if (selisih <= H1) {
        // Antara ambang mendesak dan ambang awal (default H-8 s.d. H-14)
        if (!recentJatuhTempoSet.has(p.id)) {
          rows.push({
            judul: `KGB Jatuh Tempo H-${selisih}: ${p.nama}`,
            pesan: `KGB ${p.nama} (${p.nip}) akan jatuh tempo pada ${tmtStr}. Batas input dokumen: ${deadlineStr} (${selisih} hari lagi). Persiapkan berkas SK.`,
            tipe: "kgb_jatuh_tempo",
            referenceId: p.id,
            prioritas: "info",
            linkHref: "/dashboard/kgb",
            kategori: "kgb",
          });
        }
      }
    }

    if (rows.length > 0) {
      await prisma.notifikasi.createMany({ data: rows });
      created += rows.length;
      const rapelanCount    = rows.filter((r) => r.tipe === "rapelan").length;
      const jatuhTempoCount = rows.filter((r) => r.tipe === "kgb_jatuh_tempo").length;
      if (rapelanCount)    details.push(`Rapelan: ${rapelanCount} notifikasi`);
      if (jatuhTempoCount) details.push(`Jatuh tempo: ${jatuhTempoCount} notifikasi`);
    }
  }

  return { created, details };
}
