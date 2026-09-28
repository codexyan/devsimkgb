import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { logAudit } from "@/lib/auditLog";
import { canEditPegawai } from "@/lib/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { dampakKenaikanPangkatPadaKgb, skKpLebihBaru } from "@/lib/kenaikanPangkat";
import { hitungPmk } from "@/lib/pmk";
import { rencanaSiklusBerikutnya } from "@/lib/jadwalKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { formatTanggalId, tanggalKalender } from "@/lib/waktu";
import type { RiwayatKGBRow, RiwayatPmkRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/*
 * Peninjauan masa kerja (PMK) satu pegawai (ADR-021; hitungannya di lib/pmk.ts).
 *
 * Mencatat SK PMK lalu menyesuaikan data gaji pegawai: MKG bertambah sebesar tambahan PMK, gaji pokok dibaca ulang
 * dari tabel PP 5/2024, dan TMT KGB berikutnya diatur ulang karena MKG yang baru bisa mencapai langkah tabel lebih
 * cepat. Tim SDM dapat mengoreksi TMT KGB berikutnya sesuai SK PMK. KGB placeholder "belum diproses" ikut disusun
 * ulang; KGB yang sudah dikerjakan dikembalikan sebagai daftar "perlu ditinjau", sama dengan kenaikan pangkat.
 */

function keTanggal(nilai: unknown): Date | null {
  return typeof nilai === "string" && nilai.trim() ? tanggalKalender(nilai) : null;
}

/** Bilangan dari isian angka; NaN bila kosong atau bukan angka. */
function keBilangan(nilai: unknown): number {
  if (typeof nilai === "number") return nilai;
  return typeof nilai === "string" && nilai.trim() ? Number(nilai) : NaN;
}

// GET, riwayat PMK pegawai, terbaru dulu.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!NON_KEUANGAN.includes(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const riwayat = (await db.riwayatPmk.findMany({ where: { pegawaiId: id } })) as RiwayatPmkRow[];
  const urut = [...riwayat].sort(
    (a, b) => (tanggalKalender(b.tmtPmk)?.getTime() ?? 0) - (tanggalKalender(a.tmtPmk)?.getTime() ?? 0),
  );
  return NextResponse.json(
    urut.map((r) => ({
      id: r.id,
      nomorSK: r.nomorSK,
      tanggalSK: isoTanggalKalender(r.tanggalSK),
      tmtPmk: isoTanggalKalender(r.tmtPmk),
      golonganRuang: r.golonganRuang,
      tambahBulan: r.tambahBulan,
      mkgTahunSebelum: r.mkgTahunSebelum,
      mkgBulanSebelum: r.mkgBulanSebelum,
      mkgTahunSesudah: r.mkgTahunSesudah,
      mkgBulanSesudah: r.mkgBulanSesudah,
      gajiPokokLama: r.gajiPokokLama,
      gajiPokokBaru: r.gajiPokokBaru,
      tmtKgbBerikutnyaLama: isoTanggalKalender(r.tmtKgbBerikutnyaLama),
      tmtKgbBerikutnyaBaru: isoTanggalKalender(r.tmtKgbBerikutnyaBaru),
      penetapSK: r.penetapSK ?? null,
      keterangan: r.keterangan,
    })),
  );
}

