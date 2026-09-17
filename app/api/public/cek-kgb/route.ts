import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { hariIniWita, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";

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
      db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } }),
      db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
    ]);
    const suratByKgb = new Map(suratList.map((sRow) => [sRow.kgbId, sRow]));

    // TMT terbaru lebih dulu; untuk TMT yang sama, record yang dibuat terakhir lebih dulu, sehingga KGB
    // yang diinput ulang atau diarsipkan menggantikan pembatalan sebelumnya tanpa bergantung urutan baris.
    const waktuTmt = (nilai: NilaiTanggal) => tanggalKalender(nilai)?.getTime() ?? 0;
    riwayatRaw.sort(
      (a, b) =>
        waktuTmt(b.tmtKgbBaru) - waktuTmt(a.tmtKgbBaru) || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );

    // Tahun berjalan dan tahun TMT menurut kalender WITA, bukan jam UTC server.
    const tahunBerjalan = hariIniWita().getFullYear();
    const tahunTmt = (nilai: NilaiTanggal) => tanggalKalender(nilai)?.getFullYear() ?? null;

    const kgbTahunIni = riwayatRaw.find((k) => tahunTmt(k.tmtKgbBaru) === tahunBerjalan);
    const kgbAktif =
      kgbTahunIni ??
      riwayatRaw.find((k) => {
        const tahun = tahunTmt(k.tmtKgbBaru);
        return k.status !== "belum_diproses" || (tahun !== null && tahun <= tahunBerjalan);
      }) ??
      // Pegawai yang hanya punya jadwal Belum Diproses untuk TMT tahun berikutnya tetap melihat jadwal itu.
      riwayatRaw.find((k) => k.status === "belum_diproses") ??
      null;

    // Endpoint ini tanpa login, jadi hanya kolom yang ditampilkan halaman /kgb yang dikirim. Permintaan
    // dibatasi per alamat IP di worker-entry.js.
    return NextResponse.json({
      nama: pegawai.nama,
      jabatan: pegawai.jabatan,
      golonganRuang: pegawai.golonganRuang,
      unitKerja: pegawai.unitKerja,
      tmtKgbBerikutnya: isoTanggalKalender(pegawai.tmtKgbBerikutnya),
      kgbTerbaru: kgbAktif
        ? {
            status: kgbAktif.status,
            tmtKgbBaru: isoTanggalKalender(kgbAktif.tmtKgbBaru),
            flagRapelan: kgbAktif.flagRapelan === true,
            nomorSurat: suratByKgb.get(kgbAktif.id)?.nomorSurat ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/public/cek-kgb error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
