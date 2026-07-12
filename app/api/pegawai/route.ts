import { NextResponse } from "next/server";
import { sheets, type PegawaiRow } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis, canEditPegawai } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Auto clear hukdis yang sudah berakhir.
    await sheets.pegawai.updateMany(
      { statusHukdis: true, tanggalHukdisBerakhir: { lt: new Date() } },
      { statusHukdis: false, tanggalHukdisBerakhir: null, jenisHukdis: null },
    );

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

    const pegawai = await sheets.pegawai.findMany({
      where,
      orderBy: { field: "nama", dir: "asc" },
    });

    // Status KGB terkini (record aktif terbaru per pegawai) — pengganti `include`.
    const allKgb = await sheets.riwayatKGB.findMany({ where: { isArsip: false } });
    const latestByPegawai = new Map<string, { id: string; status: string; t: number }>();
    for (const k of allKgb) {
      const t = k.createdAt?.getTime() ?? 0;
      const prev = latestByPegawai.get(k.pegawaiId);
      if (!prev || t > prev.t) latestByPegawai.set(k.pegawaiId, { id: k.id, status: k.status, t });
    }

    const withKgb = pegawai.map((p) => {
      const kgb = latestByPegawai.get(p.id);
      return { ...p, statusKGB: kgb?.status ?? null, kgbId: kgb?.id ?? null };
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
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canEditPegawai(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = (await req.json()) as any;

  const existing = await sheets.pegawai.findUnique({ nip: body.nip });
  if (existing)
    return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 400 });

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const now = new Date();
  const tmtKgbBerikutnya = new Date(body.tmtKgbBerikutnya);
  const tmtKgbTerakhir = body.tmtKgbTerakhir
    ? new Date(body.tmtKgbTerakhir)
    : (() => { const dd = new Date(body.tmtKgbBerikutnya); dd.setFullYear(dd.getFullYear() - 2); return dd; })();

  const pegawai: PegawaiRow = {
    id: newId(),
    nip: body.nip,
    nama: body.nama,
    tempatLahir: body.tempatLahir || null,
    tanggalLahir: body.tanggalLahir ? new Date(body.tanggalLahir) : null,
    jenisKelamin: body.jenisKelamin || null,
    pendidikanTerakhir: body.pendidikanTerakhir || null,
    jabatan: body.jabatan,
    pangkat: body.pangkat,
    golonganRuang: body.golonganRuang,
    unitKerja: body.unitKerja,
    eselon: body.eselon || null,
    jenisJabatan: body.jenisJabatan || null,
    tmtGolongan: new Date(body.tmtGolongan),
    mkgTahun: parseInt(body.mkgTahun) || 0,
    mkgBulan: parseInt(body.mkgBulan) || 0,
    gajiPokok: parseInt(body.gajiPokok),
    tmtKgbTerakhir,
    tmtKgbBerikutnya,
    statusHukdis: body.statusHukdis || false,
    tanggalHukdisBerakhir: body.tanggalHukdisBerakhir ? new Date(body.tanggalHukdisBerakhir) : null,
    jenisHukdis: body.jenisHukdis || null,
    keteranganHukdis: body.keteranganHukdis || null,
    aktif: true,
    createdAt: now,
    updatedAt: now,
  };

  await sheets.pegawai.create(pegawai);

  // Auto-create KGB pertama.
  const { kalkulasiKGB } = await import("@/lib/tabelGaji");
  const hasil = kalkulasiKGB({
    golonganRuang: pegawai.golonganRuang,
    mkgTahun: pegawai.mkgTahun,
    mkgBulan: pegawai.mkgBulan,
    tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya!,
    tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
  });
  const today = new Date();
  const deadlineSDM = new Date(hasil.tmtKgbBaru.getFullYear(), hasil.tmtKgbBaru.getMonth() - 1, 0);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const flagRapelan = todayDate > deadlineSDM;

  await sheets.riwayatKGB.create({
    id: newId(),
    pegawaiId: pegawai.id,
    nomorSK: "",
    tanggalSK: new Date(hasil.tmtKgbBaru),
    tmtSK: new Date(hasil.tmtKgbBaru),
    golonganLama: pegawai.golonganRuang,
    gajiPokokLama: pegawai.gajiPokok,
    mkgTahunLama: pegawai.mkgTahun,
    mkgBulanLama: pegawai.mkgBulan,
    golonganBaru: pegawai.golonganRuang,
    gajiPokokBaru: hasil.gajiPokokBaru,
    mkgTahunBaru: hasil.mkgTahunBaru,
    mkgBulanBaru: hasil.mkgBulanBaru,
    tmtKgbBaru: hasil.tmtKgbBaru,
    tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
    status: "belum_diproses",
    flagRapelan,
    isArsip: false,
    konfirmasiKeuanganAt: null,
    konfirmasiKeuanganBy: null,
    rapelanDitetapkan: null,
    inputGajiWebAt: null,
    inputGajiWebBy: null,
    createdBy: userLogin.id,
    createdAt: new Date(),
  });

  logAudit({
    userId: userLogin.id,
    aksi: "tambah_pegawai",
    detail: `Tambah pegawai baru: ${pegawai.nama} (${pegawai.nip}), ${pegawai.jabatan}, ${pegawai.golonganRuang}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json(pegawai, { status: 201 });
}
