import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";
import { hukdisMasihBerlaku } from "@/lib/hukdisKedaluwarsa";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";

export const runtime = "nodejs";

// GET /api/hukdis — daftar SELURUH catatan hukuman disiplin lintas pegawai.
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const [rows, jenisList, pegawaiList] = await Promise.all([
      db.riwayatHukdis.findMany({ orderBy: { field: "tmtMulai", dir: "desc" } }) as Promise<any[]>,
      db.hukdisJenis.findMany() as Promise<any[]>,
      db.pegawai.findMany(),
    ]);

    const jenisMap = new Map(jenisList.map((j) => [j.kode, j]));
    const pegawaiMap = new Map(pegawaiList.map((p) => [p.id, p]));
    // Sama dengan penahanan KGB: tanggal berakhir ikut dihitung (tanggal kalender WITA).
    const hariIni = hariIniWita();

    const data = rows.map((r) => {
      const j = jenisMap.get(r.jenisHukdis);
      const p = pegawaiMap.get(r.pegawaiId);
      return {
        id: r.id,
        pegawai: p
          ? { id: p.id, nama: p.nama, nip: p.nip, jabatan: p.jabatan, golonganRuang: p.golonganRuang, unitKerja: p.unitKerja, aktif: p.aktif }
          : null,
        jenisHukdis: r.jenisHukdis,
        jenisLabel: j?.label ?? r.jenisHukdis,
        kategori: j?.kategori ?? "-",
        nomorSK: r.nomorSK,
        tanggalSK: r.tanggalSK ? new Date(r.tanggalSK).toISOString() : null,
        tmtMulai: r.tmtMulai ? new Date(r.tmtMulai).toISOString() : null,
        tmtBerakhir: r.tmtBerakhir ? new Date(r.tmtBerakhir).toISOString() : null,
        berdampakKGB: r.berdampakKGB,
        durasiTunda: r.durasiTunda,
        dasarHukum: r.dasarHukum ?? j?.dasarHukum ?? null,
        keterangan: r.keterangan,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        aktif: hukdisMasihBerlaku(r.tmtBerakhir, hariIni),
      };
    });

    const aktif = data.filter((d) => d.aktif);
    // Hukdis aktif yang berakhir dalam 30 hari: KGB pegawainya perlu diperiksa setelah hukdis selesai.
    const batas30 = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() + 30);
    const summary = {
      total: data.length,
      aktif: aktif.length,
      ringan: aktif.filter((d) => d.kategori === "ringan").length,
      sedang: aktif.filter((d) => d.kategori === "sedang").length,
      berat: aktif.filter((d) => d.kategori === "berat").length,
      berdampakKGB: aktif.filter((d) => d.berdampakKGB).length,
      berakhir30: aktif.filter((d) => {
        const berakhir = tanggalKalender(d.tmtBerakhir);
        return !!berakhir && berakhir <= batas30;
      }).length,
    };

    return NextResponse.json({ data, summary });
  } catch (err) {
    console.error("GET /api/hukdis error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
