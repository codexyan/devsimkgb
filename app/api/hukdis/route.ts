import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";

// GET /api/hukdis — daftar SELURUH catatan hukuman disiplin lintas pegawai
// (modul Hukdis mandiri). Hanya Super Admin & SDM Hukdis.
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const [rows, jenisList] = await Promise.all([
      prisma.riwayatHukdis.findMany({
        orderBy: { tmtMulai: "desc" },
        include: {
          pegawai: { select: { id: true, nama: true, nip: true, jabatan: true, golonganRuang: true, aktif: true } },
        },
      }),
      prisma.hukdisJenis.findMany({ select: { kode: true, label: true, kategori: true, dasarHukum: true } }),
    ]);

    const jenisMap = new Map(jenisList.map((j) => [j.kode, j]));
    const now = Date.now();

    const data = rows.map((r) => {
      const j = jenisMap.get(r.jenisHukdis);
      return {
        id: r.id,
        pegawai: r.pegawai,
        jenisHukdis: r.jenisHukdis,
        jenisLabel: j?.label ?? r.jenisHukdis,
        kategori: j?.kategori ?? "-",
        nomorSK: r.nomorSK,
        tanggalSK: r.tanggalSK.toISOString(),
        tmtMulai: r.tmtMulai.toISOString(),
        tmtBerakhir: r.tmtBerakhir.toISOString(),
        berdampakKGB: r.berdampakKGB,
        durasiTunda: r.durasiTunda,
        // Dasar hukum snapshot per catatan; fallback ke config jenis saat ini
        // hanya untuk catatan lama yang belum punya snapshot.
        dasarHukum: r.dasarHukum ?? j?.dasarHukum ?? null,
        keterangan: r.keterangan,
        createdAt: r.createdAt.toISOString(),
        aktif: r.tmtBerakhir.getTime() >= now,
      };
    });

    // Ringkasan untuk kartu statistik
    const aktif = data.filter((d) => d.aktif);
    const summary = {
      total: data.length,
      aktif: aktif.length,
      ringan: aktif.filter((d) => d.kategori === "ringan").length,
      sedang: aktif.filter((d) => d.kategori === "sedang").length,
      berat: aktif.filter((d) => d.kategori === "berat").length,
      berdampakKGB: aktif.filter((d) => d.berdampakKGB).length,
    };

    return NextResponse.json({ data, summary });
  } catch (err) {
    console.error("GET /api/hukdis error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