// POST, catat PMK dan sesuaikan data gaji serta jadwal KGB pegawai.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nomorSK = teks(body.nomorSK);
  const tanggalSK = keTanggal(body.tanggalSK);
  const tmtPmk = keTanggal(body.tmtPmk);
  const mkgTahunSk = keBilangan(body.mkgTahunSk);
  const bulan = keBilangan(body.mkgBulanSk);
  const mkgBulanSk = Number.isNaN(bulan) ? 0 : bulan;
  const tmtKgbPilihan = keTanggal(body.tmtKgbBerikutnya);
  const penetapSK = teks(body.penetapSK) || null;
  const keterangan = teks(body.keterangan) || null;

  if (!nomorSK) return NextResponse.json({ error: "Nomor SK PMK wajib diisi" }, { status: 400 });
  if (!tanggalSK || !tmtPmk) return NextResponse.json({ error: "Tanggal SK dan TMT PMK wajib diisi" }, { status: 400 });
  if (Number.isNaN(mkgTahunSk))
    return NextResponse.json({ error: "Masa kerja golongan pada SK PMK wajib diisi" }, { status: 400 });

  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const hitung = hitungPmk({
    golonganRuang: pegawai.golonganRuang,
    mkgTahun: pegawai.mkgTahun ?? 0,
    mkgBulan: pegawai.mkgBulan ?? 0,
    tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
    tmtPmk,
    mkgTahunSk,
    mkgBulanSk,
  });
  if (!hitung.ok) return NextResponse.json({ error: hitung.pesan }, { status: 400 });
  const hasil = hitung.hasil;

  // TMT KGB berikutnya: usulan hitungan, atau koreksi Tim SDM sesuai SK PMK. KGB tidak boleh sebelum PMK berlaku.
  const tmtKgbBerikutnya = tmtKgbPilihan ?? hasil.tmtKgbBerikutnyaUsulan;
  if (tmtKgbBerikutnya <= tmtPmk)
    return NextResponse.json(
      { error: `TMT KGB berikutnya harus sesudah TMT PMK (${formatTanggalId(tmtPmk)})` },
      { status: 400 },
    );

  const kgbPegawai = (await db.riwayatKGB.findMany({ where: { pegawaiId: id } })) as RiwayatKGBRow[];
  const dampak = dampakKenaikanPangkatPadaKgb(kgbPegawai);

  // 1) Riwayat PMK disimpan lebih dulu, sehingga jejaknya tetap ada walau langkah berikutnya gagal.
  const riwayat: RiwayatPmkRow = {
    id: newId(),
    pegawaiId: id,
    nomorSK,
    tanggalSK,
    tmtPmk,
    golonganRuang: pegawai.golonganRuang,
    tambahBulan: hasil.tambahBulan,
    mkgTahunSebelum: hasil.mkgSebelumPadaTmt.tahun,
    mkgBulanSebelum: hasil.mkgSebelumPadaTmt.bulan,
    mkgTahunSesudah: hasil.mkgSesudahPadaTmt.tahun,
    mkgBulanSesudah: hasil.mkgSesudahPadaTmt.bulan,
    mkgTahunDasarLama: pegawai.mkgTahun ?? 0,
    mkgBulanDasarLama: pegawai.mkgBulan ?? 0,
    mkgTahunDasarBaru: hasil.mkgTahunDasar,
    mkgBulanDasarBaru: hasil.mkgBulanDasar,
    gajiPokokLama: pegawai.gajiPokok ?? 0,
    gajiPokokBaru: hasil.gajiPokokBaru,
    tmtKgbBerikutnyaLama: tanggalKalender(pegawai.tmtKgbBerikutnya),
    tmtKgbBerikutnyaBaru: tmtKgbBerikutnya,
    penetapSK,
    keterangan,
    createdAt: new Date(),
    createdBy: pengguna.id,
  };
  await db.riwayatPmk.create(riwayat);

  // 2) Data gaji dan jadwal KGB pegawai mengikuti SK PMK.
  await db.pegawai.update(
    { id },
    {
      mkgTahun: hasil.mkgTahunDasar,
      mkgBulan: hasil.mkgBulanDasar,
      gajiPokok: hasil.gajiPokokBaru,
      tmtKgbBerikutnya,
      updatedAt: new Date(),
    },
  );

  // 3) Placeholder KGB berikutnya disusun ulang pada jadwal yang baru. SK PMK yang ber-TMT sesudah KGB terakhir
  // yang selesai menjadi Atas dasar SK KGB berikutnya (ADR-020), jadi penetapnya menggantikan penetap lama.
  const pmkTerbaru = skKpLebihBaru(tmtPmk, kgbPegawai);
  const placeholder = [...dampak.diselaraskan].sort(
    (a, b) => (tanggalKalender(a.tmtKgbBaru)?.getTime() ?? 0) - (tanggalKalender(b.tmtKgbBaru)?.getTime() ?? 0),
  );
  const diselaraskan: string[] = [];
  let tmtBerikut: Date | null = tmtKgbBerikutnya;
  for (const k of placeholder) {
    if (!tmtBerikut) break;
    try {
      const rencana = rencanaSiklusBerikutnya({
        golonganRuang: pegawai.golonganRuang,
        mkgTahun: hasil.mkgTahunDasar,
        mkgBulan: hasil.mkgBulanDasar,
        gajiPokok: hasil.gajiPokokBaru,
        tmtKgbBerikutnya: tmtBerikut,
        tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
        penetapSkDasar: pmkTerbaru ? penetapSK : k.penetapSkDasar,
      });
      await db.riwayatKGB.update(
        { id: k.id },
        {
          tanggalSK: rencana.tanggalSK,
          tmtSK: rencana.tmtSK,
          golonganLama: rencana.golonganLama,
          gajiPokokLama: rencana.gajiPokokLama,
          mkgTahunLama: rencana.mkgTahunLama,
          mkgBulanLama: rencana.mkgBulanLama,
          golonganBaru: rencana.golonganBaru,
          gajiPokokBaru: rencana.gajiPokokBaru,
          mkgTahunBaru: rencana.mkgTahunBaru,
          mkgBulanBaru: rencana.mkgBulanBaru,
          tmtKgbBaru: rencana.tmtKgbBaru,
          tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
          flagRapelan: rencana.flagRapelan,
          ...(pmkTerbaru ? { penetapSkDasar: penetapSK } : {}),
        },
      );
      diselaraskan.push(k.id);
      tmtBerikut = rencana.tmtKgbBerikutnya;
    } catch {
      // Golongan atau TMT yang tidak terbaca dibiarkan; Tim SDM memperbaikinya lewat Proses KGB.
      tmtBerikut = null;
    }
  }

  const jadwalBergeser =
    isoTanggalKalender(pegawai.tmtKgbBerikutnya) !== isoTanggalKalender(tmtKgbBerikutnya)
      ? `, KGB berikutnya ${formatTanggalId(pegawai.tmtKgbBerikutnya)} → ${formatTanggalId(tmtKgbBerikutnya)}`
      : "";
  logAudit({
    userId: pengguna.id,
    aksi: "peninjauan_masa_kerja",
    targetNama: pegawai.nama,
    detail:
      `PMK ${pegawai.nama} (${pegawai.nip}), tambah ${Math.floor(hasil.tambahBulan / 12)} thn ${hasil.tambahBulan % 12} bln, ` +
      `MKG pada TMT PMK ${hasil.mkgSesudahPadaTmt.tahun} thn ${hasil.mkgSesudahPadaTmt.bulan} bln, ` +
      `Gaji Rp ${(pegawai.gajiPokok ?? 0).toLocaleString("id-ID")} → Rp ${hasil.gajiPokokBaru.toLocaleString("id-ID")}` +
      `${jadwalBergeser}, SK ${nomorSK}`,
  });

  return NextResponse.json(
    {
      ok: true,
      hasil: {
        tambahBulan: hasil.tambahBulan,
        gajiPokokLama: pegawai.gajiPokok ?? 0,
        gajiPokokBaru: hasil.gajiPokokBaru,
        tmtKgbBerikutnyaLama: isoTanggalKalender(pegawai.tmtKgbBerikutnya),
        tmtKgbBerikutnya: isoTanggalKalender(tmtKgbBerikutnya),
      },
      kgbDiselaraskan: diselaraskan.length,
      kgbPerluDitinjau: dampak.perluDitinjau.map((k) => ({
        id: k.id,
        status: k.status,
        tmtKgbBaru: isoTanggalKalender(k.tmtKgbBaru),
      })),
    },
    { status: 201 },
  );
}
