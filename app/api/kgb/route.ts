import { NextResponse } from "next/server";
import { sheets, makeRiwayatKGB } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { kalkulasiKGB, getGajiPokok } from "@/lib/tabelGaji";
import { canProcessKGB } from "@/lib/auth";

export const runtime = "nodejs";

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
  const rapelanCutoff = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  const deadlineCutoff = deadlineBulan
    ? new Date(today.getFullYear(), today.getMonth() + parseInt(deadlineBulan) + 2, 1)
    : null;

  const [allKgb, pegawaiList, suratList] = await Promise.all([
    sheets.riwayatKGB.findMany(),
    sheets.pegawai.findMany(),
    sheets.suratKGB.findMany() as Promise<any[]>,
  ]);
  const pegById = new Map(pegawaiList.map((p) => [p.id, p]));
  const suratByKgb = new Map(suratList.map((sRow) => [sRow.kgbId, sRow]));
  const searchLc = search.toLowerCase();

  const hasPegFilter = rapelan === "1" || !!deadlineCutoff || !!search;
  const pegMatch = (pid: string) => {
    const p = pegById.get(pid);
    if (!p) return false;
    if (rapelan === "1") {
      if (!(p.tmtKgbBerikutnya && p.tmtKgbBerikutnya < rapelanCutoff)) return false;
    } else if (deadlineCutoff) {
      if (!(p.tmtKgbBerikutnya && p.tmtKgbBerikutnya >= rapelanCutoff && p.tmtKgbBerikutnya < deadlineCutoff)) return false;
    }
    if (search) {
      if (!((p.nama || "").toLowerCase().includes(searchLc) || (p.nip || "").toLowerCase().includes(searchLc))) return false;
    }
    return true;
  };

  const bulanTahunRange = (() => {
    if (bulan && tahun) {
      return { lo: new Date(`${tahun}-${bulan}-01`), hi: new Date(`${tahun}-${String(parseInt(bulan) + 1).padStart(2, "0")}-01`) };
    }
    if (tahun) {
      return { lo: new Date(`${tahun}-01-01`), hi: new Date(`${parseInt(tahun) + 1}-01-01`) };
    }
    return null;
  })();

  const filtered = allKgb.filter((k) => {
    if (pegawaiId && k.pegawaiId !== pegawaiId) return false;
    if (status && k.status !== status) return false;
    if (rapelanDitetapkan && !(k.rapelanDitetapkan === true && !k.isArsip)) return false;
    if (rapelan === "1") {
      if (["selesai", "ditolak", "menunggu_keuangan"].includes(k.status)) return false;
    } else if (deadlineCutoff) {
      if (k.status === "selesai") return false;
    }
    if (hasPegFilter && !pegMatch(k.pegawaiId)) return false;
    if (bulanTahunRange) {
      if (!(k.tmtKgbBaru && k.tmtKgbBaru >= bulanTahunRange.lo && k.tmtKgbBaru < bulanTahunRange.hi)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  const kgbListEnriched = filtered.map((k) => {
    const p = pegById.get(k.pegawaiId);
    const sRow = suratByKgb.get(k.id);
    const tmt = new Date(k.tmtKgbBaru as Date);
    const unlockDate = new Date(tmt.getFullYear(), tmt.getMonth() - 2, 1);
    const isLocked = today < unlockDate;
    return {
      ...k,
      pegawai: p ? { nama: p.nama, nip: p.nip, unitKerja: p.unitKerja, jabatan: p.jabatan } : null,
      surat: sRow ? { id: sRow.id, nomorSurat: sRow.nomorSurat, tanggalSurat: sRow.tanggalSurat, pathFile: sRow.pathFile } : null,
      unlockDate: unlockDate.toISOString(),
      isLocked,
    };
  });

  // Entri virtual "Belum Diproses" untuk pegawai aktif tanpa riwayat aktif.
  const includeVirtual = !pegawaiId && (!status || status === "belum_diproses");
  let virtualEntries: object[] = [];
  if (includeVirtual) {
    const activeStatus = ["belum_diproses", "sedang_diproses", "menunggu_keuangan"];
    const activePegIds = new Set(allKgb.filter((k) => activeStatus.includes(k.status)).map((k) => k.pegawaiId));

    const tmtMatch = (tmt: Date | null) => {
      if (!tmt) return false;
      if (rapelan === "1") {
        if (bulanTahunRange && !(tmt >= bulanTahunRange.lo)) return false;
        return tmt < rapelanCutoff;
      }
      if (deadlineCutoff) {
        return tmt > today && tmt <= deadlineCutoff;
      }
      if (bulanTahunRange) {
        return tmt >= bulanTahunRange.lo && tmt < bulanTahunRange.hi;
      }
      return true;
    };

    const pegawaiBelum = pegawaiList.filter((p) => {
      if (!p.aktif) return false;
      if (activePegIds.has(p.id)) return false;
      if (!tmtMatch(p.tmtKgbBerikutnya)) return false;
      if (search && !((p.nama || "").toLowerCase().includes(searchLc) || (p.nip || "").toLowerCase().includes(searchLc)))
        return false;
      return true;
    });

    virtualEntries = pegawaiBelum.map((p) => {
      const tmt = new Date(p.tmtKgbBerikutnya as Date);
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
        tmtKgbBaru: tmt.toISOString(),
        tmtKgbBerikutnya: tmt.toISOString(),
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

  return NextResponse.json([...kgbListEnriched, ...virtualEntries]);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const pegawai = await sheets.pegawai.findUnique({ id: body.pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  // Cek pegawai Hukdis (penundaan_kgb memblokir proses).
  if (pegawai.statusHukdis) {
    const now = new Date();
    const masihAktif = !pegawai.tanggalHukdisBerakhir || pegawai.tanggalHukdisBerakhir > now;
    const berdampakKeKGB = !pegawai.jenisHukdis || pegawai.jenisHukdis === "penundaan_kgb";
    if (masihAktif && berdampakKeKGB) {
      const sisa = pegawai.tanggalHukdisBerakhir
        ? `Berakhir: ${new Date(pegawai.tanggalHukdisBerakhir).toLocaleDateString("id-ID")}`
        : "Tanggal berakhir belum ditetapkan";
      return NextResponse.json(
        { error: `Pegawai sedang dalam Penundaan KGB aktif, KGB tidak dapat diproses. ${sisa}` },
        { status: 400 },
      );
    }
  }

  const hasil = kalkulasiKGB({
    golonganRuang: pegawai.golonganRuang,
    mkgTahun: pegawai.mkgTahun,
    mkgBulan: pegawai.mkgBulan,
    tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya as Date,
    tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
  });

  const today = new Date();
  const todayDatePost = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tmtKgb = new Date(hasil.tmtKgbBaru);
  const deadlineSDM = new Date(tmtKgb.getFullYear(), tmtKgb.getMonth() - 1, 0);
  const isArsip = body.isArsip === true;
  const flagRapelan = isArsip ? false : todayDatePost > deadlineSDM;

  // -- MODE ARSIP --
  if (isArsip) {
    const kgbArsip = makeRiwayatKGB({
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
    });
    await sheets.riwayatKGB.create(kgbArsip);

    await sheets.pegawai.update(
      { id: body.pegawaiId },
      {
        golonganRuang: pegawai.golonganRuang,
        gajiPokok: hasil.gajiPokokBaru,
        mkgTahun: hasil.mkgTahunBaru,
        mkgBulan: hasil.mkgBulanBaru,
        tmtKgbTerakhir: hasil.tmtKgbBaru,
        tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
      },
    );

    await sheets.riwayatKGB.deleteMany({ pegawaiId: body.pegawaiId, status: "belum_diproses" });

    const tmtNext = new Date(hasil.tmtKgbBerikutnya);
    const tmtNextBerikutnya = new Date(tmtNext);
    tmtNextBerikutnya.setFullYear(tmtNextBerikutnya.getFullYear() + 2);
    const nextMkgTahunBaru = hasil.mkgTahunBaru + 2;
    const nextMkgBulanBaru = hasil.mkgBulanBaru;
    const nextGajiPokokBaru = getGajiPokok(pegawai.golonganRuang, nextMkgTahunBaru, nextMkgBulanBaru);
    const deadlineNext = new Date(tmtNext.getFullYear(), tmtNext.getMonth() - 1, 0);
    const nextFlagRapelan = todayDatePost > deadlineNext;

    await sheets.riwayatKGB.create(
      makeRiwayatKGB({
        pegawaiId: body.pegawaiId,
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
      }),
    );

    logAudit({
      userId: userLogin.id,
      aksi: "input_kgb_arsip",
      detail: `Input arsip KGB ${pegawai.nama} (${pegawai.nip}), TMT ${tmtKgb.toLocaleDateString("id-ID")}, langsung Selesai`,
      targetNama: pegawai.nama,
    });

    return NextResponse.json({ ...kgbArsip, pegawai: { nama: pegawai.nama, nip: pegawai.nip } }, { status: 201 });
  }

  // -- FLOW NORMAL --
  if (hasil.isLocked) {
    return NextResponse.json(
      { error: `KGB belum dapat diproses. Jendela proses baru dibuka mulai ${hasil.unlockDate.toLocaleDateString("id-ID")}.` },
      { status: 400 },
    );
  }

  // Placeholder belum_diproses terbaru bila ada → update.
  const belumList = await sheets.riwayatKGB.findMany({
    where: { pegawaiId: body.pegawaiId, status: "belum_diproses" },
    orderBy: { field: "createdAt", dir: "desc" },
  });
  const existing = belumList[0] ?? null;

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
    ? (await sheets.riwayatKGB.update({ id: existing.id }, kgbData))!
    : await sheets.riwayatKGB.create(makeRiwayatKGB({ pegawaiId: body.pegawaiId, ...kgbData }));

  await sheets.pegawai.update(
    { id: body.pegawaiId },
    { tmtKgbTerakhir: hasil.tmtKgbBaru, tmtKgbBerikutnya: hasil.tmtKgbBerikutnya },
  );

  logAudit({
    userId: userLogin.id,
    aksi: "input_kgb",
    detail: `Input KGB untuk ${pegawai.nama} (${pegawai.nip}), Gaji Pokok Baru: Rp ${hasil.gajiPokokBaru.toLocaleString("id-ID")}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ...kgb, pegawai: { nama: pegawai.nama, nip: pegawai.nip } }, { status: 201 });
}
