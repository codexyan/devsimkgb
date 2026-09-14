import { NextResponse } from "next/server";
import { sheets, makeRiwayatKGB } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";
import { canManageHukdis } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak: hanya SDM Hukdis dan Super Admin" }, { status: 403 });

  const { id } = await params;
  const list = await sheets.riwayatHukdis.findMany({
    where: { pegawaiId: id },
    orderBy: { field: "tmtMulai", dir: "desc" },
  });

  return NextResponse.json(list);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak: hanya SDM Hukdis dan Super Admin" }, { status: 403 });

  const { id: pegawaiId } = await params;
  const body = (await req.json()) as any;

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const pegawai = await sheets.pegawai.findUnique({ id: pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const jenisConfig = (await sheets.hukdisJenis.findUnique({ kode: body.jenisHukdis })) as any;

  const berdampakKGB: boolean =
    typeof body.berdampakKGB === "boolean"
      ? body.berdampakKGB
      : (jenisConfig?.berdampakKGB ?? (body.jenisHukdis === "penundaan_kgb"));

  const durasiTundaInput = Number(body.durasiTunda);
  const durasiTunda: number | null = berdampakKGB
    ? (Number.isFinite(durasiTundaInput) && durasiTundaInput > 0
        ? Math.round(durasiTundaInput)
        : (jenisConfig?.durasiTunda ?? 12))
    : null;

  const dasarHukum: string | null =
    (typeof body.dasarHukum === "string" && body.dasarHukum.trim())
      ? body.dasarHukum.trim()
      : (jenisConfig?.dasarHukum ?? null);

  const tmtKgbLama = pegawai.tmtKgbBerikutnya ? new Date(pegawai.tmtKgbBerikutnya) : new Date();
  const tmtKgbBerikutnnyaBaru = berdampakKGB
    ? new Date(tmtKgbLama.getFullYear(), tmtKgbLama.getMonth() + (durasiTunda ?? 12), tmtKgbLama.getDate())
    : tmtKgbLama;

  // Pengganti $transaction: create + update sekuensial (best-effort).
  const hukdis = {
    id: newId(),
    pegawaiId,
    jenisHukdis: body.jenisHukdis,
    nomorSK: body.nomorSK,
    tanggalSK: new Date(body.tanggalSK),
    tmtMulai: new Date(body.tmtMulai),
    tmtBerakhir: new Date(body.tmtBerakhir),
    berdampakKGB,
    durasiTunda,
    dasarHukum,
    keterangan: body.keterangan || null,
    createdAt: new Date(),
    createdBy: userLogin.id,
  };
  await sheets.riwayatHukdis.create(hukdis);

  await sheets.pegawai.update(
    { id: pegawaiId },
    {
      statusHukdis: true,
      tanggalHukdisBerakhir: new Date(body.tmtBerakhir),
      jenisHukdis: body.jenisHukdis,
      keteranganHukdis: body.keterangan || null,
      ...(berdampakKGB ? { tmtKgbBerikutnya: tmtKgbBerikutnnyaBaru } : {}),
    },
  );

  // Sinkronisasi riwayatKGB placeholder agar selaras dengan TMT baru.
  if (berdampakKGB) {
    const newTmt = tmtKgbBerikutnnyaBaru;
    const newTmtBerikutnya = new Date(newTmt.getFullYear() + 2, newTmt.getMonth(), newTmt.getDate());
    // Masa penundaan ikut dihitung sebagai masa kerja; simpan sebagai tahun dan bulan utuh.
    const totalBulan = pegawai.mkgTahun * 12 + pegawai.mkgBulan + 24 + durasiTunda!;
    const mkgTahunBaru = Math.floor(totalBulan / 12);
    const mkgBulanBaru = totalBulan % 12;
    const gajiPokokBaru = getGajiPokok(pegawai.golonganRuang, mkgTahunBaru, mkgBulanBaru);
    const today = new Date();
    const deadlineNew = new Date(newTmt.getFullYear(), newTmt.getMonth() - 1, 0);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const flagRapelan = todayDate > deadlineNew;

    await sheets.riwayatKGB.deleteMany({ pegawaiId, status: "belum_diproses" });
    await sheets.riwayatKGB.create(
      makeRiwayatKGB({
        pegawaiId,
        tanggalSK: newTmt,
        tmtSK: newTmt,
        golonganLama: pegawai.golonganRuang,
        gajiPokokLama: pegawai.gajiPokok,
        mkgTahunLama: pegawai.mkgTahun,
        mkgBulanLama: pegawai.mkgBulan,
        golonganBaru: pegawai.golonganRuang,
        gajiPokokBaru,
        mkgTahunBaru,
        mkgBulanBaru,
        tmtKgbBaru: newTmt,
        tmtKgbBerikutnya: newTmtBerikutnya,
        status: "belum_diproses",
        flagRapelan,
        createdBy: userLogin.id,
      }),
    );
  }

  logAudit({
    userId: userLogin.id,
    aksi: "input_hukdis",
    detail: `Hukdis ${jenisConfig?.label ?? body.jenisHukdis} untuk ${pegawai.nama} (${pegawai.nip})${berdampakKGB ? `, TMT KGB digeser ${durasiTunda} bulan` : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json(hukdis, { status: 201 });
}
