import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { db } from "@/lib/db";
import { makeRiwayatKGB, type PegawaiRow } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis, canEditPegawai } from "@/lib/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { bacaIsianPegawai, bacaTanggal, kgbBerjalanTerbaru, teksAtauNull } from "@/lib/dataPegawai";
import { samaTanggalKalender } from "@/lib/waktu";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { rencanaSiklusBerikutnya, type RencanaSiklusKgb } from "@/lib/jadwalKgb";
import { infoStatusKgb } from "@/lib/statusKgb";
import { bulanKeKgbBerikutnya, tambahBulan } from "@/lib/tabelGaji";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

/** Sembunyikan jenis dan keterangan hukdis dari peran yang tidak mengelola hukdis. */
function untukPeran(pegawai: PegawaiRow, role: string): PegawaiRow {
  const berlaku = penandaHukdisBerlaku(pegawai);
  return canManageHukdis(role) ? berlaku : { ...berlaku, jenisHukdis: null, keteranganHukdis: null };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Data pribadi dan hukdis pegawai tidak dipakai halaman keuangan.
  if (!NON_KEUANGAN.includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;

  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  return NextResponse.json(untukPeran(pegawai, session.user.role!));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role!;
  if (!canEditPegawai(role))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const lama = await db.pegawai.findUnique({ id });
  if (!lama)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  // NIP diperiksa tersendiri di bawah; unit kerja yang tidak dikirim tetap memakai nilai tersimpan.
  const hasil = bacaIsianPegawai(
    { ...body, unitKerja: body.unitKerja === undefined ? lama.unitKerja : body.unitKerja },
    { denganNip: false },
  );
  if (hasil.galat !== undefined)
    return NextResponse.json({ error: hasil.galat }, { status: 400 });
  const { nip: _nip, ...isian } = hasil.data;

  // NIP yang tercatat keliru dapat dibetulkan Kanwil. Riwayat KGB, SK, hukdis, dan usulan terhubung lewat
  // id pegawai, jadi aman diubah; SK yang sudah terbit tetap memuat NIP lamanya. NIP kosong berarti tetap.
  const nipBaru = typeof body.nip === "string" ? body.nip.replace(/^="(.*)"$/, "$1").trim() : "";
  const ubahNip = !!nipBaru && nipBaru !== lama.nip;
  if (ubahNip) {
    if (!/^\d{18}$/.test(nipBaru))
      return NextResponse.json({ error: `NIP "${nipBaru}" tidak valid. NIP terdiri dari 18 digit angka.` }, { status: 400 });
    const bentrok = await db.pegawai.findUnique({ nip: nipBaru });
    if (bentrok && bentrok.id !== id)
      return NextResponse.json({ error: `NIP ${nipBaru} sudah tercatat atas nama ${bentrok.nama}.` }, { status: 409 });
  }

  // Penanda hukdis hanya diubah pengelola hukdis, dan hanya field yang dikirim; peran lain
  // mempertahankan nilai tersimpan dan mencatat hukdis lewat Riwayat Hukdis.
  const bolehHukdis = canManageHukdis(role);
  const ubahHukdis = (kolom: "statusHukdis" | "tanggalHukdisBerakhir" | "jenisHukdis" | "keteranganHukdis") =>
    bolehHukdis && body[kolom] !== undefined;
  const tanggalHukdisBerakhir = bacaTanggal(body.tanggalHukdisBerakhir);
  if (bolehHukdis && tanggalHukdisBerakhir.status === "tidak_valid")
    return NextResponse.json({ error: "Tanggal berakhir hukuman disiplin tidak valid." }, { status: 400 });

  // TMT terakhir yang dikosongkan: nilai tersimpan dipertahankan bila TMT berikutnya tidak berubah,
  // selain itu dianggap satu langkah tabel gaji sebelum TMT berikutnya.
  const tmtBerikutnyaBerubah = !samaTanggalKalender(isian.tmtKgbBerikutnya, lama.tmtKgbBerikutnya, { keduanyaKosongSama: true });
  const tmtKgbTerakhir =
    isian.tmtKgbTerakhir ??
    (!tmtBerikutnyaBerubah && lama.tmtKgbTerakhir
      ? lama.tmtKgbTerakhir
      : tambahBulan(isian.tmtKgbBerikutnya, -bulanKeKgbBerikutnya(isian.golonganRuang, isian.mkgTahun, isian.mkgBulan)));

  const jadwalBerubah =
    isian.golonganRuang !== lama.golonganRuang ||
    isian.mkgTahun !== lama.mkgTahun ||
    isian.mkgBulan !== lama.mkgBulan ||
    tmtBerikutnyaBerubah ||
    !samaTanggalKalender(tmtKgbTerakhir, lama.tmtKgbTerakhir, { keduanyaKosongSama: true });
  const gajiBerubah = isian.gajiPokok !== lama.gajiPokok;

  // Placeholder Belum Diproses diselaraskan dengan data baru; dihitung sebelum menulis.
  let placeholderBaru: RencanaSiklusKgb | null = null;
  if (jadwalBerubah || gajiBerubah) {
    const riwayat = await db.riwayatKGB.findMany({ where: { pegawaiId: id } });
    const berjalan = kgbBerjalanTerbaru(riwayat);
    if (jadwalBerubah && berjalan) {
      const label = infoStatusKgb(berjalan.status).label;
      const saran = berjalan.status === "sedang_diproses"
        ? "Batalkan KGB tersebut terlebih dahulu bila data ini perlu diperbaiki."
        : "Perubahan dapat dilakukan setelah keuangan mengonfirmasi KGB tersebut.";
      return NextResponse.json(
        { error: `Golongan, masa kerja golongan, dan TMT KGB tidak dapat diubah karena KGB pegawai ini berstatus ${label}. ${saran}` },
        { status: 409 },
      );
    }
    const placeholder = riwayat
      .filter((k) => k.status === "belum_diproses")
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
    if (placeholder) {
      try {
        placeholderBaru = rencanaSiklusBerikutnya({
          ...isian,
          tmtKgbTerakhir,
          penetapSkDasar: placeholder.penetapSkDasar,
        });
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Jadwal KGB tidak dapat dihitung" }, { status: 400 });
      }
    }
  }

  const userLogin = await penggunaLogin(session);
  if (!userLogin)
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const pegawai = await db.pegawai.update(
    { id },
    {
      ...isian,
      ...(ubahNip ? { nip: nipBaru } : {}),
      tmtKgbTerakhir,
      statusHukdis: ubahHukdis("statusHukdis") ? body.statusHukdis === true || body.statusHukdis === "true" : lama.statusHukdis,
      tanggalHukdisBerakhir: ubahHukdis("tanggalHukdisBerakhir")
        ? tanggalHukdisBerakhir.status === "valid"
          ? tanggalHukdisBerakhir.tanggal
          : null
        : lama.tanggalHukdisBerakhir,
      // Peran lain menerima jenis dan keterangan hukdis yang disembunyikan, jadi nilai tersimpan dipertahankan.
      jenisHukdis: ubahHukdis("jenisHukdis") ? teksAtauNull(body.jenisHukdis) : lama.jenisHukdis,
      keteranganHukdis: ubahHukdis("keteranganHukdis") ? teksAtauNull(body.keteranganHukdis) : lama.keteranganHukdis,
      aktif: typeof body.aktif === "boolean" ? body.aktif : lama.aktif,
      updatedAt: new Date(),
    },
  );
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  if (placeholderBaru) {
    await db.riwayatKGB.deleteMany({ pegawaiId: id, status: "belum_diproses" });
    await db.riwayatKGB.create(
      makeRiwayatKGB({ pegawaiId: id, createdBy: userLogin.id, ...placeholderBaru }),
    );
  }

  if (ubahNip)
    logAudit({
      userId: userLogin.id,
      aksi: "ubah_nip_pegawai",
      detail: `NIP ${pegawai.nama} dibetulkan dari ${lama.nip} menjadi ${nipBaru}`,
      targetNama: pegawai.nama,
    });
  logAudit({
    userId: userLogin.id,
    aksi: "edit_pegawai",
    detail: `Edit data pegawai: ${pegawai.nama} (${pegawai.nip}), ${pegawai.jabatan}, Gol. ${pegawai.golonganRuang}, ${pegawai.unitKerja}${placeholderBaru ? ", jadwal KGB Belum Diproses diselaraskan" : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json(untukPeran(pegawai, role));
}

type BucketSk = {
  list(opsi: { prefix: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
  delete(kunci: string[]): Promise<void>;
};

/** Kunci objek R2 dari pathFile tersimpan; format lama berupa URL penuh memakai nama berkasnya. */
function kunciBerkasSk(pathFile: unknown): string | null {
  if (typeof pathFile !== "string" || !pathFile.trim()) return null;
  let kunci: string;
  try {
    const bagian = new URL(pathFile).pathname.split("/");
    kunci = `sk/${bagian[bagian.length - 1]}`;
  } catch {
    kunci = pathFile.trim().replace(/^\/+/, "");
  }
  return kunci.includes("..") ? null : kunci;
}

/**
 * Hapus berkas SK pegawai di R2: yang tercatat di SuratKGB dan unggahan lain berawalan
 * sk/<nip>_ (termasuk unggahan yang sudah diganti). Best effort; galat dikembalikan, tidak dilempar.
 */
async function hapusBerkasSk(kunciTercatat: string[], nip: string): Promise<{ terhapus: number; galat: string | null }> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as unknown as { SK_BUCKET?: BucketSk }).SK_BUCKET;
    if (!bucket) return { terhapus: 0, galat: "penyimpanan berkas SK tidak tersedia" };

    const semua = new Set(kunciTercatat);
    if (/^\d+$/.test(nip)) {
      let cursor: string | undefined;
      do {
        const hasil = await bucket.list({ prefix: `sk/${nip}_`, cursor });
        for (const objek of hasil.objects) semua.add(objek.key);
        cursor = hasil.truncated ? hasil.cursor : undefined;
      } while (cursor);
    }
    const daftar = [...semua];
    for (let i = 0; i < daftar.length; i += 1000) await bucket.delete(daftar.slice(i, i + 1000));
    return { terhapus: daftar.length, galat: null };
  } catch (e) {
    return { terhapus: 0, galat: e instanceof Error ? e.message : "galat tidak diketahui" };
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canEditPegawai(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hapusPermanent = searchParams.get("permanent") === "true";

  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const userLogin = await penggunaLogin(session);
  if (!userLogin)
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  if (hapusPermanent) {
    const kgbList = await db.riwayatKGB.findMany({ where: { pegawaiId: id } });
    const kgbIds = kgbList.map((k) => k.id);

    let kunciBerkas: string[] = [];
    if (kgbIds.length > 0) {
      const suratList = (await db.suratKGB.findMany({ where: { kgbId: { in: kgbIds } } })) as { pathFile?: unknown }[];
      kunciBerkas = suratList.map((s) => kunciBerkasSk(s.pathFile)).filter((k): k is string => k !== null);
      await db.suratKGB.deleteMany({ kgbId: { in: kgbIds } });
      await db.serahTerima.deleteMany({ kgbId: { in: kgbIds } });
    }
    await db.riwayatKGB.deleteMany({ pegawaiId: id });
    await db.riwayatHukdis.deleteMany({ pegawaiId: id });
    await db.pegawai.delete({ id });

    // Berkas dihapus setelah data, agar kegagalan penyimpanan tidak meninggalkan data yang menunjuk berkas hilang.
    const berkas = await hapusBerkasSk(kunciBerkas, pegawai.nip);
    if (berkas.galat) console.error(`[hapus pegawai ${id}] berkas SK tidak terhapus:`, berkas.galat);

    logAudit({
      userId: userLogin.id,
      aksi: "hapus_pegawai",
      detail: `Hapus permanen pegawai: ${pegawai.nama} (${pegawai.nip}), ${berkas.galat ? `berkas SK tidak terhapus (${berkas.galat})` : `${berkas.terhapus} berkas SK dihapus`}`,
      targetNama: pegawai.nama,
    });

    return NextResponse.json({
      message: "Pegawai berhasil dihapus permanen",
      berkasSkTerhapus: berkas.terhapus,
      berkasSkGalat: berkas.galat,
    });
  }

  await db.pegawai.update({ id }, { aktif: false, updatedAt: new Date() });

  logAudit({
    userId: userLogin.id,
    aksi: "hapus_pegawai",
    detail: `Nonaktifkan pegawai: ${pegawai.nama} (${pegawai.nip})`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ message: "Pegawai berhasil dinonaktifkan" });
}
