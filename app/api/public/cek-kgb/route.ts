import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nip = searchParams.get("nip")?.trim();

    if (!nip) {
      return NextResponse.json({ error: "NIP wajib diisi" }, { status: 400 });
    }

    const pegawai = await prisma.pegawai.findUnique({
      where: { nip },
      include: {
        riwayatKGB: {
          orderBy: { tmtKgbBaru: "desc" },
          include: { surat: { select: { nomorSurat: true } } },
        },
      },
    });

    if (!pegawai || !pegawai.aktif) {
      return NextResponse.json(
        { error: "Pegawai tidak ditemukan dalam sistem" },
        { status: 404 },
      );
    }

    const tahunBerjalan = new Date().getFullYear();

    // KGB tahun berjalan = entry yang tmtKgbBaru-nya di tahun ini
    // atau entry aktif terakhir yang sudah selesai/diproses (bukan placeholder masa depan)
    const kgbTahunIni = pegawai.riwayatKGB.find(
      (k) => new Date(k.tmtKgbBaru).getFullYear() === tahunBerjalan,
    );

    // Jika tidak ada yang tepat tahun ini, ambil yang paling terakhir
    // bukan placeholder (bukan belum_diproses dengan tmtKgbBaru di masa depan)
    const kgbAktif =
      kgbTahunIni ??
      pegawai.riwayatKGB.find(
        (k) =>
          k.status !== "belum_diproses" ||
          new Date(k.tmtKgbBaru).getFullYear() <= tahunBerjalan,
      ) ??
      null;

    return NextResponse.json({
      nama: pegawai.nama,
      jabatan: pegawai.jabatan,
      golonganRuang: pegawai.golonganRuang,
      unitKerja: pegawai.unitKerja,
      tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya,
      // Data hukdis (statusHukdis/jenisHukdis) TIDAK boleh diekspos di endpoint
      // publik tanpa auth - rahasia, hanya untuk role sdm_hukdis/superAdminCore.
      kgbTerbaru: kgbAktif
        ? {
            status: kgbAktif.status,
            tmtKgbBaru: kgbAktif.tmtKgbBaru,
            tmtKgbBerikutnya: kgbAktif.tmtKgbBerikutnya,
            flagRapelan: kgbAktif.flagRapelan,
            nomorSurat: kgbAktif.surat?.nomorSurat ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/public/cek-kgb error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 },
    );
  }
}
