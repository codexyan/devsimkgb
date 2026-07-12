import { sheets, type NotifikasiRow } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";

export interface NotifikasiResult {
  created: number;
  details: string[];
}

function mkNotif(p: {
  judul: string; pesan: string; tipe: string; referenceId: string | null;
  prioritas: string; linkHref: string; kategori: string;
}): NotifikasiRow {
  return {
    id: newId(),
    judul: p.judul,
    pesan: p.pesan,
    tipe: p.tipe,
    referenceId: p.referenceId,
    dibaca: false,
    createdAt: new Date(),
    prioritas: p.prioritas,
    linkHref: p.linkHref,
    kategori: p.kategori,
  };
}

/**
 * Generate notifikasi otomatis (H-14/H-7/rapelan/hukdis berakhir) dengan dedup.
 */
export async function generateNotifikasi(): Promise<NotifikasiResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cfg = (await sheets.konfigurasiKanwil.findUnique({ id: "default" })) as any;
  const H1 = cfg?.notifKgbH1 ?? 14;
  const H2 = cfg?.notifKgbH2 ?? 7;

  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);
  const sebulanLagi = new Date(today); sebulanLagi.setMonth(today.getMonth() + 1);

  const [allNotif, allPegawai, allKgb] = await Promise.all([
    sheets.notifikasi.findMany(),
    sheets.pegawai.findMany(),
    sheets.riwayatKGB.findMany(),
  ]);

  const details: string[] = [];
  let created = 0;

  // -- 1. Hukdis akan berakhir dalam 30 hari --
  const pegawaiHukdis = allPegawai.filter(
    (p) => p.aktif && p.statusHukdis && p.tanggalHukdisBerakhir && p.tanggalHukdisBerakhir >= today && p.tanggalHukdisBerakhir <= sebulanLagi,
  );

  if (pegawaiHukdis.length > 0) {
    const sudahAdaSet = new Set(
      allNotif
        .filter((n) => n.tipe === "hukdis_berakhir" && n.createdAt && n.createdAt >= thirtyDaysAgo)
        .map((n) => n.referenceId),
    );

    const rows = pegawaiHukdis
      .filter((p) => !sudahAdaSet.has(p.id))
      .map((p) =>
        mkNotif({
          judul: "Hukdis Segera Berakhir",
          pesan: `Masa Hukuman Disiplin ${p.nama} (${p.nip}) akan berakhir pada ${new Date(p.tanggalHukdisBerakhir!).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}. ${p.jenisHukdis === "penundaan_kgb" ? "Status KGB akan aktif kembali secara otomatis." : "Masa hukuman disiplin akan segera berakhir."}`,
          tipe: "hukdis_berakhir",
          referenceId: p.id,
          prioritas: "warning",
          linkHref: "/dashboard/pegawai",
          kategori: "hukdis",
        }),
      );

    if (rows.length > 0) {
      await sheets.notifikasi.createMany(rows);
      created += rows.length;
      details.push(`Hukdis berakhir: ${rows.length} notifikasi`);
    }
  }

  // -- 2. KGB, H-14, H-7, Rapelan --
  const pegawaiAktif = allPegawai.filter((p) => p.aktif && !p.statusHukdis);

  if (pegawaiAktif.length > 0) {
    // Status KGB terkini (non-arsip) per pegawai.
    const latestKgb = new Map<string, { status: string; t: number }>();
    for (const k of allKgb) {
      if (k.isArsip) continue;
      const t = k.createdAt?.getTime() ?? 0;
      const prev = latestKgb.get(k.pegawaiId);
      if (!prev || t > prev.t) latestKgb.set(k.pegawaiId, { status: k.status, t });
    }

    const recentJatuhTempoSet = new Set(
      allNotif.filter((n) => n.tipe === "kgb_jatuh_tempo" && n.createdAt && n.createdAt >= sevenDaysAgo).map((n) => n.referenceId),
    );
    const recentRapelanSet = new Set(
      allNotif.filter((n) => n.tipe === "rapelan" && n.createdAt && n.createdAt >= thirtyDaysAgo).map((n) => n.referenceId),
    );

    const rows: NotifikasiRow[] = [];

    for (const p of pegawaiAktif) {
      if (!p.tmtKgbBerikutnya) continue;
      const tmt = new Date(p.tmtKgbBerikutnya);
      const deadline = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
      deadline.setHours(0, 0, 0, 0);

      const statusKGB = latestKgb.get(p.id)?.status;
      const belumSelesai = !statusKGB || statusKGB !== "selesai";
      const selisih = Math.floor((deadline.getTime() - today.getTime()) / 86_400_000);

      const tmtStr = tmt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const deadlineStr = deadline.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      if (!belumSelesai) continue;

      if (selisih < 0) {
        if (!recentRapelanSet.has(p.id)) {
          rows.push(mkNotif({
            judul: "KGB Terlambat: Rapelan",
            pesan: `KGB ${p.nama} (${p.nip}) sudah melewati deadline SDM (${deadlineStr}). TMT berlaku ${tmtStr}. Segera proses untuk menghindari tunggakan rapelan yang lebih besar.`,
            tipe: "rapelan", referenceId: p.id, prioritas: "critical", linkHref: "/dashboard/kgb", kategori: "kgb",
          }));
        }
      } else if (selisih <= H2) {
        if (!recentJatuhTempoSet.has(p.id)) {
          const hLabel = selisih === 0 ? "HARI INI" : `H-${selisih}`;
          rows.push(mkNotif({
            judul: `Deadline KGB ${hLabel}: ${p.nama}`,
            pesan: `Deadline input KGB ${p.nama} (${p.nip}) tinggal ${selisih === 0 ? "hari ini" : `${selisih} hari lagi`} (${deadlineStr}). TMT berlaku ${tmtStr}. Segera lakukan input dan proses.`,
            tipe: "kgb_jatuh_tempo", referenceId: p.id, prioritas: "warning", linkHref: "/dashboard/kgb", kategori: "kgb",
          }));
        }
      } else if (selisih <= H1) {
        if (!recentJatuhTempoSet.has(p.id)) {
          rows.push(mkNotif({
            judul: `KGB Jatuh Tempo H-${selisih}: ${p.nama}`,
            pesan: `KGB ${p.nama} (${p.nip}) akan jatuh tempo pada ${tmtStr}. Batas input dokumen: ${deadlineStr} (${selisih} hari lagi). Persiapkan berkas SK.`,
            tipe: "kgb_jatuh_tempo", referenceId: p.id, prioritas: "info", linkHref: "/dashboard/kgb", kategori: "kgb",
          }));
        }
      }
    }

    if (rows.length > 0) {
      await sheets.notifikasi.createMany(rows);
      created += rows.length;
      const rapelanCount = rows.filter((r) => r.tipe === "rapelan").length;
      const jatuhTempoCount = rows.filter((r) => r.tipe === "kgb_jatuh_tempo").length;
      if (rapelanCount) details.push(`Rapelan: ${rapelanCount} notifikasi`);
      if (jatuhTempoCount) details.push(`Jatuh tempo: ${jatuhTempoCount} notifikasi`);
    }
  }

  return { created, details };
}
