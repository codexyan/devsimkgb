import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { logAudit } from "@/lib/auditLog";
import { canEditPegawai } from "@/lib/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { JENIS_KP, dampakKenaikanPangkatPadaKgb, hitungKenaikanPangkat, isJenisKp } from "@/lib/kenaikanPangkat";
import { rencanaSiklusBerikutnya } from "@/lib/jadwalKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { tanggalKalender } from "@/lib/waktu";
import type { RiwayatKGBRow, RiwayatPangkatRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/*
 * Kenaikan pangkat satu pegawai (Buku Saku KP 2026; aturannya di lib/kenaikanPangkat.ts).
 *
 * Mencatat SK KP lalu menyesuaikan data gaji pegawai: golongan, pangkat, masa kerja golongan (dipotong bila
 * pindah jenjang), dan gaji pokok dari tabel PP 5/2024. TMT KGB tidak diatur ulang, karena siklus KGB berjalan
 * dari TMT KGB terakhir; yang berubah hanya dasar gajinya. KGB placeholder "belum diproses" ikut diselaraskan,
 * sedangkan KGB yang sudah dikerjakan Tim SDM atau keuangan dikembalikan sebagai daftar "perlu ditinjau" agar
 * Tim SDM memutuskan sendiri: batalkan dan input ulang, atau lanjutkan SK yang sudah dibuat.
 */

function keTanggal(nilai: unknown): Date | null {
  return typeof nilai === "string" && nilai.trim() ? tanggalKalender(nilai) : null;
}

// GET, riwayat kenaikan pangkat pegawai, terbaru dulu.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!NON_KEUANGAN.includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const riwayat = (await db.riwayatPangkat.findMany({ where: { pegawaiId: id } })) as RiwayatPangkatRow[];
  const urut = [...riwayat].sort(
    (a, b) => (tanggalKalender(b.tmtPangkat)?.getTime() ?? 0) - (tanggalKalender(a.tmtPangkat)?.getTime() ?? 0),
  );
  return NextResponse.json(
    urut.map((r) => ({
      id: r.id,
      jenisKp: r.jenisKp,
      jenisLabel: isJenisKp(r.jenisKp) ? JENIS_KP[r.jenisKp] : r.jenisKp,
      nomorSK: r.nomorSK,
      tanggalSK: isoTanggalKalender(r.tanggalSK),
      tmtPangkat: isoTanggalKalender(r.tmtPangkat),
      golonganLama: r.golonganLama,
      golonganBaru: r.golonganBaru,
      mkgTahunLama: r.mkgTahunLama,
      mkgBulanLama: r.mkgBulanLama,
      mkgTahunBaru: r.mkgTahunBaru,
      mkgBulanBaru: r.mkgBulanBaru,
      gajiPokokLama: r.gajiPokokLama,
      gajiPokokBaru: r.gajiPokokBaru,
      keterangan: r.keterangan,
    })),
  );
}

