import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB, type PegawaiRow, type RiwayatKGBRow } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canEditPegawai, canManageHukdis } from "@/lib/auth";
import { bacaIsianPegawai, teksAtauNull, teksIsian } from "@/lib/dataPegawai";
import { rencanaSiklusBerikutnya } from "@/lib/jadwalKgb";
import { bulanKeKgbBerikutnya, tambahBulan } from "@/lib/tabelGaji";
import { hariIniWita } from "@/lib/waktu";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canEditPegawai(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let rows: unknown;
  try {
    rows = ((await req.json()) as { rows?: unknown }).rows;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada data untuk diimport" }, { status: 400 });
  }

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  // Kuota Sheets API terbatas (±60 tulis/menit), sehingga import dikerjakan BATCH:
  // satu kali baca daftar NIP terdaftar, satu append Pegawai, satu append
  // RiwayatKGB. Per-baris create dulu membuat import besar kena 429.
  const terdaftar = new Set((await db.pegawai.findMany()).map((p) => p.nip));
  const hariIni = hariIniWita();
  // Kolom hukdis di berkas hanya dipakai bila pengimpor mengelola hukdis (Super Admin); peran lain
  // mencatat hukdis lewat Riwayat Hukdis.
  const bolehHukdis = canManageHukdis(session.user.role!);

  const results = { berhasil: 0, gagal: 0, errors: [] as string[] };
  const pegawaiBatch: PegawaiRow[] = [];
  const riwayatBatch: RiwayatKGBRow[] = [];

  // Setiap baris diperiksa sendiri; baris yang salah dicatat dan baris lain tetap diproses.
  for (const [indeks, mentah] of rows.entries()) {
    const row: Record<string, unknown> = mentah && typeof mentah === "object" ? (mentah as Record<string, unknown>) : {};
    const nipTeks = teksIsian(row.nip).replace(/^="(.*)"$/, "$1").trim();
    const identitas = `Data ke-${indeks + 1}, NIP ${nipTeks || "-"} (${teksIsian(row.nama) || "-"})`;
    try {
      const hasil = bacaIsianPegawai(row, { denganNip: true });
      if (hasil.galat !== undefined) {
        results.gagal++;
        results.errors.push(`${identitas}: ${hasil.galat}`);
        continue;
      }
      const isian = hasil.data;

      if (terdaftar.has(isian.nip)) {
        results.gagal++;
        results.errors.push(`${identitas}: NIP sudah terdaftar, dilewati`);
        continue;
      }

      const now = new Date();
      const pegawai: PegawaiRow = {
        id: newId(),
        ...isian,
        // Konfirmasi data oleh UPT belum ada saat pegawai dibuat.
        konfirmasiUptTmt: null,
        konfirmasiUptAt: null,
        konfirmasiUptOleh: null,
        // Tanpa TMT terakhir, masa kerja sekarang dianggap dicapai satu langkah tabel gaji sebelum TMT berikutnya.
        tmtKgbTerakhir:
          isian.tmtKgbTerakhir ??
          tambahBulan(isian.tmtKgbBerikutnya, -bulanKeKgbBerikutnya(isian.golonganRuang, isian.mkgTahun, isian.mkgBulan)),
        statusHukdis: bolehHukdis && (row.statusHukdis === true || teksIsian(row.statusHukdis).toLowerCase() === "true"),
        tanggalHukdisBerakhir: null,
        jenisHukdis: null,
        keteranganHukdis: bolehHukdis ? teksAtauNull(row.keteranganHukdis) : null,
        aktif: true,
        createdAt: now,
        updatedAt: now,
      };

      // Jadwal KGB pertama dihitung sebelum baris dimasukkan ke batch agar pegawai tidak tersimpan tanpa jadwal.
      const rencana = rencanaSiklusBerikutnya({ ...pegawai, hariIni });

      terdaftar.add(pegawai.nip); // tolak duplikat di dalam file yang sama
      pegawaiBatch.push(pegawai);
      riwayatBatch.push(makeRiwayatKGB({ pegawaiId: pegawai.id, createdBy: userLogin.id, ...rencana }));
      results.berhasil++;
    } catch (e) {
      results.gagal++;
      const pesan = e instanceof Error ? e.message : "data tidak valid";
      results.errors.push(`${identitas}: gagal diproses, ${pesan}`);
    }
  }

  // Tulis sekaligus: 2 request append, berapa pun jumlah barisnya.
  try {
    await db.pegawai.createMany(pegawaiBatch);
    try {
      await db.riwayatKGB.createMany(riwayatBatch);
    } catch (e) {
      const pesan = e instanceof Error ? e.message : "unknown";
      results.errors.push(
        `Pegawai tersimpan, tetapi pembuatan jadwal KGB Belum Diproses gagal: ${pesan}. Simpan ulang data pegawai terkait dari halaman Data Pegawai.`,
      );
    }
  } catch (e) {
    results.gagal += results.berhasil;
    results.berhasil = 0;
    const pesan = e instanceof Error ? e.message : "unknown";
    results.errors.push(`Gagal menulis ke penyimpanan data: ${pesan}. Tidak ada baris baru yang tersimpan, silakan coba lagi.`);
  }

  if (results.berhasil > 0) {
    logAudit({
      userId: userLogin.id,
      aksi: "import_pegawai",
      detail: `Import pegawai: ${results.berhasil} berhasil, ${results.gagal} gagal dari ${rows.length} data`,
    });
  }

  return NextResponse.json(results);
}
