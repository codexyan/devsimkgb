import { NextResponse } from "next/server";
import { sheets, makeRiwayatKGB } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok } from "@/lib/tabelGaji";
import { penetapDariSurat } from "@/lib/penetapSk";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "keuangan" && session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  let isRapelan = false;
  try {
    const body = (await req.json()) as any;
    isRapelan = body.isRapelan === true;
  } catch {
    // body kosong → tidak rapelan
  }

  const kgb = await sheets.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "menunggu_keuangan")
    return NextResponse.json({ error: "KGB tidak dalam status menunggu_keuangan" }, { status: 400 });

  const kgbSelesai = (await sheets.riwayatKGB.update(
    { id },
    {
      status: "selesai",
      konfirmasiKeuanganAt: new Date(),
      konfirmasiKeuanganBy: userLogin.id,
      rapelanDitetapkan: isRapelan,
    },
  ))!;

  // Auto-generate KGB berikutnya
  const pegawai = await sheets.pegawai.findUnique({ id: kgbSelesai.pegawaiId });
  if (pegawai) {
    const tmtNext = new Date(kgbSelesai.tmtKgbBerikutnya as Date);
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

    await sheets.pegawai.update(
      { id: pegawai.id },
      {
        golonganRuang: kgbSelesai.golonganBaru,
        gajiPokok: kgbSelesai.gajiPokokBaru,
        mkgTahun: kgbSelesai.mkgTahunBaru,
        mkgBulan: kgbSelesai.mkgBulanBaru,
        tmtKgbBerikutnya: tmtNext,
      },
    );

    await sheets.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });

    // SK dasar siklus berikutnya adalah surat KGB ini, jadi penetapnya = penandatangan surat ini.
    const suratSelesai = (await sheets.suratKGB.findUnique({ kgbId: kgbSelesai.id })) as Parameters<typeof penetapDariSurat>[0];

    await sheets.riwayatKGB.create(
      makeRiwayatKGB({
        pegawaiId: pegawai.id,
        tanggalSK: tmtNext,
        tmtSK: tmtNext,
        penetapSkDasar: penetapDariSurat(suratSelesai),
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
      }),
    );

    logAudit({
      userId: userLogin.id,
      aksi: "konfirmasi_keuangan",
      detail: `Konfirmasi KGB ${pegawai.nama} (${pegawai.nip}), Gol. ${kgbSelesai.golonganBaru}, Gaji Rp ${kgbSelesai.gajiPokokBaru.toLocaleString("id-ID")}, Rapelan: ${isRapelan ? "Ya" : "Tidak"}`,
      targetNama: pegawai.nama,
    });
  }

  // ── Auto-rekon: cek apakah semua KGB bulan TMT ini sudah dikonfirmasi ──
  const tmtDate = new Date(kgbSelesai.tmtKgbBaru as Date);
  const tmtYear = tmtDate.getFullYear();
  const tmtMonth = tmtDate.getMonth();
  const bulanTmt = `${tmtYear}-${String(tmtMonth + 1).padStart(2, "0")}`;
  const monthLo = new Date(tmtYear, tmtMonth, 1);
  const monthHi = new Date(tmtYear, tmtMonth + 1, 1);

  const allKgb = await sheets.riwayatKGB.findMany();
  const sisa = allKgb.filter(
    (k) => k.status === "menunggu_keuangan" && k.tmtKgbBaru && k.tmtKgbBaru >= monthLo && k.tmtKgbBaru < monthHi,
  ).length;

  if (sisa === 0) {
    const now = new Date();
    const h1Year = tmtMonth === 0 ? tmtYear - 1 : tmtYear;
    const h1Month = tmtMonth === 0 ? 11 : tmtMonth - 1;
    const inWindow =
      now.getFullYear() === h1Year && now.getMonth() === h1Month && now.getDate() >= 1 && now.getDate() <= 15;

    if (inWindow) {
      const already = await sheets.rekonBulanan.findUnique({ bulanTmt });
      if (!already) {
        const jumlah = allKgb.filter(
          (k) => k.konfirmasiKeuanganAt && k.tmtKgbBaru && k.tmtKgbBaru >= monthLo && k.tmtKgbBaru < monthHi,
        ).length;

        await sheets.rekonBulanan.create({
          id: newId(),
          bulanTmt,
          tanggalInput: now,
          inputBy: userLogin.id,
          jumlahData: jumlah,
          catatan: "Otomatis, seluruh KGB bulan ini telah dikonfirmasi",
          createdAt: now,
        });

        const namaBulan = new Date(tmtYear, tmtMonth, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

        logAudit({
          userId: userLogin.id,
          aksi: "rekon_keuangan",
          detail: `Rekap dasar input Sistem Gaji Web, KGB TMT ${namaBulan}, ${jumlah} data (semua KGB bulan ini telah dikonfirmasi)`,
          targetNama: `KGB TMT ${namaBulan}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, autoRekon: sisa === 0 }, { status: 200 });
}
