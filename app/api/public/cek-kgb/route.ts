import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nip = searchParams.get("nip")?.trim();

    if (!nip) {
      return NextResponse.json({ error: "NIP wajib diisi" }, { status: 400 });
    }

    const pegawai = await db.pegawai.findUnique({ nip });
    if (!pegawai || !pegawai.aktif) {
      return NextResponse.json({ error: "Pegawai tidak ditemukan dalam sistem" }, { status: 404 });
    }

    const [riwayatRaw, suratList] = await Promise.all([
      db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id }, orderBy: { field: "tmtKgbBaru", dir: "desc" } }),
      db.suratKGB.findMany() as Promise<any[]>,
    ]);
    const suratByKgb = new Map(suratList.map((sRow) => [sRow.kgbId, sRow]));

    const tahunBerjalan = new Date().getFullYear();

    const kgbTahunIni = riwayatRaw.find((k) => k.tmtKgbBaru && new Date(k.tmtKgbBaru).getFullYear() === tahunBerjalan);
    const kgbAktif =
      kgbTahunIni ??
      riwayatRaw.find(
        (k) => k.status !== "belum_diproses" || (k.tmtKgbBaru && new Date(k.tmtKgbBaru).getFullYear() <= tahunBerjalan),
      ) ??
      null;

    return NextResponse.json({
      nama: pegawai.nama,
      jabatan: pegawai.jabatan,
      golonganRuang: pegawai.golonganRuang,
      unitKerja: pegawai.unitKerja,
      tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya,
      kgbTerbaru: kgbAktif
        ? {
            status: kgbAktif.status,
            tmtKgbBaru: kgbAktif.tmtKgbBaru,
            tmtKgbBerikutnya: kgbAktif.tmtKgbBerikutnya,
            flagRapelan: kgbAktif.flagRapelan,
            nomorSurat: suratByKgb.get(kgbAktif.id)?.nomorSurat ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/public/cek-kgb error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
