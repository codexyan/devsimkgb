import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";
import { penandaHukdisBerlaku, hukdisMasihBerlaku } from "@/lib/hukdisKedaluwarsa";
import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { isoTanggalKalender, kunciBulanTmt, pilihKgbSiklus, rapelanSiklus } from "@/lib/rekapKgb";
import { rekapPerSatker } from "@/lib/rekapSatker";
import { kgbDitunda, pegawaiSatker, satkerAkunUpt } from "@/lib/aksesUpt";
import { statusKonfirmasiUpt } from "@/lib/konfirmasiUpt";
import { SATKER } from "@/lib/satker";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";

/** Kolom hukdis yang dipakai di sini; sisanya sengaja tidak dibaca agar tidak ikut terkirim. */
type HukdisBaris = { pegawaiId: string; berdampakKGB: boolean | null; tmtBerakhir: Date | null };

export const runtime = "nodejs";

/** Berapa banyak SK selesai yang dikirim ke UPT; sisanya jarang dibuka lagi. */
const BATAS_SK = 60;

/*
 * Dashboard Admin UPT: seluruh isinya dibatasi satker akun yang login (lib/aksesUpt.ts). Satker dibaca dari
 * baris pengguna di basis data, bukan dari token, sehingga perubahan satker oleh Super Admin langsung berlaku.
 * Hukdis hanya dikirim sebagai penanda "KGB ditunda"; jenis dan keterangannya tidak pernah ikut.
 */
