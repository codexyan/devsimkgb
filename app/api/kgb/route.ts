import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { isGolonganDikenal, jendelaProsesKgb } from "@/lib/tabelGaji";
import { canProcessKGB, canViewKGB } from "@/lib/auth";
import { rencanaSetelahKgbSelesai, rencanaSiklusBerikutnya, type RencanaSiklusKgb } from "@/lib/jadwalKgb";
import { formatTanggalId, hariIniWita, samaTanggalKalender, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import {
  bacaTanggalInput,
  hukdisMenahanKgb,
  pesanKgbMasihAktif,
  placeholderBerlebih,
  recordKgbKembarBerlebih,
  rentangBulanTmt,
  suratSudahDibuat,
  type HukdisUntukKgb,
  type SuratKgbTersimpan,
} from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const bulan = searchParams.get("bulan") || "";
  const tahun = searchParams.get("tahun") || "";
  const rapelan = searchParams.get("rapelan") || "";
  const deadlineBulan = searchParams.get("deadlineBulan") || "";
  const pegawaiId = searchParams.get("pegawaiId") || "";
  const rapelanDitetapkan = searchParams.get("rapelanDitetapkan") === "true";

  const hariIni = hariIniWita();
  const rapelanCutoff = new Date(hariIni.getFullYear(), hariIni.getMonth() + 2, 1);
  const jumlahBulanDeadline = parseInt(deadlineBulan, 10);
  const deadlineCutoff = Number.isFinite(jumlahBulanDeadline)
    ? new Date(hariIni.getFullYear(), hariIni.getMonth() + jumlahBulanDeadline + 2, 1)
    : null;

  const [allKgb, pegawaiList, suratList] = await Promise.all([
    db.riwayatKGB.findMany(),
    db.pegawai.findMany(),
    db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
  ]);
  const pegById = new Map(pegawaiList.map((p) => [p.id, p]));
  const suratByKgb = new Map(suratList.map((sRow) => [sRow.kgbId, sRow]));
  const searchLc = search.toLowerCase();

  const hasPegFilter = rapelan === "1" || !!deadlineCutoff || !!search;
  const pegMatch = (pid: string) => {
    const p = pegById.get(pid);
    if (!p) return false;
    const tmt = tanggalKalender(p.tmtKgbBerikutnya);
    if (rapelan === "1") {
      if (!(tmt && tmt < rapelanCutoff)) return false;
    } else if (deadlineCutoff) {
      if (!(tmt && tmt >= rapelanCutoff && tmt < deadlineCutoff)) return false;
    }
    if (search) {
      if (!((p.nama || "").toLowerCase().includes(searchLc) || (p.nip || "").toLowerCase().includes(searchLc))) return false;
    }
    return true;
  };

  const bulanTahunRange = rentangBulanTmt(bulan, tahun);

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
      const tmt = tanggalKalender(k.tmtKgbBaru);
      if (!(tmt && tmt >= bulanTahunRange.lo && tmt < bulanTahunRange.hi)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  const kgbListEnriched = filtered.map((k) => {
    const p = pegById.get(k.pegawaiId);
    const sRow = suratByKgb.get(k.id);
    const jendela = jendelaProsesKgb(k.tmtKgbBaru, hariIni);
    return {
      ...k,
      pegawai: p ? { nama: p.nama, nip: p.nip, unitKerja: p.unitKerja, jabatan: p.jabatan } : null,
      surat: sRow ? { id: sRow.id, nomorSurat: sRow.nomorSurat, tanggalSurat: sRow.tanggalSurat, pathFile: sRow.pathFile } : null,
      // Syarat yang sama dengan POST /api/kgb/[id]/upload-sk: Unggah SK TTE hanya setelah Buat SK.
      skSudahDibuat: suratSudahDibuat(sRow),
      unlockDate: jendela ? isoTanggalKalender(jendela.unlockDate) : null,
      isLocked: jendela?.isLocked ?? false,
    };
  });

  // Entri virtual "Belum Diproses" untuk pegawai aktif tanpa riwayat aktif. Filter rapelan ditetapkan
  // hanya memuat KGB yang sudah dikonfirmasi keuangan, jadi tanpa entri virtual.
  const includeVirtual = !pegawaiId && !rapelanDitetapkan && (!status || status === "belum_diproses");
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
        return tmt > hariIni && tmt <= deadlineCutoff;
      }
      if (bulanTahunRange) {
        return tmt >= bulanTahunRange.lo && tmt < bulanTahunRange.hi;
      }
      return true;
    };

    const pegawaiBelum = pegawaiList.filter((p) => {
      if (!p.aktif) return false;
      if (activePegIds.has(p.id)) return false;
      if (!tmtMatch(tanggalKalender(p.tmtKgbBerikutnya))) return false;
      if (search && !((p.nama || "").toLowerCase().includes(searchLc) || (p.nip || "").toLowerCase().includes(searchLc)))
        return false;
      return true;
    });

    virtualEntries = pegawaiBelum.map((p) => {
      // tmtMatch sudah memastikan TMT valid.
      const tmt = tanggalKalender(p.tmtKgbBerikutnya)!;
      const jendela = jendelaProsesKgb(tmt, hariIni)!;
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
        tmtKgbBaru: isoTanggalKalender(tmt),
        tmtKgbBerikutnya: isoTanggalKalender(tmt),
        nomorSK: "",
        tanggalSK: "",
        tmtSK: "",
        penetapSkDasar: null,
        status: "belum_diproses",
        flagRapelan: jendela.flagRapelan,
        unlockDate: isoTanggalKalender(jendela.unlockDate),
        isLocked: jendela.isLocked,
        createdAt: new Date(0).toISOString(),
        surat: null,
        skSudahDibuat: false,
      };
    });
  }

  return NextResponse.json([...kgbListEnriched, ...virtualEntries]);
}

