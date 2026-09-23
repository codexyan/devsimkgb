// Notifikasi otomatis: hukdis segera berakhir, pengingat deadline input KGB (H-14, H-7, hari-H),
// KGB terlambat (berpotensi rapelan), dan SK yang menunggu konfirmasi keuangan.
// Perencanaan notifikasi murni (rencanaNotifikasi) dan dapat diuji tanpa lapisan data; lapisan data
// diimpor saat generateNotifikasi dipanggil. Semua tanggal dibaca sebagai tanggal kalender WITA.

import type { NotifikasiRow, PegawaiRow, RiwayatKGBRow } from "./sheets/tables";
import type { RiwayatHukdisRow } from "./hukdisKedaluwarsa";
import { newId } from "./sheets/id";
import { jendelaProsesKgb } from "./tabelGaji";
import { hukdisMenahanKgb } from "./prosesKgb";
import { kunciTanggal } from "./rekapKgb";
import { formatTanggalId, hariIniWita, tanggalKalender } from "./waktu";

interface NotifikasiResult {
  created: number;
  details: string[];
}

export const TIPE_NOTIFIKASI = {
  HUKDIS_BERAKHIR: "hukdis_berakhir",
  KGB_JATUH_TEMPO: "kgb_jatuh_tempo",
  RAPELAN: "rapelan",
  FOLLOWUP_KEUANGAN: "followup_keuangan",
  SK_MENUNGGU_KEUANGAN: "sk_menunggu_keuangan",
  SK_TERBIT: "sk_terbit",
} as const;

const T = TIPE_NOTIFIKASI;

/**
 * Tipe notifikasi yang boleh dilihat dan ditandai dibaca oleh sebuah role; null berarti semua tipe.
 * Keuangan hanya menerima SK yang menunggu konfirmasi; SDM Hukdis hanya notifikasi hukdis.
 */
export function tipeNotifikasiUntukRole(role: string | null | undefined): readonly string[] | null {
  switch (role) {
    case "superAdminCore":
      return null;
    case "sdm_kgb":
      return [T.KGB_JATUH_TEMPO, T.RAPELAN, T.FOLLOWUP_KEUANGAN, T.HUKDIS_BERAKHIR];
    case "sdm_hukdis":
      return [T.HUKDIS_BERAKHIR];
    case "keuangan":
      return [T.SK_MENUNGGU_KEUANGAN];
    case "admin_upt":
      // Disaring lagi per satker oleh GET /api/notifikasi; di sini hanya jenisnya yang dibatasi.
      return [T.KGB_JATUH_TEMPO, T.RAPELAN, T.SK_TERBIT];
    default:
      return [];
  }
}

export function bolehLihatNotifikasi(role: string | null | undefined, tipe: string): boolean {
  const daftar = tipeNotifikasiUntukRole(role);
  return daftar === null || daftar.includes(tipe);
}

type TahapPengingatKgb ="h1" | "h2" | "hari_h" | "rapelan";

/** Tahap pengingat menurut selisih hari ke deadline SDM; null bila belum masuk masa pengingat. */
export function tahapPengingatKgb(selisihHari: number, h1: number, h2: number): TahapPengingatKgb | null {
  if (selisihHari < 0) return "rapelan";
  if (selisihHari === 0) return "hari_h";
  if (selisihHari <= h2) return "h2";
  if (selisihHari <= h1) return "h1";
  return null;
}

const PRIORITAS_TAHAP = { h1: "info", h2: "warning", hari_h: "critical" } as const;
const TINGKAT_PRIORITAS: Record<string, number> = { info: 1, warning: 2, critical: 3 };

/**
 * true bila pengingat tahap ini, atau tahap yang lebih mendesak, sudah dibuat untuk deadline yang
 * sama. Tahap dibedakan dari prioritas (info H-14, warning H-7, critical hari-H), dan hanya
 * notifikasi yang dibuat sejak (deadline - H1 - 1 hari) yang dihitung, sehingga siklus berikutnya
 * mendapat pengingat baru.
 */