export async function GET() {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pengguna = session.user.nip ? await db.user.findUnique({ nip: session.user.nip }) : null;
  const kode = pengguna ? satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker }) : null;
  if (!kode)
    return NextResponse.json(
      { error: "Akun ini bukan Admin UPT atau belum ditautkan ke satker. Hubungi Super Admin." },
      { status: 403 },
    );
  const satker = SATKER.find((s) => s.kode === kode)!;

  const hariIni = hariIniWita();
  const [semuaPegawai, semuaKgb, semuaSurat, semuaHukdis] = await Promise.all([
    db.pegawai.findMany(),
    db.riwayatKGB.findMany(),
    db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
    db.riwayatHukdis.findMany() as Promise<HukdisBaris[]>,
  ]);

  const pegawaiBertanda = semuaPegawai.map((p) => penandaHukdisBerlaku(p, hariIni));
  const milikSatker = pegawaiSatker(pegawaiBertanda, kode);
  const idSatker = new Set(milikSatker.map((p) => p.id));
  const kgbSatker = semuaKgb.filter((k) => idSatker.has(k.pegawaiId));
  const suratByKgb = new Map(semuaSurat.map((s) => [s.kgbId, s]));
  const hukdisRingkas = semuaHukdis
    .filter((h) => idSatker.has(h.pegawaiId))
    .map((h) => ({ pegawaiId: h.pegawaiId, berdampakKGB: !!h.berdampakKGB, aktif: hukdisMasihBerlaku(h.tmtBerakhir, hariIni) }));

  // Angka per bulan TMT memakai hitungan yang sama dengan modul Satker & UPT.
  const rekap = rekapPerSatker({ pegawai: pegawaiBertanda, kgb: semuaKgb, hariIni, bulanKeDepan: 6 }).satker
    .find((r) => r.satker.kode === kode);

  const kgbPerPegawai = new Map<string, typeof semuaKgb>();
  for (const k of kgbSatker) kgbPerPegawai.set(k.pegawaiId, [...(kgbPerPegawai.get(k.pegawaiId) ?? []), k]);

  const pegawai = milikSatker
    .filter((p) => p.aktif)
    .map((p) => {
      const { kgbBerjalan } = pilihKgbSiklus({
        tmtKgbBerikutnya: p.tmtKgbBerikutnya,
        kgb: kgbPerPegawai.get(p.id) ?? [],
        hariIni,
        tahun: hariIni.getFullYear(),
      });
      const tmt = tanggalKalender(kgbBerjalan?.tmtKgbBaru) ?? tanggalKalender(p.tmtKgbBerikutnya);
      const jendela = tmt ? jendelaProsesKgb(tmt, hariIni) : null;
      const status = kgbBerjalan?.status ?? null;
      const terlambat = tmt
        ? rapelanSiklus(
            {
              status: status ?? "belum_diproses",
              tmtKgbBaru: tmt,
              flagRapelan: kgbBerjalan?.flagRapelan,
              rapelanDitetapkan: kgbBerjalan?.rapelanDitetapkan,
            },
            hariIni,
          ).terlambat
        : false;
      return {
        id: p.id,
        nama: p.nama,
        nip: p.nip,
        jabatan: p.jabatan,
        golonganRuang: p.golonganRuang,
        gajiPokok: p.gajiPokok,
        tmtKgb: isoTanggalKalender(tmt),
        bulanTmt: tmt ? kunciBulanTmt(tmt) : null,
        deadlineSDM: isoTanggalKalender(jendela?.deadlineSDM ?? null),
        terkunci: status === null && !!jendela?.isLocked,
        statusKGB: status,
        terlambat,
        // Hukdis hanya sebagai penanda; jenis dan keterangannya tidak dikirim ke UPT.
        kgbDitunda: kgbDitunda(hukdisRingkas, p.id),
        // Konfirmasi data oleh UPT untuk siklus ini; dapat diulang selama KGB belum selesai.
        konfirmasi: statusKonfirmasiUpt(p, tmt),
        konfirmasiAt: p.konfirmasiUptAt ? new Date(p.konfirmasiUptAt).toISOString() : null,
        konfirmasiOleh: p.konfirmasiUptOleh ?? null,
        bolehKonfirmasi: !!tmt && status !== "selesai",
      };
    })
    .sort((a, b) => (a.tmtKgb ?? "9999").localeCompare(b.tmtKgb ?? "9999") || a.nama.localeCompare(b.nama, "id"));

  // SK yang sudah dikonfirmasi keuangan; hanya ini yang boleh diunduh UPT.
  const namaPegawai = new Map(milikSatker.map((p) => [p.id, p]));
  const sk = kgbSatker
    .filter((k) => k.status === "selesai" && !k.isArsip)
    .map((k) => {
      const p = namaPegawai.get(k.pegawaiId);
      const surat = suratByKgb.get(k.id);
      return {
        id: k.id,
        pegawaiId: k.pegawaiId,
        nama: p?.nama ?? "-",
        nip: p?.nip ?? "-",
        tmtKgbBaru: isoTanggalKalender(k.tmtKgbBaru),
        golonganBaru: k.golonganBaru,
        gajiPokokLama: k.gajiPokokLama,
        gajiPokokBaru: k.gajiPokokBaru,
        mkgTahunBaru: k.mkgTahunBaru,
        mkgBulanBaru: k.mkgBulanBaru,
        nomorSurat: surat?.nomorSurat ?? null,
        tanggalSurat: isoTanggalKalender(surat?.tanggalSurat ?? null),
        konfirmasiKeuanganAt: k.konfirmasiKeuanganAt ? new Date(k.konfirmasiKeuanganAt).toISOString() : null,
        rapelan: k.rapelanDitetapkan === true,
        berkasAda: !!surat?.pathFile,
      };
    })
    .sort((a, b) => (b.tmtKgbBaru ?? "").localeCompare(a.tmtKgbBaru ?? ""))
    .slice(0, BATAS_SK);

  return NextResponse.json({
    satker,
    pegawaiAktif: pegawai.length,
    kgbDitunda: pegawai.filter((p) => p.kgbDitunda).length,
    tahunIni: rekap?.tahunIni ?? null,
    terlambat: rekap?.terlambat ?? 0,
    mendatang: rekap?.mendatang ?? [],
    pegawai,
    sk,
  });
}