export async function POST(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const pegawaiId = typeof body.pegawaiId === "string" ? body.pegawaiId.trim() : "";
  if (!pegawaiId)
    return NextResponse.json({ error: "Pegawai wajib dipilih" }, { status: 400 });

  const pegawai = await db.pegawai.findUnique({ id: pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  if (!isGolonganDikenal(pegawai.golonganRuang)) {
    return NextResponse.json(
      { error: `Golongan "${pegawai.golonganRuang}" tidak dikenal di tabel gaji PP 5/2024. Perbaiki data pegawai terlebih dahulu.` },
      { status: 400 },
    );
  }

  const isArsip = body.isArsip === true;
  const nomorSK = typeof body.nomorSK === "string" ? body.nomorSK.trim() : "";
  const tanggalSK = bacaTanggalInput(body.tanggalSK);
  const tmtSK = bacaTanggalInput(body.tmtSK);
  if (!tanggalSK || !tmtSK) {
    return NextResponse.json(
      { error: "Tanggal SK Terakhir dan TMT SK Terakhir wajib diisi dengan tanggal yang valid." },
      { status: 400 },
    );
  }
  const penetapSkDasar = typeof body.penetapSkDasar === "string" ? body.penetapSkDasar.trim() || null : null;

  const [kgbPegawai, hukdisRows] = await Promise.all([
    db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } }),
    db.riwayatHukdis.findMany({ where: { pegawaiId: pegawai.id } }),
  ]);
  const riwayatHukdis: HukdisUntukKgb[] = hukdisRows.map((h) => ({
    berdampakKGB: h.berdampakKGB === true,
    tmtBerakhir: h.tmtBerakhir as NilaiTanggal,
    tmtMulai: h.tmtMulai as NilaiTanggal,
  }));

  // Satu KGB aktif per pegawai, baik untuk Input KGB maupun Arsip KGB.
  const kgbAktif = kgbPegawai.find((k) => pesanKgbMasihAktif(k.status));
  if (kgbAktif)
    return NextResponse.json({ error: pesanKgbMasihAktif(kgbAktif.status) }, { status: 409 });

  const hariIni = hariIniWita();
  let rencana: RencanaSiklusKgb;
  try {
    rencana = rencanaSiklusBerikutnya({ ...pegawai, penetapSkDasar, hariIni });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "Jadwal KGB pegawai tidak dapat dihitung";
    return NextResponse.json({ error: `${pesan}. Perbaiki data pegawai terlebih dahulu.` }, { status: 400 });
  }

  // Hukdis yang ditandai berdampak KGB menahan proses selama masih berlaku. Arsip ikut ditahan:
  // SK yang terbit di luar SIM-KGB pada masa hukdis perlu diperiksa sebelum dicatat. Hukdis yang mulai
  // sesudah TMT KGB ini menunda KGB berikutnya, sehingga tidak menahan KGB ini.
  const penahanan = hukdisMenahanKgb({ riwayatHukdis, pegawai, hariIni, tmtKgb: rencana.tmtKgbBaru });
  if (penahanan.menahan) {
    const sisa = penahanan.berakhir
      ? `Berakhir: ${formatTanggalId(penahanan.berakhir)}`
      : "Tanggal berakhir belum ditetapkan";
    return NextResponse.json(
      { error: `Pegawai sedang menjalani hukuman disiplin yang menunda KGB, sehingga KGB belum dapat diproses. ${sisa}` },
      { status: 400 },
    );
  }

  const jendela = jendelaProsesKgb(rencana.tmtKgbBaru, hariIni)!;
  const labelTmt = formatTanggalId(rencana.tmtKgbBaru);

  // Arsip juga mengikuti jendela proses: KGB yang TMT-nya belum dekat belum dicatat selesai, karena
  // arsip langsung memperbarui gaji pokok dan MKG pegawai.
  if (jendela.isLocked) {
    return NextResponse.json(
      {
        error: isArsip
          ? `KGB TMT ${labelTmt} belum dapat diarsipkan. Arsip KGB dapat dicatat mulai ${formatTanggalId(jendela.unlockDate)}, sama dengan jendela Input KGB.`
          : `KGB belum dapat diproses. Jendela proses baru dibuka mulai ${formatTanggalId(jendela.unlockDate)}.`,
      },
      { status: 400 },
    );
  }

  const selesaiTmtSama = kgbPegawai.find((k) => k.status === "selesai" && samaTanggalKalender(k.tmtKgbBaru, rencana.tmtKgbBaru));
  if (selesaiTmtSama && !(isArsip && selesaiTmtSama.isArsip)) {
    return NextResponse.json(
      { error: `KGB TMT ${labelTmt} sudah tercatat Selesai. Periksa TMT KGB berikutnya di Data Pegawai.` },
      { status: 409 },
    );
  }

  // -- MODE ARSIP --
  if (isArsip) {
    // Arsip dengan TMT yang sama sudah tersimpan tetapi data pegawai belum diperbarui: permintaan
    // sebelumnya terputus, jadi langkah sesudahnya diulang tanpa membuat record kedua.
    let kgbArsip = selesaiTmtSama;
    if (!kgbArsip) {
      const dibuat = await db.riwayatKGB.create(
        makeRiwayatKGB({
          ...rencana,
          pegawaiId: pegawai.id,
          nomorSK,
          tanggalSK,
          tmtSK,
          penetapSkDasar,
          status: "selesai",
          flagRapelan: false,
          isArsip: true,
          createdBy: userLogin.id,
        }),
      );
      // Sheets tidak punya transaksi, jadi dua Arsip KGB yang berjalan bersamaan bisa sama-sama membuat
      // record. Record yang tersimpan lebih dulu dipertahankan; permintaan yang record-nya dihapus menolak.
      const arsipKembar = (
        await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id, status: "selesai", isArsip: true } })
      ).filter((k) => samaTanggalKalender(k.tmtKgbBaru, rencana.tmtKgbBaru));
      const arsipBerlebih = recordKgbKembarBerlebih(arsipKembar);
      for (const idBerlebih of arsipBerlebih) await db.riwayatKGB.delete({ id: idBerlebih });
      if (arsipBerlebih.includes(dibuat.id)) {
        return NextResponse.json(
          { error: "Arsip KGB pegawai ini baru saja dicatat oleh pengguna lain pada saat yang sama. Muat ulang data untuk melihatnya." },
          { status: 409 },
        );
      }
      kgbArsip = dibuat;
    }

    // SK dasar siklus berikutnya adalah SK yang diarsipkan. Penetap SK dasar arsip ini tidak dipakai,
    // karena bisa berbeda dengan pejabat yang menetapkan SK arsip; penetapnya hanya diisi bila dikirim.
    const penetapSkArsip = typeof body.penetapSkArsip === "string" ? body.penetapSkArsip.trim() || null : null;
    const lanjut = rencanaSetelahKgbSelesai({ kgb: kgbArsip, penetapSkDasar: penetapSkArsip, hariIni });

    await db.pegawai.update({ id: pegawai.id }, lanjut.pegawai);
    await db.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });
    await db.riwayatKGB.create(makeRiwayatKGB({ ...lanjut.placeholder, pegawaiId: pegawai.id, createdBy: userLogin.id }));

    // Permintaan yang bersamaan bisa sama-sama membuat placeholder; sisakan satu.
    const placeholderList = await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id, status: "belum_diproses" } });
    for (const idBerlebih of placeholderBerlebih(placeholderList)) await db.riwayatKGB.delete({ id: idBerlebih });

    logAudit({
      userId: userLogin.id,
      aksi: "input_kgb_arsip",
      detail: `Input arsip KGB ${pegawai.nama} (${pegawai.nip}), TMT ${labelTmt}, langsung Selesai`,
      targetNama: pegawai.nama,
    });

    return NextResponse.json(
      { ...kgbArsip, pegawai: { nama: pegawai.nama, nip: pegawai.nip } },
      { status: selesaiTmtSama ? 200 : 201 },
    );
  }

  // -- FLOW NORMAL --
  // Placeholder belum_diproses terbaru bila ada → update.
  const existing =
    kgbPegawai
      .filter((k) => k.status === "belum_diproses")
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0] ?? null;

  const kgbData = {
    ...rencana,
    nomorSK,
    tanggalSK,
    tmtSK,
    // Placeholder bisa sudah membawa penetap dari surat KGB sebelumnya.
    penetapSkDasar: penetapSkDasar ?? existing?.penetapSkDasar ?? null,
    status: "sedang_diproses",
    flagRapelan: jendela.flagRapelan,
    createdBy: userLogin.id,
  };

  const kgb = existing
    ? (await db.riwayatKGB.update({ id: existing.id }, kgbData))!
    : await db.riwayatKGB.create(makeRiwayatKGB({ pegawaiId: pegawai.id, ...kgbData }));

  if (!existing) {
    // Tanpa placeholder, dua Input KGB yang berjalan bersamaan bisa sama-sama membuat record. Record yang
    // tersimpan lebih dulu dipertahankan; permintaan yang record-nya dihapus menolak.
    const kembar = (
      await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id, status: "sedang_diproses" } })
    ).filter((k) => samaTanggalKalender(k.tmtKgbBaru, rencana.tmtKgbBaru));
    const berlebih = recordKgbKembarBerlebih(kembar);
    for (const idBerlebih of berlebih) await db.riwayatKGB.delete({ id: idBerlebih });
    if (berlebih.includes(kgb.id)) {
      return NextResponse.json(
        { error: "KGB pegawai ini baru saja diinput oleh pengguna lain pada saat yang sama. Muat ulang data untuk melihatnya." },
        { status: 409 },
      );
    }
  }

  await db.pegawai.update(
    { id: pegawai.id },
    { tmtKgbTerakhir: rencana.tmtKgbBaru, tmtKgbBerikutnya: rencana.tmtKgbBerikutnya },
  );

  logAudit({
    userId: userLogin.id,
    aksi: "input_kgb",
    detail: `Input KGB untuk ${pegawai.nama} (${pegawai.nip}), Gaji Pokok Baru: Rp ${rencana.gajiPokokBaru.toLocaleString("id-ID")}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ...kgb, pegawai: { nama: pegawai.nama, nip: pegawai.nip } }, { status: 201 });
}
