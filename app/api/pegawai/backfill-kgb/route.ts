import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { kalkulasiKGB } from "@/lib/tabelGaji";
import { isSuperAdmin } from "@/lib/auth";

/**
 * POST /api/pegawai/backfill-kgb
 * Satu kali pakai: buat RiwayatKGB untuk semua pegawai aktif yang belum punya riwayat.
 * Hanya bisa dijalankan oleh ADMIN.
 */
export async function POST() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin || !isSuperAdmin(userLogin.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ambil semua pegawai aktif yang belum punya riwayat KGB sama sekali
  const pegawaiTanpaKGB = await prisma.pegawai.findMany({
    where: {
      aktif: true,
      riwayatKGB: { none: {} },
    },
  });

  let berhasil = 0;
  let gagal = 0;
  const errors: string[] = [];

  const today = new Date();

  for (const pegawai of pegawaiTanpaKGB) {
    try {
      const hasil = kalkulasiKGB(pegawai);
      const deadlineSDM = new Date(hasil.tmtKgbBaru.getFullYear(), hasil.tmtKgbBaru.getMonth() - 1, 0);
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const flagRapelan = todayDate > deadlineSDM;

      await prisma.riwayatKGB.create({
        data: {
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
          createdBy: userLogin.id,
        },
      });
      berhasil++;
    } catch {
      gagal++;
      errors.push(`${pegawai.nama} (${pegawai.nip}): gagal`);
    }
  }

  return NextResponse.json({
    total: pegawaiTanpaKGB.length,
    berhasil,
    gagal,
    errors,
  });
}
