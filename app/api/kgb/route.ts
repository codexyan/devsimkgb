import { CI } from "@/lib/searchMode";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { kalkulasiKGB, getGajiPokok } from "@/lib/tabelGaji";
import { canProcessKGB } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const bulan = searchParams.get("bulan") || "";
  const tahun = searchParams.get("tahun") || "";
  const rapelan = searchParams.get("rapelan") || "";
  const deadlineBulan = searchParams.get("deadlineBulan") || "";
  const pegawaiId = searchParams.get("pegawaiId") || "";
  const rapelanDitetapkan = searchParams.get("rapelanDitetapkan") === "true";

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Deadline SDM = akhir bulan ke-2 sebelum TMT → rapelan jika bulan-sebelum-TMT sudah mulai
  const rapelanCutoff = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  // deadlineBulan filter: deadline = akhir bulan ke-2 sebelum TMT → TMT dalam N+2 bulan
  const deadlineCutoff = deadlineBulan
    ? new Date(today.getFullYear(), today.getMonth() + parseInt(deadlineBulan) + 2, 1)
    : null;

  // Build pegawai filter, merge all pegawai-scoped conditions into one object
  // (spreading multiple `pegawai: {}` keys would overwrite each other in Prisma)
  type PegawaiFilter = {
    tmtKgbBerikutnya?: object;
    OR?: object[];
    AND?: object[];
  };
  const pegawaiFilter: PegawaiFilter = {};
  if (rapelan === "1") {
    pegawaiFilter.tmtKgbBerikutnya = { lt: rapelanCutoff };
  } else if (deadlineCutoff) {
    pegawaiFilter.tmtKgbBerikutnya = { gte: rapelanCutoff, lt: deadlineCutoff };
  }
  if (search) pegawaiFilter.OR = [
    { nama: { contains: search, ...CI } },
    { nip: { contains: search, ...CI } },
  ];

  const kgbList = await prisma.riwayatKGB.findMany({
    where: {
      ...(pegawaiId ? { pegawaiId } : {}),
      ...(status ? { status } : {}),
      ...(rapelanDitetapkan ? { rapelanDitetapkan: true, isArsip: false } : {}),
      ...(rapelan === "1"
        ? { status: { notIn: ["selesai", "ditolak", "menunggu_keuangan"] } }
        : deadlineCutoff
        ? { status: { not: "selesai" } }
        : {}),
      ...(Object.keys(pegawaiFilter).length > 0 ? { pegawai: pegawaiFilter } : {}),
      ...(bulan && tahun
        ? {
            tmtKgbBaru: {
              gte: new Date(`${tahun}-${bulan}-01`),
              lt: new Date(
                `${tahun}-${String(parseInt(bulan) + 1).padStart(2, "0")}-01`,
              ),
            },
          }
        : tahun
        ? {
            tmtKgbBaru: {
              gte: new Date(`${tahun}-01-01`),
              lt: new Date(`${parseInt(tahun) + 1}-01-01`),
            },
          }
        : {}),
    },
    include: {
      pegawai: {
        select: { nama: true, nip: true, unitKerja: true, jabatan: true },
      },
      surat: { select: { id: true, nomorSurat: true, tanggalSurat: true, pathFile: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Sinkronisasi: tampilkan pegawai aktif yang belum memiliki riwayatKGB aktif
  // (tidak ada record dengan status belum_diproses atau sedang_diproses)
  // sebagai entri virtual "Belum Diproses"
  // Tidak perlu virtual entries jika filter by pegawaiId (history view)
  const includeVirtual = !pegawaiId && (!status || status === "belum_diproses");

  let virtualEntries: object[] = [];
  if (includeVirtual) {
    // Bangun filter tmtKgbBerikutnya secara eksplisit tanpa spread agar tidak konflik
    type DateFilter = { gte?: Date; lt?: Date; gt?: Date; lte?: Date };
    const virtualTmtFilter: DateFilter = {};
    if (bulan && tahun) {
      virtualTmtFilter.gte = new Date(`${tahun}-${bulan}-01`);
      virtualTmtFilter.lt = new Date(`${tahun}-${String(parseInt(bulan) + 1).padStart(2, "0")}-01`);
    } else if (tahun) {
      virtualTmtFilter.gte = new Date(`${tahun}-01-01`);
      virtualTmtFilter.lt = new Date(`${parseInt(tahun) + 1}-01-01`);
    }
    if (rapelan === "1") {
      virtualTmtFilter.lt = rapelanCutoff;
    } else if (deadlineCutoff) {
      virtualTmtFilter.gt = today;
      virtualTmtFilter.lte = deadlineCutoff;
    }

    const hasTmtFilter = Object.keys(virtualTmtFilter).length > 0;

    const pegawaiBelum = await prisma.pegawai.findMany({
      where: {
        aktif: true,
        // tmtKgbBerikutnya adalah required field (non-nullable), tidak perlu cek null
        NOT: { riwayatKGB: { some: { status: { in: ["belum_diproses", "sedang_diproses", "menunggu_keuangan"] } } } },
        ...(hasTmtFilter ? { tmtKgbBerikutnya: virtualTmtFilter } : {}),
        ...(search ? { OR: [{ nama: { contains: search, ...CI } }, { nip: { contains: search, ...CI } }] } : {}),
      },
      select: {
        id: true, nip: true, nama: true, jabatan: true, golonganRuang: true,
        mkgTahun: true, mkgBulan: true, gajiPokok: true,
        tmtKgbBerikutnya: true, unitKerja: true,
      },
    });

    virtualEntries = pegawaiBelum.map((p) => {
      const tmt = new Date(p.tmtKgbBerikutnya);
      const deadline = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
      const flagRapelan = todayDate > deadline;
      const unlockDate = new Date(tmt.getFullYear(), tmt.getMonth() - 2, 1);
      const isLocked = today < unlockDate;
      return {
        id: null,
        isVirtual: true,
        pegawaiId: p.id,
        pegawai: { nama: p.nama, nip: p.nip, unitKerja: p.unitKerja, jabatan: p.jabatan },
        golonganLama: p.golonganRuang,
        gajiPokokLama: p.gajiPokok,
        mkgTahunLama: p.mkgTahun,
        mkgBulanLama: p.mkgBulan,
        golonganBaru: p.golonganRuang,
        gajiPokokBaru: null,
        mkgTahunBaru: null,
        mkgBulanBaru: null,
        tmtKgbBaru: p.tmtKgbBerikutnya.toISOString(),
        tmtKgbBerikutnya: p.tmtKgbBerikutnya.toISOString(),
        nomorSK: "",
        tanggalSK: "",
        tmtSK: "",
        status: "belum_diproses",
        flagRapelan,
        unlockDate: unlockDate.toISOString(),
        isLocked,
        createdAt: new Date(0).toISOString(),
        surat: null,
      };
    });
  }

  // Tambahkan isLocked + unlockDate ke semua record nyata dari DB
  const kgbListEnriched = kgbList.map((k) => {
    const tmt = new Date(k.tmtKgbBaru);
    const unlockDate = new Date(tmt.getFullYear(), tmt.getMonth() - 2, 1);
    const isLocked = today < unlockDate;
    return { ...k, unlockDate: unlockDate.toISOString(), isLocked };
  });

  return NextResponse.json([...kgbListEnriched, ...virtualEntries]);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  // Ambil user ID yang valid dari database berdasarkan NIP
  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json(
      { error: "User tidak ditemukan" },
      { status: 401 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await req.json() as any;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  // Cek pegawai ada
  const pegawai = await prisma.pegawai.findUnique({
    where: { id: body.pegawaiId },
  });
  if (!pegawai)
    return NextResponse.json(
      { error: "Pegawai tidak ditemukan" },
      { status: 404 },
    );

  // Cek pegawai Hukdis
  // Hanya jenis "penundaan_kgb" (atau tidak diketahui jenisnya) yang memblokir proses KGB.
  if (pegawai.statusHukdis) {
    const today = new Date();
    const masihAktif =
      !pegawai.tanggalHukdisBerakhir || pegawai.tanggalHukdisBerakhir > today;
    const berdampakKeKGB =
      !pegawai.jenisHukdis || pegawai.jenisHukdis === "penundaan_kgb";

    if (masihAktif && berdampakKeKGB) {
      const sisa = pegawai.tanggalHukdisBerakhir
        ? `Berakhir: ${new Date(pegawai.tanggalHukdisBerakhir).toLocaleDateString("id-ID")}`
        : "Tanggal berakhir belum ditetapkan";

      return NextResponse.json(
        {
          error: `Pegawai sedang dalam Penundaan KGB aktif, KGB tidak dapat diproses. ${sisa}`,
        },
        { status: 400 },
      );
    }
  }

  // Kalkulasi otomatis
  const hasil = kalkulasiKGB(pegawai);

  const today = new Date();
  const todayDatePost = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tmtKgb = new Date(hasil.tmtKgbBaru);
  const deadlineSDM = new Date(tmtKgb.getFullYear(), tmtKgb.getMonth() - 1, 0);
  // isArsip = true → flagRapelan selalu false (sudah diproses tepat waktu di masa lalu)
  const isArsip = body.isArsip === true;
  const flagRapelan = isArsip ? false : todayDatePost > deadlineSDM;

  // -- MODE ARSIP: langsung selesai + auto-generate placeholder berikutnya --
  if (isArsip) {
    const kgbArsip = await prisma.riwayatKGB.create({
      data: {
        pegawaiId: body.pegawaiId,
        nomorSK: body.nomorSK,
        tanggalSK: new Date(body.tanggalSK),
        tmtSK: new Date(body.tmtSK),
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
        status: "selesai",
        flagRapelan: false,
        isArsip: true,
        createdBy: userLogin.id,
      },
      include: { pegawai: { select: { nama: true, nip: true } } },
    });

    // Update data pegawai ke nilai baru KGB
    await prisma.pegawai.update({
      where: { id: body.pegawaiId },
      data: {
        golonganRuang: pegawai.golonganRuang,
        gajiPokok: hasil.gajiPokokBaru,
        mkgTahun: hasil.mkgTahunBaru,
        mkgBulan: hasil.mkgBulanBaru,
        tmtKgbTerakhir: hasil.tmtKgbBaru,
        tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
      },
    });

    // Hapus semua placeholder belum_diproses lama, buat 1 yang baru dengan flagRapelan = false
    await prisma.riwayatKGB.deleteMany({
      where: { pegawaiId: body.pegawaiId, status: "belum_diproses" },
    });

    const tmtNext = new Date(hasil.tmtKgbBerikutnya);
    const tmtNextBerikutnya = new Date(tmtNext);
    tmtNextBerikutnya.setFullYear(tmtNextBerikutnya.getFullYear() + 2);
    const nextMkgTahunBaru = hasil.mkgTahunBaru + 2;
    const nextMkgBulanBaru = hasil.mkgBulanBaru;
    const nextGajiPokokBaru = getGajiPokok(pegawai.golonganRuang, nextMkgTahunBaru, nextMkgBulanBaru);
    const deadlineNext = new Date(tmtNext.getFullYear(), tmtNext.getMonth() - 1, 0);
    const nextFlagRapelan = todayDatePost > deadlineNext;

    await prisma.riwayatKGB.create({
      data: {
        pegawaiId: body.pegawaiId,
        nomorSK: "",
        tanggalSK: tmtNext,
        tmtSK: tmtNext,
        golonganLama: pegawai.golonganRuang,
        gajiPokokLama: hasil.gajiPokokBaru,
        mkgTahunLama: hasil.mkgTahunBaru,
        mkgBulanLama: hasil.mkgBulanBaru,
        golonganBaru: pegawai.golonganRuang,
        gajiPokokBaru: nextGajiPokokBaru,
        mkgTahunBaru: nextMkgTahunBaru,
        mkgBulanBaru: nextMkgBulanBaru,
        tmtKgbBaru: tmtNext,
        tmtKgbBerikutnya: tmtNextBerikutnya,
        status: "belum_diproses",
        flagRapelan: nextFlagRapelan,
        createdBy: userLogin.id,
      },
    });

    logAudit({
      userId: userLogin.id,
      aksi: "input_kgb_arsip",
      detail: `Input arsip KGB ${pegawai.nama} (${pegawai.nip}), TMT ${tmtKgb.toLocaleDateString("id-ID")}, langsung Selesai`,
      targetNama: pegawai.nama,
    });

    return NextResponse.json(kgbArsip, { status: 201 });
  }

  // -- FLOW NORMAL ---------------------------------------------------------

  // Tolak jika jendela proses belum dibuka
  if (hasil.isLocked) {
    return NextResponse.json(
      {
        error: `KGB belum dapat diproses. Jendela proses baru dibuka mulai ${hasil.unlockDate.toLocaleDateString("id-ID")}.`,
      },
      { status: 400 },
    );
  }

  // Jika sudah ada placeholder belum_diproses untuk pegawai ini, update saja
  // Tidak filter tmtKgbBaru > today agar rapelan entries (tmtKgbBaru di masa lalu) juga terdeteksi
  const existing = await prisma.riwayatKGB.findFirst({
    where: { pegawaiId: body.pegawaiId, status: "belum_diproses" },
    orderBy: { createdAt: "desc" },
  });

  const kgbData = {
    nomorSK: body.nomorSK,
    tanggalSK: new Date(body.tanggalSK),
    tmtSK: new Date(body.tmtSK),
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
    status: "sedang_diproses" as const,
    flagRapelan,
    createdBy: userLogin.id,
  };

  const kgb = existing
    ? await prisma.riwayatKGB.update({
        where: { id: existing.id },
        data: kgbData,
        include: { pegawai: { select: { nama: true, nip: true } } },
      })
    : await prisma.riwayatKGB.create({
        data: { pegawaiId: body.pegawaiId, ...kgbData },
        include: { pegawai: { select: { nama: true, nip: true } } },
      });

  // Simpan hanya TMT, mkgTahun/gajiPokok diupdate di completion (handover/upload-sk)
  await prisma.pegawai.update({
    where: { id: body.pegawaiId },
    data: {
      tmtKgbTerakhir: hasil.tmtKgbBaru,
      tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
    },
  });

  logAudit({
    userId: userLogin.id,
    aksi: "input_kgb",
    detail: `Input KGB untuk ${pegawai.nama} (${pegawai.nip}), Gaji Pokok Baru: Rp ${hasil.gajiPokokBaru.toLocaleString("id-ID")}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json(kgb, { status: 201 });
}