function pengingatSudahAda(
  tahap: "h1" | "h2" | "hari_h",
  notifPegawai: readonly Pick<NotifikasiRow, "prioritas" | "createdAt">[],
  deadline: Date,
  h1: number,
): boolean {
  const awalJendela = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate() - (h1 + 1));
  const minimal = TINGKAT_PRIORITAS[PRIORITAS_TAHAP[tahap]];
  return notifPegawai.some(
    (n) => !!n.createdAt && n.createdAt >= awalJendela && (TINGKAT_PRIORITAS[n.prioritas] ?? 0) >= minimal,
  );
}

type NotifikasiBaru = Omit<NotifikasiRow, "id" | "createdAt" | "dibaca">;

interface RencanaNotifikasi {
  baru: NotifikasiBaru[];
  /**
   * Notifikasi yang sudah selesai urusannya, ditandai dibaca: SK yang tidak lagi menunggu keuangan,
   * serta pengingat/keterlambatan KGB pegawai yang siklusnya sudah diinput, ditahan hukdis, atau
   * TMT-nya sudah berganti. Tanpa ini pengingat lama menumpuk dan tidak pernah hilang.
   */
  tandaiDibaca: string[];
}

type PegawaiUntukNotifikasi = Pick<
  PegawaiRow,
  "id" | "nama" | "nip" | "aktif" | "tmtKgbBerikutnya" | "statusHukdis" | "tanggalHukdisBerakhir" | "jenisHukdis"
>;
type KgbUntukNotifikasi = Pick<RiwayatKGBRow, "id" | "pegawaiId" | "status" | "tmtKgbBaru" | "isArsip" | "flagRapelan"> &
  Partial<Pick<RiwayatKGBRow, "konfirmasiKeuanganAt">>;
type HukdisUntukNotifikasi = Pick<RiwayatHukdisRow, "pegawaiId" | "berdampakKGB" | "tmtBerakhir"> &
  Partial<Pick<RiwayatHukdisRow, "tmtMulai">>;

const STATUS_SIKLUS_SUDAH_DIINPUT = new Set(["sedang_diproses", "menunggu_keuangan", "selesai"]);

function kelompokkan<T, K>(daftar: readonly T[], kunci: (x: T) => K): Map<K, T[]> {
  const peta = new Map<K, T[]>();
  for (const x of daftar) {
    const k = kunci(x);
    const isi = peta.get(k);
    if (isi) isi.push(x);
    else peta.set(k, [x]);
  }
  return peta;
}

/**
 * Notifikasi yang perlu dibuat pada hari ini, dengan dedup terhadap notifikasi yang sudah ada.
 * - Hukdis berakhir dalam 30 hari: satu kali per 30 hari per pegawai.
 * - Pengingat KGB untuk pegawai aktif yang KGB dengan TMT berikutnya belum diinput dan tidak ditahan
 *   hukdis berdampak KGB: H-14 (info), H-7 (warning), hari-H (critical), masing-masing satu kali per
 *   deadline; setelah deadline lewat, KGB terlambat satu kali per 30 hari.
 * - SK menunggu keuangan: satu kali per KGB.
 */
