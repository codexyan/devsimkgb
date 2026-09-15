import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { kalkulasiKGB } from "@/lib/tabelGaji";
import { isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/pegawai/backfill-kgb
 * Buat RiwayatKGB untuk semua pegawai aktif yang belum punya riwayat.
 */
export async function POST() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin || !isSuperAdmin(userLogin.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [allPegawai, allKgb] = await Promise.all([
    db.pegawai.findMany(),
    db.riwayatKGB.findMany(),
  ]);
  const pegawaiWithKgb = new Set(allKgb.map((k) => k.pegawaiId));
  const pegawaiTanpaKGB = allPegawai.filter((p) => p.aktif && !pegawaiWithKgb.has(p.id));

  let berhasil = 0;
  let gagal = 0;
  const errors: string[] = [];
  const today = new Date();

  for (const pegawai of pegawaiTanpaKGB) {
    try {
      const hasil = kalkulasiKGB({
        golonganRuang: pegawai.golonganRuang,
        mkgTahun: pegawai.mkgTahun,
        mkgBulan: pegawai.mkgBulan,
        tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya as Date,
        tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
      });
      const deadlineSDM = new Date(hasil.tmtKgbBaru.getFullYear(), hasil.tmtKgbBaru.getMonth() - 1, 0);
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const flagRapelan = todayDate > deadlineSDM;

      await db.riwayatKGB.create(
        makeRiwayatKGB({
          pegawaiId: pegawai.id,
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
        }),
      );
      berhasil++;
    } catch {
      gagal++;
      errors.push(`${pegawai.nama} (${pegawai.nip}): gagal`);
    }
  }

  return NextResponse.json({ total: pegawaiTanpaKGB.length, berhasil, gagal, errors });
}
