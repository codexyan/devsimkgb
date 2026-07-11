import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { lookupGajiPokok } from "@/lib/gajiPokokTable";
import { kalkulasiKGB } from "@/lib/tabelGaji";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await req.json() as any;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data untuk diimport" },
      { status: 400 },
    );
  }

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });

  const results = { berhasil: 0, gagal: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      // Strip Excel text formula prefix ="..." jika ada (dari hasil export CSV)
      row.nip = row.nip?.replace(/^="(.*)"$/, "$1").trim() ?? row.nip;

      const existing = await prisma.pegawai.findUnique({
        where: { nip: row.nip },
      });
      if (existing) {
        results.gagal++;
        results.errors.push(
          `NIP ${row.nip} (${row.nama}) sudah terdaftar, dilewati`,
        );
        continue;
      }

      const mkgTahun = parseInt(row.mkgTahun) || 0;
      const mkgBulan = parseInt(row.mkgBulan) || 0;
      const gajiPokokRaw = row.gajiPokok ? parseInt(row.gajiPokok) : null;
      const gajiPokok =
        gajiPokokRaw && !isNaN(gajiPokokRaw)
          ? gajiPokokRaw
          : lookupGajiPokok(row.golonganRuang, mkgTahun);

      if (!gajiPokok) {
        results.gagal++;
        results.errors.push(
          `NIP ${row.nip} (${row.nama}): golonganRuang "${row.golonganRuang}" tidak dikenali, gajiPokok tidak dapat ditentukan`,
        );
        continue;
      }

      const pegawai = await prisma.pegawai.create({
        data: {
          nip: row.nip,
          nama: row.nama,
          jabatan: row.jabatan,
          pangkat: row.pangkat,
          golonganRuang: row.golonganRuang,
          unitKerja: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
          tmtGolongan: new Date(row.tmtGolongan),
          mkgTahun,
          mkgBulan,
          gajiPokok,
          tmtKgbBerikutnya: new Date(row.tmtKgbBerikutnya),
          tmtKgbTerakhir: row.tmtKgbTerakhir
            ? new Date(row.tmtKgbTerakhir)
            : (() => { const d = new Date(row.tmtKgbBerikutnya); d.setFullYear(d.getFullYear() - 2); return d; })(),
          tempatLahir: row.tempatLahir || null,
          tanggalLahir: row.tanggalLahir ? new Date(row.tanggalLahir) : null,
          jenisKelamin: row.jenisKelamin || null,
          pendidikanTerakhir: row.pendidikanTerakhir || null,
          eselon: row.eselon || null,
          statusHukdis:
            row.statusHukdis === "true" || row.statusHukdis === true,
          keteranganHukdis: row.keteranganHukdis || null,
        },
      });

      // Auto-create RiwayatKGB (sama seperti tambah manual)
      if (userLogin) {
        const hasil = kalkulasiKGB(pegawai);
        const today = new Date();
        const tmtKgb = new Date(hasil.tmtKgbBaru);
        const deadlineSDM = new Date(tmtKgb.getFullYear(), tmtKgb.getMonth() - 1, 0);
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const flagRapelan = todayDate > deadlineSDM;

        await prisma.riwayatKGB.create({
          data: {
            pegawaiId: pegawai.id,
            nomorSK: "",
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
          },
        });
      }

      results.berhasil++;
    } catch {
      results.gagal++;
      results.errors.push(`NIP ${row.nip} (${row.nama}): Gagal disimpan`);
    }
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