export function rencanaNotifikasi(input: {
  hariIni: Date;
  h1: number;
  h2: number;
  notifikasi: readonly Pick<NotifikasiRow, "id" | "tipe" | "referenceId" | "prioritas" | "createdAt" | "dibaca">[];
  pegawai: readonly PegawaiUntukNotifikasi[];
  kgb: readonly KgbUntukNotifikasi[];
  riwayatHukdis: readonly HukdisUntukNotifikasi[];
}): RencanaNotifikasi {
  const { hariIni } = input;
  const h1 = Math.max(input.h1, input.h2);
  const h2 = Math.min(input.h1, input.h2);
  const tigaPuluhHariLalu = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - 30);
  const sebulanLagi = new Date(hariIni.getFullYear(), hariIni.getMonth() + 1, hariIni.getDate());
  const baru: NotifikasiBaru[] = [];

  const notifPerTipe = kelompokkan(input.notifikasi, (n) => `${n.tipe}|${n.referenceId ?? ""}`);
  const notifUntuk = (tipe: string, referenceId: string) => notifPerTipe.get(`${tipe}|${referenceId}`) ?? [];
  const kgbPerPegawai = kelompokkan(input.kgb, (k) => k.pegawaiId);
  const hukdisPerPegawai = kelompokkan(input.riwayatHukdis, (h) => h.pegawaiId);
  const pegawaiById = new Map(input.pegawai.map((p) => [p.id, p]));
  /** Pegawai yang pengingat KGB-nya masih berlaku hari ini; sisanya pengingat lamanya ditutup. */
  const masihPerluDiingatkan = new Set<string>();

  for (const p of input.pegawai) {
    if (!p.aktif) continue;

    // 1. Hukdis akan berakhir dalam 30 hari.
    const berakhir = tanggalKalender(p.tanggalHukdisBerakhir);
    if (p.statusHukdis && berakhir && berakhir >= hariIni && berakhir <= sebulanLagi) {
      const sudah = notifUntuk(T.HUKDIS_BERAKHIR, p.id).some((n) => !!n.createdAt && n.createdAt >= tigaPuluhHariLalu);
      if (!sudah) {
        baru.push({
          judul: "Hukdis Segera Berakhir",
          pesan: `Masa hukuman disiplin ${p.nama} (${p.nip}) berakhir pada ${formatTanggalId(berakhir)}. ${
            p.jenisHukdis === "penundaan_kgb"
              ? "Setelah itu KGB pegawai dapat diproses kembali."
              : "Periksa kembali data hukuman disiplin pegawai."
          }`,
          tipe: T.HUKDIS_BERAKHIR,
          referenceId: p.id,
          prioritas: "warning",
          linkHref: "/dashboard/pegawai",
          kategori: "hukdis",
        });
      }
    }

    // 2. Pengingat deadline input KGB.
    const tmt = tanggalKalender(p.tmtKgbBerikutnya);
    const jendela = jendelaProsesKgb(tmt, hariIni);
    if (!tmt || !jendela) continue;
    const kunciTmt = kunciTanggal(tmt);
    const sudahDiinput = (kgbPerPegawai.get(p.id) ?? []).some(
      (k) => STATUS_SIKLUS_SUDAH_DIINPUT.has(k.status) && kunciTanggal(k.tmtKgbBaru) === kunciTmt,
    );
    if (sudahDiinput) continue;
    const ditahan = hukdisMenahanKgb({
      riwayatHukdis: hukdisPerPegawai.get(p.id) ?? [],
      pegawai: p,
      hariIni,
      tmtKgb: tmt,
    });
    if (ditahan.menahan) continue;

    const deadline = jendela.deadlineSDM;
    const selisih = Math.round((deadline.getTime() - hariIni.getTime()) / 86_400_000);
    const tahap = tahapPengingatKgb(selisih, h1, h2);
    if (!tahap) continue;
    masihPerluDiingatkan.add(p.id);
    const tmtStr = formatTanggalId(tmt);
    const deadlineStr = formatTanggalId(deadline);

    if (tahap === "rapelan") {
      const sudah = notifUntuk(T.RAPELAN, p.id).some((n) => !!n.createdAt && n.createdAt >= tigaPuluhHariLalu);
      if (!sudah) {
        baru.push({
          judul: `KGB Terlambat: ${p.nama}`,
          pesan: `Deadline input KGB ${p.nama} (${p.nip}) sudah lewat pada ${deadlineStr}. TMT berlaku ${tmtStr}. Segera lakukan Input KGB; KGB ini berpotensi rapelan.`,
          tipe: T.RAPELAN,
          referenceId: p.id,
          prioritas: "critical",
          linkHref: "/dashboard/kgb",
          kategori: "kgb",
        });
      }
      continue;
    }

    if (pengingatSudahAda(tahap, notifUntuk(T.KGB_JATUH_TEMPO, p.id), deadline, h1)) continue;
    const isi =
      tahap === "hari_h"
        ? {
            judul: `Deadline KGB Hari Ini: ${p.nama}`,
            pesan: `Deadline input KGB ${p.nama} (${p.nip}) jatuh pada hari ini (${deadlineStr}). TMT berlaku ${tmtStr}. Segera lakukan Input KGB.`,
          }
        : tahap === "h2"
          ? {
              judul: `Deadline KGB H-${selisih}: ${p.nama}`,
              pesan: `Deadline input KGB ${p.nama} (${p.nip}) tinggal ${selisih} hari lagi (${deadlineStr}). TMT berlaku ${tmtStr}. Segera lakukan Input KGB.`,
            }
          : {
              judul: `KGB Jatuh Tempo H-${selisih}: ${p.nama}`,
              pesan: `KGB ${p.nama} (${p.nip}) berlaku mulai ${tmtStr}. Batas input: ${deadlineStr} (${selisih} hari lagi). Siapkan data SK terakhir.`,
            };
    baru.push({
      ...isi,
      tipe: T.KGB_JATUH_TEMPO,
      referenceId: p.id,
      prioritas: PRIORITAS_TAHAP[tahap],
      linkHref: "/dashboard/kgb",
      kategori: "kgb",
    });
  }

  // 3. SK menunggu konfirmasi keuangan.
  const menunggu = new Set<string>();
  for (const k of input.kgb) {
    if (k.status !== "menunggu_keuangan" || k.isArsip) continue;
    menunggu.add(k.id);
    if (notifUntuk(T.SK_MENUNGGU_KEUANGAN, k.id).length > 0) continue;
    const p = pegawaiById.get(k.pegawaiId);
    baru.push({
      judul: `SK KGB Menunggu Konfirmasi: ${p?.nama ?? "-"}`,
      pesan: `SK KGB ${p?.nama ?? "-"} (${p?.nip ?? "-"}) dengan TMT ${formatTanggalId(k.tmtKgbBaru)} sudah diunggah dan menunggu konfirmasi keuangan.${
        k.flagRapelan ? " KGB ini berpotensi rapelan." : ""
      }`,
      tipe: T.SK_MENUNGGU_KEUANGAN,
      referenceId: k.id,
      prioritas: k.flagRapelan ? "warning" : "info",
      linkHref: "/dashboard/keuangan",
      kategori: "keuangan",
    });
  }
  // 4. SK sudah dikonfirmasi keuangan: kabar untuk UPT bahwa SK dapat diunduh.
  const empatBelasHariLalu = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - 14);
  for (const k of input.kgb) {
    if (k.status !== "selesai" || k.isArsip) continue;
    const konfirmasi = tanggalKalender(k.konfirmasiKeuanganAt);
    if (!konfirmasi || konfirmasi < empatBelasHariLalu) continue;
    if (notifUntuk(T.SK_TERBIT, k.id).length > 0) continue;
    const p = pegawaiById.get(k.pegawaiId);
    baru.push({
      judul: `SK KGB Terbit: ${p?.nama ?? "-"}`,
      pesan: `SK kenaikan gaji berkala ${p?.nama ?? "-"} (${p?.nip ?? "-"}) dengan TMT ${formatTanggalId(k.tmtKgbBaru)} sudah dikonfirmasi keuangan. Berkas SK dapat diunduh dari halaman satker.`,
      tipe: T.SK_TERBIT,
      referenceId: k.id,
      prioritas: "info",
      linkHref: "/dashboard",
      kategori: "kgb",
    });
  }

  const tandaiDibaca = input.notifikasi
    .filter((n) => {
      if (n.dibaca) return false;
      if (n.tipe === T.SK_MENUNGGU_KEUANGAN) return !menunggu.has(n.referenceId ?? "");
      // Pengingat dan keterlambatan KGB ditutup begitu pegawainya tidak lagi perlu diingatkan.
      if (n.tipe === T.KGB_JATUH_TEMPO || n.tipe === T.RAPELAN) return !masihPerluDiingatkan.has(n.referenceId ?? "");
      return false;
    })
    .map((n) => n.id);

  return { baru, tandaiDibaca };
}

