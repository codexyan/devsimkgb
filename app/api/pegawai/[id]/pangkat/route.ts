import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canEditPegawai } from "@/lib/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { JENIS_KP, isJenisKp } from "@/lib/kenaikanPangkat";
import { catatKenaikanPangkat } from "@/lib/catatDasarGaji";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { tanggalKalender } from "@/lib/waktu";
import { tanganiHapusRiwayatKembar, tanganiUbahSkRiwayat } from "@/lib/ubahSkRiwayatRute";
import type { RiwayatPangkatRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/*
 * Kenaikan pangkat satu pegawai (Buku Saku KP 2026; aturannya di lib/kenaikanPangkat.ts).
 *
 * Mencatat SK KP lalu menyesuaikan data gaji pegawai: golongan, pangkat, masa kerja golongan (dipotong bila
 * pindah jenjang), dan gaji pokok dari tabel PP 5/2024. TMT KGB tidak diatur ulang, karena siklus KGB berjalan
 * dari TMT KGB terakhir; yang berubah hanya dasar gajinya. KGB placeholder "belum diproses" ikut diselaraskan,
 * sedangkan KGB yang sudah dikerjakan Tim SDM atau keuangan dikembalikan sebagai daftar "perlu ditinjau" agar
 * Tim SDM memutuskan sendiri: batalkan dan input ulang, atau lanjutkan SK yang sudah dibuat.
 */

function keTanggal(nilai: unknown): Date | null {
  return typeof nilai === "string" && nilai.trim() ? tanggalKalender(nilai) : null;
}

// GET, riwayat kenaikan pangkat pegawai, terbaru dulu.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!NON_KEUANGAN.includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const riwayat = (await db.riwayatPangkat.findMany({ where: { pegawaiId: id } })) as RiwayatPangkatRow[];
  const urut = [...riwayat].sort(
    (a, b) => (tanggalKalender(b.tmtPangkat)?.getTime() ?? 0) - (tanggalKalender(a.tmtPangkat)?.getTime() ?? 0),
  );
  return NextResponse.json(
    urut.map((r) => ({
      id: r.id,
      jenisKp: r.jenisKp,
      jenisLabel: isJenisKp(r.jenisKp) ? JENIS_KP[r.jenisKp] : r.jenisKp,
      nomorSK: r.nomorSK,
      tanggalSK: isoTanggalKalender(r.tanggalSK),
      tmtPangkat: isoTanggalKalender(r.tmtPangkat),
      golonganLama: r.golonganLama,
      golonganBaru: r.golonganBaru,
      mkgTahunLama: r.mkgTahunLama,
      mkgBulanLama: r.mkgBulanLama,
      mkgTahunBaru: r.mkgTahunBaru,
      mkgBulanBaru: r.mkgBulanBaru,
      gajiPokokLama: r.gajiPokokLama,
      gajiPokokBaru: r.gajiPokokBaru,
      keterangan: r.keterangan,
      penetapSK: r.penetapSK ?? null,
    })),
  );
}

// POST, catat kenaikan pangkat dan sesuaikan data gaji pegawai (lib/catatDasarGaji.ts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const pengguna = await penggunaLogin(session);
  if (!pengguna)
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const tanggalSK = keTanggal(body.tanggalSK);
  const tmtPangkat = keTanggal(body.tmtPangkat);
  if (!tanggalSK || !tmtPangkat)
    return NextResponse.json({ error: "Tanggal SK dan TMT pangkat wajib diisi" }, { status: 400 });

  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const hasil = await catatKenaikanPangkat({
    pegawai,
    jenisKp: teks(body.jenisKp),
    golonganBaru: teks(body.golonganBaru),
    nomorSK: teks(body.nomorSK),
    tanggalSK,
    tmtPangkat,
    penetapSK: teks(body.penetapSK),
    keterangan: teks(body.keterangan),
    userId: pengguna.id,
  });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });

  logAudit({ userId: pengguna.id, aksi: "kenaikan_pangkat", targetNama: pegawai.nama, detail: hasil.ringkas });

  return NextResponse.json(
    {
      ok: true,
      hasil: {
        golonganLama: hasil.golonganLama,
        golonganBaru: hasil.golonganBaru,
        pangkatBaru: hasil.pangkatBaru,
        mkgTahunBaru: hasil.mkgTahunBaru,
        mkgBulanBaru: hasil.mkgBulanBaru,
        gajiPokokLama: hasil.gajiPokokLama,
        gajiPokokBaru: hasil.gajiPokokBaru,
        potonganMkgTahun: hasil.potonganMkgTahun,
      },
      kgbDiselaraskan: hasil.kgbDiselaraskan,
      kgbPerluDitinjau: hasil.kgbPerluDitinjau,
    },
    { status: 201 },
  );
}

/** PATCH, betulkan nomor, tanggal, penetap, atau jenis SK pada satu riwayat; salinannya ikut diselaraskan (ADR-068). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tanganiUbahSkRiwayat(req, params, "kp");
}

/** DELETE ?riwayatId=, hapus satu riwayat yang tercatat dua kali; data gaji tidak berubah (ADR-069). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tanganiHapusRiwayatKembar(req, params, "kp");
}
