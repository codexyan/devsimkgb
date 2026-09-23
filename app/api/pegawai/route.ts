import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB, type PegawaiRow } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis, canEditPegawai } from "@/lib/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { bacaIsianPegawai, bacaTanggal, teksAtauNull } from "@/lib/dataPegawai";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { rencanaSiklusBerikutnya, type RencanaSiklusKgb } from "@/lib/jadwalKgb";
import { bulanKeKgbBerikutnya, tambahBulan } from "@/lib/tabelGaji";
import { hariIniWita } from "@/lib/waktu";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await muatBatasInputSdm();
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Data pribadi dan hukdis pegawai tidak dipakai halaman keuangan.
    if (!NON_KEUANGAN.includes(session.user.role ?? ""))
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    // where dibangun kondisional agar OR tidak disertakan saat tanpa pencarian.
    const where: Record<string, unknown> = {
      aktif: status === "nonaktif" ? false : true,
    };
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nip: { contains: search } },
        { jabatan: { contains: search } },
        { unitKerja: { contains: search } },
      ];
    }

    const pegawai = await db.pegawai.findMany({
      where,
      orderBy: { field: "nama", dir: "asc" },
    });

    // Status KGB terkini (record aktif terbaru per pegawai), pengganti `include`.
    const allKgb = await db.riwayatKGB.findMany({ where: { isArsip: false } });
    const latestByPegawai = new Map<string, { status: string; t: number }>();
    for (const k of allKgb) {
      const t = k.createdAt?.getTime() ?? 0;
      const prev = latestByPegawai.get(k.pegawaiId);
      if (!prev || t > prev.t) latestByPegawai.set(k.pegawaiId, { status: k.status, t });
    }

    // Hukdis yang sudah lewat tanggal berakhirnya dibaca tidak aktif; penanda di data pegawai
    // diselaraskan oleh cron harian, bukan oleh GET.
    const hariIni = hariIniWita();
    const withKgb = pegawai.map((p) => {
      const kgb = latestByPegawai.get(p.id);
      return { ...penandaHukdisBerlaku(p, hariIni), statusKGB: kgb?.status ?? null };
    });

    const role = session.user.role!;
    const data = canManageHukdis(role)
      ? withKgb
      : withKgb.map((p) => ({ ...p, jenisHukdis: null, keteranganHukdis: null }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/pegawai error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canEditPegawai(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const hasil = bacaIsianPegawai(body, { denganNip: true });
  if (hasil.galat !== undefined)
    return NextResponse.json({ error: hasil.galat }, { status: 400 });
  const isian = hasil.data;

  // Penanda hukdis hanya diisi pengelola hukdis; peran lain mencatat hukdis lewat Riwayat Hukdis.
  const bolehHukdis = canManageHukdis(session.user.role!);
  const tanggalHukdisBerakhir = bacaTanggal(body.tanggalHukdisBerakhir);
  if (bolehHukdis && tanggalHukdisBerakhir.status === "tidak_valid")
    return NextResponse.json({ error: "Tanggal berakhir hukuman disiplin tidak valid." }, { status: 400 });

  const existing = await db.pegawai.findUnique({ nip: isian.nip });
  if (existing)
    return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 409 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const now = new Date();
  const pegawai: PegawaiRow = {
    id: newId(),
    ...isian,
    // Konfirmasi data oleh UPT belum ada saat pegawai dibuat.
    konfirmasiUptTmt: null,
    konfirmasiUptAt: null,
    konfirmasiUptOleh: null,
    // Tanpa TMT terakhir, masa kerja sekarang dianggap dicapai satu langkah tabel gaji sebelum TMT berikutnya.
    tmtKgbTerakhir:
      isian.tmtKgbTerakhir ??
      tambahBulan(isian.tmtKgbBerikutnya, -bulanKeKgbBerikutnya(isian.golonganRuang, isian.mkgTahun, isian.mkgBulan)),
    statusHukdis: bolehHukdis && (body.statusHukdis === true || body.statusHukdis === "true"),
    tanggalHukdisBerakhir: bolehHukdis && tanggalHukdisBerakhir.status === "valid" ? tanggalHukdisBerakhir.tanggal : null,
    jenisHukdis: bolehHukdis ? teksAtauNull(body.jenisHukdis) : null,
    keteranganHukdis: bolehHukdis ? teksAtauNull(body.keteranganHukdis) : null,
    aktif: true,
    createdAt: now,
    updatedAt: now,
  };

  // Jadwal KGB pertama dihitung sebelum menulis agar data pegawai tidak tersimpan tanpa jadwal.
  let rencana: RencanaSiklusKgb;
  try {
    rencana = rencanaSiklusBerikutnya(pegawai);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Jadwal KGB tidak dapat dihitung" }, { status: 400 });
  }

  await db.pegawai.create(pegawai);
  await db.riwayatKGB.create(makeRiwayatKGB({ pegawaiId: pegawai.id, createdBy: userLogin.id, ...rencana }));

  logAudit({
    userId: userLogin.id,
    aksi: "tambah_pegawai",
    detail: `Tambah pegawai baru: ${pegawai.nama} (${pegawai.nip}), ${pegawai.jabatan}, ${pegawai.golonganRuang}, ${pegawai.unitKerja}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json(pegawai, { status: 201 });
}