/** Buat notifikasi otomatis. Dipanggil cron harian dan, paling sering tiap 15 menit, oleh GET /api/notifikasi. */
export async function generateNotifikasi(sekarang: Date = new Date()): Promise<NotifikasiResult> {
  const { db } = await import("./db");
  const hariIni = hariIniWita(sekarang);

  const [cfg, allNotif, allPegawai, allKgb, allHukdis] = await Promise.all([
    db.konfigurasiKanwil.findUnique({ id: "default" }) as Promise<{ notifKgbH1?: number | null; notifKgbH2?: number | null } | null>,
    db.notifikasi.findMany(),
    db.pegawai.findMany(),
    db.riwayatKGB.findMany(),
    db.riwayatHukdis.findMany() as Promise<RiwayatHukdisRow[]>,
  ]);

  const rencana = rencanaNotifikasi({
    hariIni,
    h1: cfg?.notifKgbH1 ?? 14,
    h2: cfg?.notifKgbH2 ?? 7,
    notifikasi: allNotif,
    pegawai: allPegawai,
    kgb: allKgb,
    riwayatHukdis: allHukdis,
  });

  const details: string[] = [];
  let created = 0;

  if (rencana.baru.length > 0) {
    // Pembuatan bisa berjalan bersamaan di beberapa isolate; baca ulang agar notifikasi yang baru
    // saja dibuat proses lain tidak digandakan.
    const satuJamLalu = new Date(sekarang.getTime() - 60 * 60 * 1000);
    const terbaru = await db.notifikasi.findMany({ where: { createdAt: { gte: satuJamLalu } } });
    const sudahDibuat = new Set(terbaru.map((n) => `${n.tipe}|${n.referenceId ?? ""}|${n.prioritas}`));
    const rows: NotifikasiRow[] = rencana.baru
      .filter((n) => !sudahDibuat.has(`${n.tipe}|${n.referenceId ?? ""}|${n.prioritas}`))
      .map((n) => ({ ...n, id: newId(), dibaca: false, createdAt: sekarang }));
    if (rows.length > 0) {
      await db.notifikasi.createMany(rows);
      created = rows.length;
      const jumlah = (tipe: string) => rows.filter((r) => r.tipe === tipe).length;
      if (jumlah(T.HUKDIS_BERAKHIR)) details.push(`Hukdis berakhir: ${jumlah(T.HUKDIS_BERAKHIR)} notifikasi`);
      if (jumlah(T.RAPELAN)) details.push(`KGB terlambat: ${jumlah(T.RAPELAN)} notifikasi`);
      if (jumlah(T.KGB_JATUH_TEMPO)) details.push(`Jatuh tempo: ${jumlah(T.KGB_JATUH_TEMPO)} notifikasi`);
      if (jumlah(T.SK_MENUNGGU_KEUANGAN)) details.push(`SK menunggu keuangan: ${jumlah(T.SK_MENUNGGU_KEUANGAN)} notifikasi`);
      if (jumlah(T.SK_TERBIT)) details.push(`SK terbit: ${jumlah(T.SK_TERBIT)} notifikasi`);
    }
  }

  if (rencana.tandaiDibaca.length > 0) {
    const jumlah = await db.notifikasi.updateMany({ id: { in: rencana.tandaiDibaca } }, { dibaca: true });
    details.push(`Notifikasi yang urusannya selesai ditandai dibaca: ${jumlah}`);
  }

  return { created, details };
}
