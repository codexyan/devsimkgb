import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  // Terima parameter isRapelan dari body
  let isRapelan = false;
  try {
    const body = await req.json() as any;
    isRapelan = body.isRapelan === true;
  } catch {
    // body kosong → tidak rapelan
  }

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id },
    include: { pegawai: true },
  });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "menunggu_keuangan")
    return NextResponse.json({ error: "KGB tidak dalam status menunggu_keuangan" }, { status: 400 });

  const kgbSelesai = await prisma.riwayatKGB.update({
    where: { id },
    data: {
      status: "selesai",
      konfirmasiKeuanganAt: new Date(),
      konfirmasiKeuanganBy: userLogin.id,
      rapelanDitetapkan: isRapelan,
    },
  });

  // Auto-generate KGB berikutnya
  const pegawai = await prisma.pegawai.findUnique({
    where: { id: kgbSelesai.pegawaiId },
  });

  if (pegawai) {
    const tmtNext = new Date(kgbSelesai.tmtKgbBerikutnya);
    const tmtNextBerikutnya = new Date(tmtNext);
    tmtNextBerikutnya.setFullYear(tmtNextBerikutnya.getFullYear() + 2);

    const nextMkgTahunLama = kgbSelesai.mkgTahunBaru;
    const nextMkgBulanLama = kgbSelesai.mkgBulanBaru;
    const nextGolonganLama = kgbSelesai.golonganBaru;
    const nextGajiPokokLama = kgbSelesai.gajiPokokBaru;

    const nextMkgTahunBaru = nextMkgTahunLama + 2;
    const nextMkgBulanBaru = nextMkgBulanLama;
    const nextGajiPokokBaru = getGajiPokok(nextGolonganLama, nextMkgTahunBaru, nextMkgBulanBaru);

    const today = new Date();
    const deadlineSDM = new Date(tmtNext.getFullYear(), tmtNext.getMonth() - 1, 0);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const flagRapelan = todayDate > deadlineSDM;

    await prisma.pegawai.update({
      where: { id: pegawai.id },
      data: {
        golonganRuang: kgbSelesai.golonganBaru,
        gajiPokok: kgbSelesai.gajiPokokBaru,
        mkgTahun: kgbSelesai.mkgTahunBaru,
        mkgBulan: kgbSelesai.mkgBulanBaru,
        tmtKgbBerikutnya: tmtNext,
      },
    });

    await prisma.riwayatKGB.deleteMany({
      where: { pegawaiId: pegawai.id, status: "belum_diproses" },
    });

    await prisma.riwayatKGB.create({
      data: {
        pegawaiId: pegawai.id,
        nomorSK: "",
        tanggalSK: tmtNext,
        tmtSK: tmtNext,
        golonganLama: nextGolonganLama,
        gajiPokokLama: nextGajiPokokLama,
        mkgTahunLama: nextMkgTahunLama,
        mkgBulanLama: nextMkgBulanLama,
        golonganBaru: nextGolonganLama,
        gajiPokokBaru: nextGajiPokokBaru,
        mkgTahunBaru: nextMkgTahunBaru,
        mkgBulanBaru: nextMkgBulanBaru,
        tmtKgbBaru: tmtNext,
        tmtKgbBerikutnya: tmtNextBerikutnya,
        status: "belum_diproses",
        flagRapelan,
        createdBy: userLogin.id,
      },
    });

    logAudit({
      userId: userLogin.id,
      aksi: "konfirmasi_keuangan",
      detail: `Konfirmasi KGB ${pegawai.nama} (${pegawai.nip}), Gol. ${kgbSelesai.golonganBaru}, Gaji Rp ${kgbSelesai.gajiPokokBaru.toLocaleString("id-ID")}, Rapelan: ${isRapelan ? "Ya" : "Tidak"}`,
      targetNama: pegawai.nama,
    });
  }

  // ── Auto-rekon: cek apakah semua KGB bulan TMT ini sudah dikonfirmasi ──
  const tmtDate  = new Date(kgbSelesai.tmtKgbBaru);
  const tmtYear  = tmtDate.getFullYear();
  const tmtMonth = tmtDate.getMonth(); // 0-indexed
  const bulanTmt = `${tmtYear}-${String(tmtMonth + 1).padStart(2, "0")}`;

  const sisa = await prisma.riwayatKGB.count({
    where: {
      status: "menunggu_keuangan",
      tmtKgbBaru: {
        gte: new Date(tmtYear, tmtMonth, 1),
        lt:  new Date(tmtYear, tmtMonth + 1, 1),
      },
    },
  });

  if (sisa === 0) {
    // Semua selesai, cek apakah dalam window rekon (1–15 bulan H-1)
    const now      = new Date();
    const h1Year   = tmtMonth === 0 ? tmtYear - 1 : tmtYear;
    const h1Month  = tmtMonth === 0 ? 11 : tmtMonth - 1; // 0-indexed
    const inWindow =
      now.getFullYear() === h1Year &&
      now.getMonth()    === h1Month &&
      now.getDate() >= 1 && now.getDate() <= 15;

    if (inWindow) {
      const already = await prisma.rekonBulanan.findUnique({ where: { bulanTmt } });
      if (!already) {
        const jumlah = await prisma.riwayatKGB.count({
          where: {
            konfirmasiKeuanganAt: { not: null },
            tmtKgbBaru: {
              gte: new Date(tmtYear, tmtMonth, 1),
              lt:  new Date(tmtYear, tmtMonth + 1, 1),
            },
          },
        });

        await prisma.rekonBulanan.create({
          data: {
            bulanTmt,
            tanggalInput: now,
            inputBy:      userLogin.id,
            jumlahData:   jumlah,
            catatan:      "Otomatis, seluruh KGB bulan ini telah dikonfirmasi",
          },
        });

        const namaBulan = new Date(tmtYear, tmtMonth, 1).toLocaleDateString("id-ID", {
          month: "long", year: "numeric",
        });

        logAudit({
          userId:     userLogin.id,
          aksi:       "rekon_keuangan",
          detail:     `Rekap dasar input Sistem Gaji Web, KGB TMT ${namaBulan}, ${jumlah} data (semua KGB bulan ini telah dikonfirmasi)`,
          targetNama: `KGB TMT ${namaBulan}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, autoRekon: sisa === 0 }, { status: 200 });
}
