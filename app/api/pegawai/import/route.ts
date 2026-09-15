import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB, type PegawaiRow, type RiwayatKGBRow } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { getGajiPokok, isGolonganDikenal, kalkulasiKGB } from "@/lib/tabelGaji";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = (await req.json()) as any;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada data untuk diimport" }, { status: 400 });
  }

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });

  // Kuota Sheets API terbatas (±60 tulis/menit) — import dikerjakan BATCH:
  // satu kali baca daftar NIP terdaftar, satu append Pegawai, satu append
  // RiwayatKGB. Per-baris create dulu membuat import besar kena 429.
  const terdaftar = new Set((await db.pegawai.findMany()).map((p) => p.nip));

  const results = { berhasil: 0, gagal: 0, errors: [] as string[] };
  const pegawaiBatch: PegawaiRow[] = [];
  const riwayatBatch: RiwayatKGBRow[] = [];

  for (const row of rows) {
    try {
      row.nip = row.nip?.replace(/^="(.*)"$/, "$1").trim() ?? row.nip;

      if (terdaftar.has(row.nip)) {
        results.gagal++;
        results.errors.push(`NIP ${row.nip} (${row.nama}) sudah terdaftar, dilewati`);
        continue;
      }

      if (!isGolonganDikenal(row.golonganRuang)) {
        results.gagal++;
        results.errors.push(
          `NIP ${row.nip} (${row.nama}): golongan "${row.golonganRuang}" tidak dikenal di tabel gaji PP 5/2024`,
        );
        continue;
      }

      const mkgTahun = parseInt(row.mkgTahun) || 0;
      const mkgBulan = parseInt(row.mkgBulan) || 0;
      const gajiPokokRaw = row.gajiPokok ? parseInt(row.gajiPokok) : null;
      const gajiPokok =
        gajiPokokRaw && !isNaN(gajiPokokRaw) ? gajiPokokRaw : getGajiPokok(row.golonganRuang, mkgTahun, mkgBulan);

      if (!gajiPokok) {
        results.gagal++;
        results.errors.push(`NIP ${row.nip} (${row.nama}): gaji pokok tidak dapat ditentukan dari MKG ${mkgTahun} tahun ${mkgBulan} bulan`);
        continue;
      }

      const now = new Date();
      const tmtKgbBerikutnya = new Date(row.tmtKgbBerikutnya);
      const pegawai: PegawaiRow = {
        id: newId(),
        nip: row.nip,
        nama: row.nama,
        tempatLahir: row.tempatLahir || null,
        tanggalLahir: row.tanggalLahir ? new Date(row.tanggalLahir) : null,
        jenisKelamin: row.jenisKelamin || null,
        pendidikanTerakhir: row.pendidikanTerakhir || null,
        jabatan: row.jabatan,
        pangkat: row.pangkat,
        golonganRuang: row.golonganRuang,
        unitKerja: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
        eselon: row.eselon || null,
        jenisJabatan: null,
        tmtGolongan: new Date(row.tmtGolongan),
        mkgTahun,
        mkgBulan,
        gajiPokok,
        tmtKgbTerakhir: row.tmtKgbTerakhir
          ? new Date(row.tmtKgbTerakhir)
          : (() => { const d = new Date(row.tmtKgbBerikutnya); d.setFullYear(d.getFullYear() - 2); return d; })(),
        tmtKgbBerikutnya,
        statusHukdis: row.statusHukdis === "true" || row.statusHukdis === true,
        tanggalHukdisBerakhir: null,
        jenisHukdis: null,
        keteranganHukdis: row.keteranganHukdis || null,
        aktif: true,
        createdAt: now,
        updatedAt: now,
      };
      terdaftar.add(pegawai.nip); // tolak duplikat di dalam file yang sama
      pegawaiBatch.push(pegawai);

      // Auto-create RiwayatKGB.
      if (userLogin) {
        const hasil = kalkulasiKGB({
          golonganRuang: pegawai.golonganRuang,
          mkgTahun: pegawai.mkgTahun,
          mkgBulan: pegawai.mkgBulan,
          tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya as Date,
          tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
        });
        const today = new Date();
        const tmtKgb = new Date(hasil.tmtKgbBaru);
        const deadlineSDM = new Date(tmtKgb.getFullYear(), tmtKgb.getMonth() - 1, 0);
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const flagRapelan = todayDate > deadlineSDM;

        riwayatBatch.push(
          makeRiwayatKGB({
            pegawaiId: pegawai.id,
            tanggalSK: new Date(hasil.tmtKgbBaru),
            tmtSK: new Date(hasil.tmtKgbBaru),
            golonganLama: pegawai.golonganRuang,
            gajiPokokLama: pegawai.gajiPokok,
            mkgTahunLama: pegawai.mkgTahun,
            mkgBulanLama: pegawai.mkgBulan,
            golonganBaru: pegawai.golonganRuang,
            gajiPokokBaru: hasil.gajiPokokBaru,
            mkgTahunBaru: hasil.mkgTahunBaru,
            mkgBulanBaru: hasil.mkgBulanBaru,
            tmtKgbBaru: hasil.tmtKgbBaru,
            tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
            status: "belum_diproses",
            flagRapelan,
            createdBy: userLogin.id,
          }),
        );
      }

      results.berhasil++;
    } catch (e) {
      results.gagal++;
      const pesan = e instanceof Error ? e.message : "data tidak valid";
      results.errors.push(`NIP ${row.nip} (${row.nama}): Gagal diproses — ${pesan}`);
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
        `Pegawai tersimpan, tetapi pembuatan RiwayatKGB otomatis gagal: ${pesan}. Buat KGB pertama secara manual dari halaman pegawai.`,
      );
    }
  } catch (e) {
    results.gagal += results.berhasil;
    results.berhasil = 0;
    const pesan = e instanceof Error ? e.message : "unknown";
    results.errors.push(`Gagal menulis ke Google Sheets: ${pesan}. Tidak ada baris baru yang tersimpan — coba lagi.`);
  }

  if (userLogin && results.berhasil > 0) {
    logAudit({
      userId: userLogin.id,
      aksi: "import_pegawai",
      detail: `Import pegawai: ${results.berhasil} berhasil, ${results.gagal} gagal dari ${rows.length} data`,
    });
  }

  return NextResponse.json(results);
}
