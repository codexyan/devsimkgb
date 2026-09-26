import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { type RiwayatKGBRow } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { ROLES, canProcessKGB, canViewKGB } from "@/lib/auth";
import { dipegangKeuanganKanwil } from "@/lib/aksesUpt";
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
import { berhakKgb, sudahBerhenti } from "@/lib/mutasiPegawai";

export const runtime = "nodejs";

type KgbDenganSurat = RiwayatKGBRow & { surat: SuratKgbTersimpan | null };

export async function GET() {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role ?? "";
  // SDM Hukdis memakai dashboard hukdis sendiri dan tidak membaca data KGB.
  if (!canViewKGB(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const bolehLihatFollowup = canProcessKGB(role);

  try {
    // Semua batas tanggal memakai tanggal kalender WITA.
    const hariIni = hariIniWita();
    const tahun = hariIni.getFullYear();
    const bulan = hariIni.getMonth();
    const tahunAwal = new Date(tahun, 0, 1);
    const tahunAkhir = new Date(tahun + 1, 0, 1);
    // Pipeline memuat TMT tahun ini dan TMT yang masa inputnya sudah dibuka (sebelum awal bulan ke-3 dari sekarang).
    const batasPipeline = new Date(Math.max(tahunAkhir.getTime(), new Date(tahun, bulan + 3, 1).getTime()));

    const [semuaPegawai, semuaKgb, allSurat, followupRows] = await Promise.all([
      db.pegawai.findMany(),
      db.riwayatKGB.findMany(),
      db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
      bolehLihatFollowup
        ? db.notifikasi.findMany({ where: { tipe: "followup_keuangan", dibaca: false } })
        : Promise.resolve([]),
    ]);

    // Beranda keuangan Kanwil hanya menghitung pegawai Kanwil; pegawai UPT dipegang keuangan satkernya (ADR-009).
    const allPegawai =
      role === ROLES.KEUANGAN ? semuaPegawai.filter((p) => dipegangKeuanganKanwil(p.unitKerja)) : semuaPegawai;
    const idPegawai = new Set(allPegawai.map((p) => p.id));
    const allKgb = role === ROLES.KEUANGAN ? semuaKgb.filter((k) => idPegawai.has(k.pegawaiId)) : semuaKgb;

    const pegawaiAktif = allPegawai.filter((p) => p.aktif).map((p) => penandaHukdisBerlaku(p, hariIni));
    // Pegawai yang sudah berhenti tidak dihitung sebagai pegawai aktif, tetapi tetap boleh muncul pada
    // antrian bila KGB yang jatuh temponya timbul sebelum ia berhenti.
    const pegawaiBelumBerhenti = pegawaiAktif.filter((p) => !sudahBerhenti(p, hariIni));
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
      .filter((p) => berhakKgb(p, p.tmtKgbBerikutnya))
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
        unitKerja: p.unitKerja,
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
        totalPegawai: pegawaiBelumBerhenti.length,
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
      pegawaiJatuhTempo: canProcessKGB(role) ? result : [],
      followupNotifs,
    });
  } catch (err) {
    console.error("[dashboard] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
