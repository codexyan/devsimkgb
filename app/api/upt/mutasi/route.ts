import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { pegawaiSatker } from "@/lib/aksesUpt";
import { adaLaporanBerjalan } from "@/lib/laporanMutasi";
import { LABEL_JENIS_MUTASI, kekuranganMutasi, type JenisMutasi } from "@/lib/mutasiPegawai";
import { notifikasiMutasiUpt } from "@/lib/generateNotifikasi";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER, cariSatker } from "@/lib/satker";
import type { LaporanMutasiRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Laporan mutasi hanya dapat dikirim akun Admin UPT yang tertaut ke satker.";
const JENIS_SAH: JenisMutasi[] = ["definitif", "bko", "selesai_bko", "pemberhentian"];

/** Laporan mutasi satker ini, terbaru lebih dulu. */
export async function GET() {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const [laporan, semuaPegawai] = await Promise.all([
    db.laporanMutasi.findMany({ where: { satker: akun.kode } }) as Promise<LaporanMutasiRow[]>,
    db.pegawai.findMany() as Promise<PegawaiRow[]>,
  ]);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));

  const daftar = laporan
    .map((l) => {
      const p = pegawaiById.get(l.pegawaiId);
      return {
        id: l.id,
        pegawaiId: l.pegawaiId,
        nama: p?.nama ?? "-",
        nip: p?.nip ?? "-",
        jenis: l.jenis,
        label: LABEL_JENIS_MUTASI[l.jenis as JenisMutasi] ?? l.jenis,
        satkerTujuan: l.satkerTujuan,
        tmt: l.tmt ? new Date(l.tmt).toISOString() : null,
        nomorSK: l.nomorSK,
        alasan: l.alasan,
        keterangan: l.keterangan,
        status: l.status,
        catatanKanwil: l.catatanKanwil,
        dilaporkanOleh: l.dilaporkanOleh,
        dilaporkanAt: l.dilaporkanAt ? new Date(l.dilaporkanAt).toISOString() : null,
        ditinjauOleh: l.ditinjauOleh,
        ditinjauAt: l.ditinjauAt ? new Date(l.ditinjauAt).toISOString() : null,
      };
    })
    .sort((a, b) => (b.dilaporkanAt ?? "").localeCompare(a.dilaporkanAt ?? ""));

  return NextResponse.json(daftar);
}

/**
 * Laporkan satu mutasi atau pemberhentian.
 *
 * UPT melaporkan, Kanwil menetapkan. Yang dikirim di sini belum mengubah apa pun pada data pegawai:
 * barisnya baru terbit di riwayat mutasi setelah Kanwil menerimanya. Dengan begitu pegawai yang salah
 * dilaporkan tidak telanjur hilang dari antrian KGB satkernya.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { pengguna, kode } = akun;
  const satker = SATKER.find((s) => s.kode === kode)!;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teks = (kunci: string) => (typeof body[kunci] === "string" ? (body[kunci] as string).trim() : "");

  const pegawaiId = teks("pegawaiId");
  if (!pegawaiId) return NextResponse.json({ error: "Pegawai wajib dipilih" }, { status: 400 });
  const pegawai = (await db.pegawai.findUnique({ id: pegawaiId })) as PegawaiRow | null;
  // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!pegawai || pegawaiSatker([pegawai], kode).length === 0)
    return NextResponse.json({ error: "Pegawai tidak ditemukan di satker ini" }, { status: 404 });

  const jenis = teks("jenis") as JenisMutasi;
  if (!JENIS_SAH.includes(jenis)) return NextResponse.json({ error: "Jenis mutasi tidak dikenal" }, { status: 400 });

  const tmt = teks("tmt") ? bacaTanggalInput(teks("tmt")) : null;
  if (teks("tmt") && !tmt) return NextResponse.json({ error: "TMT berlaku tidak valid" }, { status: 400 });
  const tanggalSK = teks("tanggalSk") ? bacaTanggalInput(teks("tanggalSk")) : null;
  if (teks("tanggalSk") && !tanggalSK) return NextResponse.json({ error: "Tanggal SK tidak valid" }, { status: 400 });

  const isian = {
    jenis,
    satkerTujuan: teks("satkerTujuan") || null,
    tmt,
    nomorSk: teks("nomorSk") || null,
    alasan: teks("alasan") || null,
  };
  const kurang = kekuranganMutasi(isian);
  if (kurang.length > 0) return NextResponse.json({ error: `Belum lengkap: ${kurang.join(", ")}.` }, { status: 400 });

  const tujuan = isian.satkerTujuan ? SATKER.find((s) => s.kode === isian.satkerTujuan) : null;
  if (isian.satkerTujuan && !tujuan) return NextResponse.json({ error: "Satker tujuan tidak dikenal" }, { status: 400 });
  if (tujuan && jenis === "definitif" && cariSatker(pegawai.unitKerja)?.kode === tujuan.kode)
    return NextResponse.json({ error: "Satker tujuan sama dengan satker sekarang" }, { status: 400 });

  const berjalan = (await db.laporanMutasi.findMany({ where: { pegawaiId } })) as LaporanMutasiRow[];
  if (adaLaporanBerjalan(berjalan, pegawaiId))
    return NextResponse.json(
      { error: "Pegawai ini sudah punya laporan mutasi yang belum selesai. Lanjutkan yang itu." },
      { status: 409 },
    );

  const sekarang = new Date();
  const baris: LaporanMutasiRow = {
    id: newId(),
    pegawaiId,
    satker: kode,
    jenis,
    satkerTujuan: tujuan?.nama ?? null,
    tmt,
    nomorSK: isian.nomorSk,
    tanggalSK,
    alasan: isian.alasan,
    keterangan: teks("keterangan") || null,
    status: "menunggu",
    catatanKanwil: null,
    dilaporkanOleh: `${pengguna.nama} (${pengguna.nip})`,
    dilaporkanAt: sekarang,
    ditinjauOleh: null,
    ditinjauAt: null,
    riwayatId: null,
  };
  await db.laporanMutasi.create(baris);

  try {
    await db.notifikasi.create({
      ...notifikasiMutasiUpt(
        { id: baris.id, label: LABEL_JENIS_MUTASI[jenis], satkerAsal: satker.nama, satkerTujuan: tujuan?.nama ?? null },
        pegawai,
      ),
      id: newId(),
      dibaca: false,
      createdAt: sekarang,
    });
  } catch {
    // Laporannya sudah tersimpan dan tampak pada antrian Kanwil; loncengnya saja yang tidak jadi.
  }

  logAudit({
    userId: pengguna.id,
    aksi: "lapor_mutasi_upt",
    detail:
      `${satker.nama} melaporkan ${LABEL_JENIS_MUTASI[jenis]} ${pegawai.nama} (${pegawai.nip})` +
      (tujuan ? `, tujuan ${tujuan.nama}` : "") +
      (isian.alasan ? `, alasan ${isian.alasan}` : "") +
      `, SK ${isian.nomorSk ?? "-"}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true, id: baris.id }, { status: 201 });
}

