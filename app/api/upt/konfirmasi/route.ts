import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { pegawaiSatker, satkerAkunUpt } from "@/lib/aksesUpt";
import { pilihKgbSiklus } from "@/lib/rekapKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";
import { formatTanggalId } from "@/lib/waktu";

export const runtime = "nodejs";

/**
 * Konfirmasi data pegawai oleh admin UPT untuk satu siklus KGB (lib/konfirmasiUpt.ts). Ini satu-satunya
 * penulisan yang boleh dilakukan peran admin_upt: bukan mengubah data pegawai, melainkan menyatakan bahwa
 * masa kerja golongan, gaji pokok dasar, dan status hukuman disiplin pegawai satkernya sudah benar.
 * Tim SDM memakainya sebagai syarat sebelum SK dibuat, sesuai masukan tim keuangan.
 *
 * TMT yang dikonfirmasi ditentukan server dari siklus KGB pegawai, bukan dari kiriman peramban.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const kode = satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker });
  if (!kode)
    return NextResponse.json(
      { error: "Konfirmasi hanya dapat dilakukan akun Admin UPT yang tertaut ke satker." },
      { status: 403 },
    );

  let pegawaiId = "";
  try {
    const body = (await req.json()) as { pegawaiId?: unknown };
    if (typeof body.pegawaiId === "string") pegawaiId = body.pegawaiId.trim();
  } catch {
    // body tidak valid diperlakukan sebagai id kosong
  }
  if (!pegawaiId) return NextResponse.json({ error: "pegawaiId wajib diisi" }, { status: 400 });

  const pegawai = await db.pegawai.findUnique({ id: pegawaiId });
  // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!pegawai || pegawaiSatker([pegawai], kode).length === 0)
    return NextResponse.json({ error: "Pegawai tidak ditemukan di satker ini" }, { status: 404 });
  if (!pegawai.aktif)
    return NextResponse.json({ error: "Pegawai sudah tidak aktif" }, { status: 400 });

  const hariIni = hariIniWita();
  const kgbPegawai = await db.riwayatKGB.findMany({ where: { pegawaiId } });
  const { kgbBerjalan } = pilihKgbSiklus({
    tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya,
    kgb: kgbPegawai,
    hariIni,
    tahun: hariIni.getFullYear(),
  });
  const tmt = tanggalKalender(kgbBerjalan?.tmtKgbBaru) ?? tanggalKalender(pegawai.tmtKgbBerikutnya);
  if (!tmt)
    return NextResponse.json({ error: "Pegawai belum punya jadwal KGB berikutnya" }, { status: 400 });
  if (kgbBerjalan?.status === "selesai")
    return NextResponse.json({ error: "KGB siklus ini sudah selesai dikonfirmasi keuangan" }, { status: 400 });

  const sekarang = new Date();
  await db.pegawai.update(
    { id: pegawaiId },
    { konfirmasiUptTmt: tmt, konfirmasiUptAt: sekarang, konfirmasiUptOleh: `${pengguna.nama} (${pengguna.nip})` },
  );

  logAudit({
    userId: pengguna.id,
    aksi: "konfirmasi_upt",
    detail: `Konfirmasi data UPT ${pegawai.nama} (${pegawai.nip}) untuk TMT KGB ${formatTanggalId(tmt)}: masa kerja golongan, gaji pokok dasar, dan status hukuman disiplin dinyatakan sesuai`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({
    ok: true,
    tmtKgb: tmt.toISOString(),
    konfirmasiAt: sekarang.toISOString(),
    konfirmasiOleh: `${pengguna.nama} (${pengguna.nip})`,
  });
}
