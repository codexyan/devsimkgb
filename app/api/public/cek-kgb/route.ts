import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PESAN_TIDAK_COCOK, cocokTempatLahir, normalisasiTempat, samarkanNama } from "@/lib/cekKgbPublik";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { hariIniWita, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";

export const runtime = "nodejs";

/** Cek lama lewat GET hanya dengan NIP tidak dilayani lagi; halaman yang masih lama diminta dimuat ulang. */
export async function GET() {
  return NextResponse.json(
    { error: "Cek status kini memerlukan NIP dan tempat lahir. Muat ulang halaman, lalu coba lagi." },
    { status: 400 },
  );
}

/**
 * Cek status KGB tanpa login. NIP saja tidak cukup, sebab NIP tercetak di banyak dokumen dan dapat ditebak;
 * tempat lahir menjadi kunci kedua (lib/cekKgbPublik.ts). NIP tak dikenal dan tempat lahir yang salah dijawab
 * sama (404), dan worker-entry.js membatasi percobaan per alamat IP, termasuk yang gagal.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { nip?: unknown; tempatLahir?: unknown };
    const nip = typeof body.nip === "string" ? body.nip.replace(/\s+/g, "") : "";
    const tempatLahir = typeof body.tempatLahir === "string" ? body.tempatLahir : "";

    if (!/^\d{18}$/.test(nip)) return NextResponse.json({ error: "NIP harus 18 angka" }, { status: 400 });
    if (normalisasiTempat(tempatLahir).length < 3)
      return NextResponse.json({ error: "Tempat lahir wajib diisi" }, { status: 400 });

    const pegawai = await db.pegawai.findUnique({ nip });
    if (!pegawai || !pegawai.aktif || !cocokTempatLahir(tempatLahir, pegawai.tempatLahir)) {
      return NextResponse.json({ error: PESAN_TIDAK_COCOK }, { status: 404 });
    }

    const riwayatRaw = await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } });

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

    // Tanpa login, jadi hanya yang perlu untuk mengetahui status KGB: nama disamarkan sebagai tanda NIP-nya benar,
    // status, dan tanggal. Jabatan, golongan, unit kerja, dan nomor SK sengaja tidak dikirim.
    return NextResponse.json(
      {
        namaSamaran: samarkanNama(pegawai.nama),
        tmtKgbBerikutnya: isoTanggalKalender(pegawai.tmtKgbBerikutnya),
        kgbTerbaru: kgbAktif
          ? {
              status: kgbAktif.status,
              tmtKgbBaru: isoTanggalKalender(kgbAktif.tmtKgbBaru),
              flagRapelan: kgbAktif.flagRapelan === true,
            }
          : null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("POST /api/public/cek-kgb error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