// POST, catat kenaikan pangkat dan sesuaikan data gaji pegawai.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const pengguna = await penggunaLogin(session);
  if (!pengguna)
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const jenisKp = teks(body.jenisKp);
  const golonganBaru = teks(body.golonganBaru);
  const nomorSK = teks(body.nomorSK);
  const tanggalSK = keTanggal(body.tanggalSK);
  const tmtPangkat = keTanggal(body.tmtPangkat);
  const keterangan = teks(body.keterangan) || null;

  if (!isJenisKp(jenisKp))
    return NextResponse.json({ error: "Jenis kenaikan pangkat tidak dikenal" }, { status: 400 });
  if (!nomorSK)
    return NextResponse.json({ error: "Nomor SK kenaikan pangkat wajib diisi" }, { status: 400 });
  if (!tanggalSK || !tmtPangkat)
    return NextResponse.json({ error: "Tanggal SK dan TMT pangkat wajib diisi" }, { status: 400 });

  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const hitung = hitungKenaikanPangkat({
    golonganLama: pegawai.golonganRuang,
    mkgTahunLama: pegawai.mkgTahun ?? 0,
    mkgBulanLama: pegawai.mkgBulan ?? 0,
    golonganBaru,
  });
  if (!hitung.ok)
    return NextResponse.json({ error: hitung.pesan }, { status: 400 });
  const hasil = hitung.hasil;

  const kgbPegawai = (await db.riwayatKGB.findMany({ where: { pegawaiId: id } })) as RiwayatKGBRow[];
  const dampak = dampakKenaikanPangkatPadaKgb(kgbPegawai);

  // 1) Riwayat KP disimpan lebih dulu, sehingga jejaknya tetap ada walau langkah berikutnya gagal.
  const riwayat: RiwayatPangkatRow = {
    id: newId(),
    pegawaiId: id,
    jenisKp,
    nomorSK,
    tanggalSK,
    tmtPangkat,
    golonganLama: pegawai.golonganRuang,
    golonganBaru: hasil.golonganBaru,
    mkgTahunLama: pegawai.mkgTahun ?? 0,
    mkgBulanLama: pegawai.mkgBulan ?? 0,
    mkgTahunBaru: hasil.mkgTahunBaru,
    mkgBulanBaru: hasil.mkgBulanBaru,
    gajiPokokLama: pegawai.gajiPokok ?? 0,
    gajiPokokBaru: hasil.gajiPokokBaru,
    keterangan,
    createdAt: new Date(),
    createdBy: pengguna.id,
  };
  await db.riwayatPangkat.create(riwayat);

  // 2) Data gaji pegawai mengikuti SK KP.
  await db.pegawai.update(
    { id },
    {
      golonganRuang: hasil.golonganBaru,
      pangkat: hasil.pangkatBaru,
      mkgTahun: hasil.mkgTahunBaru,
      mkgBulan: hasil.mkgBulanBaru,
      gajiPokok: hasil.gajiPokokBaru,
      tmtGolongan: tmtPangkat,
      updatedAt: new Date(),
    },
  );

  // 3) Placeholder KGB berikutnya dihitung ulang dari keadaan pegawai yang baru; jadwalnya tidak berubah.
  const diselaraskan: string[] = [];
  for (const k of dampak.diselaraskan) {
    const tmtKgbBaru = tanggalKalender(k.tmtKgbBaru);
    if (!tmtKgbBaru) continue;
    try {
      const rencana = rencanaSiklusBerikutnya({
        golonganRuang: hasil.golonganBaru,
        mkgTahun: hasil.mkgTahunBaru,
        mkgBulan: hasil.mkgBulanBaru,
        gajiPokok: hasil.gajiPokokBaru,
        tmtKgbBerikutnya: tmtKgbBaru,
        tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
        penetapSkDasar: k.penetapSkDasar,
      });
      await db.riwayatKGB.update(
        { id: k.id },
        {
          golonganLama: rencana.golonganLama,
          gajiPokokLama: rencana.gajiPokokLama,
          mkgTahunLama: rencana.mkgTahunLama,
          mkgBulanLama: rencana.mkgBulanLama,
          golonganBaru: rencana.golonganBaru,
          gajiPokokBaru: rencana.gajiPokokBaru,
          mkgTahunBaru: rencana.mkgTahunBaru,
          mkgBulanBaru: rencana.mkgBulanBaru,
          tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
        },
      );
      diselaraskan.push(k.id);
    } catch {
      // Golongan atau TMT yang tidak terbaca dibiarkan; Tim SDM memperbaikinya lewat Proses KGB.
    }
  }

  logAudit({
    userId: pengguna.id,
    aksi: "kenaikan_pangkat",
    targetNama: pegawai.nama,
    detail:
      `Kenaikan pangkat ${JENIS_KP[jenisKp]} ${pegawai.nama} (${pegawai.nip}), ` +
      `Gol. ${pegawai.golonganRuang} → ${hasil.golonganBaru}, MKG ${pegawai.mkgTahun ?? 0} thn → ${hasil.mkgTahunBaru} thn` +
      `${hasil.potonganMkgTahun > 0 ? ` (dipotong ${hasil.potonganMkgTahun} tahun)` : ""}, ` +
      `Gaji Rp ${(pegawai.gajiPokok ?? 0).toLocaleString("id-ID")} → Rp ${hasil.gajiPokokBaru.toLocaleString("id-ID")}, SK ${nomorSK}`,
  });

  return NextResponse.json(
    {
      ok: true,
      hasil: {
        golonganLama: pegawai.golonganRuang,
        golonganBaru: hasil.golonganBaru,
        pangkatBaru: hasil.pangkatBaru,
        mkgTahunBaru: hasil.mkgTahunBaru,
        mkgBulanBaru: hasil.mkgBulanBaru,
        gajiPokokLama: pegawai.gajiPokok ?? 0,
        gajiPokokBaru: hasil.gajiPokokBaru,
        potonganMkgTahun: hasil.potonganMkgTahun,
      },
      kgbDiselaraskan: diselaraskan.length,
      kgbPerluDitinjau: dampak.perluDitinjau.map((k) => ({
        id: k.id,
        status: k.status,
        tmtKgbBaru: isoTanggalKalender(k.tmtKgbBaru),
        golonganBaru: k.golonganBaru,
        gajiPokokBaru: k.gajiPokokBaru,
      })),
    },
    { status: 201 },
  );
}
