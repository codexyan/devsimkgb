import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { bolehUnduhSkUpt, pegawaiSatker, satkerAkunUpt } from "@/lib/aksesUpt";
import { SATKER } from "@/lib/satker";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";

export const runtime = "nodejs";

/*
 * Riwayat KGB satu satker, untuk modul Riwayat Admin UPT.
 *
 * Dipisah dari GET /api/upt dengan sengaja. Daftar `sk` di sana adalah antrian kerja: hanya KGB yang
 * berstatus menunggu_keuangan atau selesai, tanpa arsip, dan dipotong 60 baris. Riwayat justru butuh
 * yang sebaliknya — seluruh siklus setiap pegawai, termasuk arsip (SK yang terbit di luar SIM-KGB) dan
 * yang dibatalkan — sehingga menumpangkannya di rute dasbor hanya akan memperberat muatan yang dibaca
 * setiap kali dasbor dibuka.
 *
 * Batas aksesnya sama dengan rute UPT lain (lib/aksesUpt.ts): satker dibaca dari baris pengguna di basis
 * data, bukan dari token, dan hanya pegawai satker itu yang ikut. Jalur berkas SK tidak pernah dikirim;
 * pengunduhannya lewat /api/upt/sk/[id] yang memeriksa izinnya sendiri.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pengguna = session.user.nip ? await db.user.findUnique({ nip: session.user.nip }) : null;
  const kode = pengguna ? satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker }) : null;
  if (!kode)
    return NextResponse.json(
      { error: "Akun ini bukan Admin UPT atau belum ditautkan ke satker. Hubungi Super Admin." },
      { status: 403 },
    );
  const satker = SATKER.find((s) => s.kode === kode)!;

  const [semuaPegawai, semuaKgb, semuaSurat] = await Promise.all([
    db.pegawai.findMany(),
    db.riwayatKGB.findMany(),
    db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
  ]);

  const milikSatker = pegawaiSatker(semuaPegawai, kode);
  const pegawaiById = new Map(milikSatker.map((p) => [p.id, p]));
  const suratByKgb = new Map(semuaSurat.map((s) => [s.kgbId, s]));

  const kgb = semuaKgb
    .filter((k) => pegawaiById.has(k.pegawaiId))
    .map((k) => {
      const p = pegawaiById.get(k.pegawaiId)!;
      const surat = suratByKgb.get(k.id);
      return {
        id: k.id,
        pegawaiId: k.pegawaiId,
        status: k.status,
        isArsip: k.isArsip === true,
        nomorSK: k.nomorSK ?? "",
        tmtKgbBaru: isoTanggalKalender(k.tmtKgbBaru),
        golonganLama: k.golonganLama,
        golonganBaru: k.golonganBaru,
        gajiPokokLama: k.gajiPokokLama,
        gajiPokokBaru: k.gajiPokokBaru,
        mkgTahunBaru: k.mkgTahunBaru,
        mkgBulanBaru: k.mkgBulanBaru,
        rapelanDitetapkan: k.rapelanDitetapkan === true,
        nomorSurat: surat?.nomorSurat ?? null,
        tanggalSurat: isoTanggalKalender(surat?.tanggalSurat ?? null),
        // Langkah terakhir yang dipegang UPT: merekam KGB di Gaji Web satkernya sendiri.
        gajiWebAt: k.inputGajiWebAt ? new Date(k.inputGajiWebAt).toISOString() : null,
        // Tombol unduh hanya muncul bila memang boleh diunduh; aturannya sama dengan /api/upt/sk/[id].
        berkasAda: bolehUnduhSkUpt({ kode, kgb: k, pegawai: p, pathFile: surat?.pathFile }),
        pegawai: { nama: p.nama, nip: p.nip, jabatan: p.jabatan ?? "" },
      };
    })
    // Terbaru lebih dulu; pengelompokan per pegawai dikerjakan di layar.
    .sort((a, b) => (b.tmtKgbBaru ?? "").localeCompare(a.tmtKgbBaru ?? ""));

  return NextResponse.json({ satker, pegawaiAktif: milikSatker.filter((p) => p.aktif).length, kgb });
}
