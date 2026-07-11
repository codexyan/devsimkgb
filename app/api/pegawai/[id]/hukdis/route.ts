import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";
import { canManageHukdis } from "@/lib/auth";

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
  const list = await prisma.riwayatHukdis.findMany({
    where: { pegawaiId: id },
    orderBy: { tmtMulai: "desc" },
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
  const body = await req.json() as any;

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const pegawai = await prisma.pegawai.findUnique({ where: { id: pegawaiId } });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  // Baca konfigurasi jenis dari master HukdisJenis SEBAGAI DEFAULT saja.
  // Keputusan final (apa, berapa lama, dasar hukum) ada di tangan PIC Hukdis
  // dan dikirim dari form; config jenis hanya menyarankan nilai awal.
  const jenisConfig = await prisma.hukdisJenis.findUnique({ where: { kode: body.jenisHukdis } });

  const berdampakKGB: boolean =
    typeof body.berdampakKGB === "boolean"
      ? body.berdampakKGB
      : (jenisConfig?.berdampakKGB ?? (body.jenisHukdis === "penundaan_kgb"));

  // Penundaan KGB (bulan) ditetapkan PIC; fallback ke default jenis, lalu 12.
  const durasiTundaInput = Number(body.durasiTunda);
  const durasiTunda: number | null = berdampakKGB
    ? (Number.isFinite(durasiTundaInput) && durasiTundaInput > 0
        ? Math.round(durasiTundaInput)
        : (jenisConfig?.durasiTunda ?? 12))
    : null;

  // Dasar hukum SNAPSHOT: yang diketik PIC menang; fallback ke default jenis.
  const dasarHukum: string | null =
    (typeof body.dasarHukum === "string" && body.dasarHukum.trim())
      ? body.dasarHukum.trim()
      : (jenisConfig?.dasarHukum ?? null);

  // Hitung tmtKgbBerikutnya baru, digeser sesuai durasiTunda dari konfigurasi
  const tmtKgbBerikutnnyaBaru = berdampakKGB
    ? new Date(pegawai.tmtKgbBerikutnya.getFullYear(), pegawai.tmtKgbBerikutnya.getMonth() + (durasiTunda ?? 12), pegawai.tmtKgbBerikutnya.getDate())
    : pegawai.tmtKgbBerikutnya;

  const [hukdis] = await prisma.$transaction([
    prisma.riwayatHukdis.create({
      data: {
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
        createdBy: userLogin.id,
      },
    }),
    prisma.pegawai.update({
      where: { id: pegawaiId },
      data: {
        statusHukdis: true,
        tanggalHukdisBerakhir: new Date(body.tmtBerakhir),
        jenisHukdis: body.jenisHukdis,
        keteranganHukdis: body.keterangan || null,
        ...(berdampakKGB ? { tmtKgbBerikutnya: tmtKgbBerikutnnyaBaru } : {}),
      },
    }),
  ]);

  // Sinkronisasi riwayatKGB placeholder agar selaras dengan TMT baru
  if (berdampakKGB) {
    const newTmt = tmtKgbBerikutnnyaBaru;
    const newTmtBerikutnya = new Date(newTmt.getFullYear() + 2, newTmt.getMonth(), newTmt.getDate());
    // PP No. 53/2010: masa penundaan dihitung penuh → MKG +2 (normal) +1 (penundaan) = +3
    const mkgTahunBaru = pegawai.mkgTahun + 2 + (durasiTunda! / 12);
    const gajiPokokBaru = getGajiPokok(pegawai.golonganRuang, mkgTahunBaru, pegawai.mkgBulan);
    const today = new Date();
    const deadlineNew = new Date(newTmt.getFullYear(), newTmt.getMonth() - 1, 0);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const flagRapelan = todayDate > deadlineNew;

    await prisma.riwayatKGB.deleteMany({ where: { pegawaiId, status: "belum_diproses" } });
    await prisma.riwayatKGB.create({
      data: {
        pegawaiId,
        nomorSK: "",
        tanggalSK: newTmt,
        tmtSK: newTmt,
        golonganLama: pegawai.golonganRuang,
        gajiPokokLama: pegawai.gajiPokok,
        mkgTahunLama: pegawai.mkgTahun,
        mkgBulanLama: pegawai.mkgBulan,
        golonganBaru: pegawai.golonganRuang,
        gajiPokokBaru,
        mkgTahunBaru,
        mkgBulanBaru: pegawai.mkgBulan,
        tmtKgbBaru: newTmt,
        tmtKgbBerikutnya: newTmtBerikutnya,
        status: "belum_diproses",
        flagRapelan,
        createdBy: userLogin.id,
      },
    });
  }

  logAudit({
    userId: userLogin.id,
    aksi: "input_hukdis",
    detail: `Hukdis ${jenisConfig?.label ?? body.jenisHukdis} untuk ${pegawai.nama} (${pegawai.nip})${berdampakKGB ? `, TMT KGB digeser ${durasiTunda} bulan` : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json(hukdis, { status: 201 });
}
