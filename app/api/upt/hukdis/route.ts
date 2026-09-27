import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { pegawaiSatker } from "@/lib/aksesUpt";
import { hukdisMasihBerlaku } from "@/lib/hukdisKedaluwarsa";
import {
  LAPORAN_HUKDIS_DIPEGANG_UPT,
  adaLaporanHukdisBerjalan,
  galatTanggalLaporanHukdis,
  kekuranganLaporanHukdis,
} from "@/lib/laporanHukdis";
import { PESAN_BELUM_AKTIF, hapusSkHukdis, simpanSkHukdis, tabelBelumAda } from "@/lib/laporanHukdisServer";
import { BATAS_BERKAS_BYTE, PESAN_TERLALU_BESAR } from "@/lib/berkasUsulan";
import { TIPE_NOTIFIKASI, notifikasiHukdisUpt } from "@/lib/generateNotifikasi";
import { namaAsliBerkas } from "@/lib/usulanPegawai";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { hariIniWita } from "@/lib/waktu";
import { SATKER } from "@/lib/satker";
import type { LaporanHukdisRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Laporan hukuman disiplin hanya dapat dikirim akun Admin UPT yang tertaut ke satker.";

type JenisBaris = { kode: string; label: string | null; kategori: string | null; durasiHukdis: number | null; aktif: boolean | null; urutan: number | null };
/** Kolom hukdis tercatat yang dibaca di sini; sisanya sengaja tidak dibaca agar tidak ikut terkirim. */
type HukdisBaris = { id: string; pegawaiId: string; berdampakKGB: boolean | null; tmtMulai: Date | null; tmtBerakhir: Date | null };

/**
 * Modul Hukuman Disiplin Admin UPT (ADR-016): laporan yang pernah dikirim satker ini, hukdis pegawainya
 * yang sudah dicatat Kanwil, dan bahan formulir laporan (pegawai satker dan katalog jenis hukuman).
 *
 * Hukdis tercatat dikirim terbatas, sesuai ADR-004: masih berlaku atau tidak, menunda KGB atau tidak, dan
 * sampai kapan. Jenis, nomor SK, keterangan, dan dasar hukumnya tidak pernah ikut.
 */
export async function GET() {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const [semuaPegawai, semuaJenis, semuaHukdis] = await Promise.all([
    db.pegawai.findMany() as Promise<PegawaiRow[]>,
    db.hukdisJenis.findMany() as Promise<JenisBaris[]>,
    db.riwayatHukdis.findMany() as Promise<HukdisBaris[]>,
  ]);
  let laporan: LaporanHukdisRow[] = [];
  let aktif = true;
  try {
    laporan = (await db.laporanHukdis.findMany({ where: { satker: akun.kode } })) as LaporanHukdisRow[];
  } catch (e) {
    if (!tabelBelumAda(e)) throw e;
    aktif = false;
  }

  const milikSatker = pegawaiSatker(semuaPegawai, akun.kode);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));
  const idSatker = new Set(milikSatker.map((p) => p.id));
  const labelJenis = new Map(semuaJenis.map((j) => [j.kode, j.label ?? j.kode]));
  const hariIni = hariIniWita();

  const daftarLaporan = laporan
    .map((l) => {
      const p = pegawaiById.get(l.pegawaiId);
      return {
        id: l.id,
        pegawaiId: l.pegawaiId,
        nama: p?.nama ?? "-",
        nip: p?.nip ?? "-",
        jenisHukdis: l.jenisHukdis,
        jenisLabel: labelJenis.get(l.jenisHukdis) ?? l.jenisHukdis,
        nomorSK: l.nomorSK,
        tanggalSK: isoTanggalKalender(l.tanggalSK),
        tmtMulai: isoTanggalKalender(l.tmtMulai),
        tmtBerakhir: isoTanggalKalender(l.tmtBerakhir),
        keterangan: l.keterangan,
        berkas: l.pathBerkas ? { nama: namaAsliBerkas(l.pathBerkas) } : null,
        status: l.status,
        catatanKanwil: l.catatanKanwil,
        dilaporkanOleh: l.dilaporkanOleh,
        dilaporkanAt: l.dilaporkanAt ? new Date(l.dilaporkanAt).toISOString() : null,
        ditinjauAt: l.ditinjauAt ? new Date(l.ditinjauAt).toISOString() : null,
      };
    })
    .sort((a, b) => (b.dilaporkanAt ?? "").localeCompare(a.dilaporkanAt ?? ""));

  const tercatat = semuaHukdis
    .filter((h) => idSatker.has(h.pegawaiId))
    .map((h) => {
      const p = pegawaiById.get(h.pegawaiId)!;
      return {
        id: h.id,
        pegawaiId: h.pegawaiId,
        nama: p.nama,
        nip: p.nip,
        aktif: hukdisMasihBerlaku(h.tmtBerakhir, hariIni),
        menundaKgb: !!h.berdampakKGB,
        berlakuSampai: isoTanggalKalender(h.tmtBerakhir),
        // Urutan saja; tanggal mulainya tidak dikirim.
        urut: h.tmtMulai ? new Date(h.tmtMulai).getTime() : 0,
      };
    })
    .sort((a, b) => Number(b.aktif) - Number(a.aktif) || b.urut - a.urut)
    .map(({ urut: _urut, ...h }) => h);

  return NextResponse.json({
    aktif,
    laporan: daftarLaporan,
    tercatat,
    pegawai: milikSatker
      .filter((p) => p.aktif)
      .map((p) => ({ id: p.id, nama: p.nama, nip: p.nip, jabatan: p.jabatan }))
      .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    jenis: semuaJenis
      .filter((j) => j.aktif !== false)
      .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
      .map((j) => ({ kode: j.kode, label: j.label ?? j.kode, kategori: j.kategori ?? "", durasiHukdis: j.durasiHukdis ?? 0 })),
  });
}

/**
 * Laporkan satu hukuman disiplin, atau kirim ulang laporan yang dikembalikan (`gantikan`).
 *
 * UPT melaporkan, SDM Hukdis Kanwil mencatat. Yang dikirim di sini belum mengubah apa pun pada data
 * pegawai maupun jadwal KGB-nya; baris riwayat hukdis baru terbit setelah Kanwil menerimanya.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { pengguna, kode } = akun;
  const satker = SATKER.find((s) => s.kode === kode)!;

  const panjangIsi = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjangIsi) && panjangIsi > BATAS_BERKAS_BYTE + 64 * 1024)
    return NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data laporan tidak valid" }, { status: 400 });
  }
  const teks = (kunci: string) => (form.get(kunci) as string | null)?.trim() || "";

  const pegawaiId = teks("pegawaiId");
  if (!pegawaiId) return NextResponse.json({ error: "Pegawai wajib dipilih" }, { status: 400 });
  const pegawai = (await db.pegawai.findUnique({ id: pegawaiId })) as PegawaiRow | null;
  // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!pegawai || pegawaiSatker([pegawai], kode).length === 0)
    return NextResponse.json({ error: "Pegawai tidak ditemukan di satker ini" }, { status: 404 });

  let laporanPegawai: LaporanHukdisRow[];
  try {
    laporanPegawai = (await db.laporanHukdis.findMany({ where: { pegawaiId } })) as LaporanHukdisRow[];
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ error: PESAN_BELUM_AKTIF }, { status: 503 });
    throw e;
  }

  // Kiriman ulang menggantikan laporan yang dikembalikan; pindaian SK-nya ikut bila tidak diunggah ulang.
  const idGantikan = teks("gantikan") || null;
  const digantikan = idGantikan ? laporanPegawai.find((l) => l.id === idGantikan) ?? null : null;
  if (idGantikan && (!digantikan || digantikan.satker !== kode || !LAPORAN_HUKDIS_DIPEGANG_UPT.includes(digantikan.status)))
    return NextResponse.json({ error: "Laporan yang hendak dikirim ulang tidak ditemukan atau sudah dicatat Kanwil." }, { status: 409 });
  if (adaLaporanHukdisBerjalan(laporanPegawai, pegawaiId, idGantikan))
    return NextResponse.json(
      { error: "Pegawai ini sudah punya laporan hukuman disiplin yang belum dicatat Kanwil. Lanjutkan yang itu." },
      { status: 409 },
    );

  const jenisHukdis = teks("jenisHukdis");
  const jenis = jenisHukdis ? await db.hukdisJenis.findUnique({ kode: jenisHukdis }) : null;
  if (jenisHukdis && !jenis) return NextResponse.json({ error: "Jenis hukuman disiplin tidak dikenal" }, { status: 400 });

  const tanggal = (kunci: string, label: string) => {
    if (!teks(kunci)) return { nilai: null };
    const nilai = bacaTanggalInput(teks(kunci));
    return nilai ? { nilai } : { galat: `${label} tidak valid` };
  };
  const tanggalSK = tanggal("tanggalSK", "Tanggal SK");
  const tmtMulai = tanggal("tmtMulai", "TMT mulai");
  const tmtBerakhir = tanggal("tmtBerakhir", "TMT berakhir");
  for (const t of [tanggalSK, tmtMulai, tmtBerakhir]) if ("galat" in t) return NextResponse.json({ error: t.galat }, { status: 400 });

  const berkasBaru = form.get("skHukdis");
  const adaBerkas = (berkasBaru instanceof File && berkasBaru.size > 0) || !!digantikan?.pathBerkas;
  const isian = {
    jenisHukdis,
    nomorSK: teks("nomorSK"),
    tanggalSK: tanggalSK.nilai ?? null,
    tmtMulai: tmtMulai.nilai ?? null,
    tmtBerakhir: tmtBerakhir.nilai ?? null,
    adaBerkas,
  };
  const kurang = kekuranganLaporanHukdis(isian);
  if (kurang.length > 0) return NextResponse.json({ error: `Belum lengkap: ${kurang.join(", ")}.` }, { status: 400 });
  const galatTanggal = galatTanggalLaporanHukdis(isian);
  if (galatTanggal) return NextResponse.json({ error: galatTanggal }, { status: 400 });

  // Berkas disimpan setelah semua pemeriksaan lolos, agar permintaan yang ditolak tidak meninggalkan objek di R2.
  const berkas = await simpanSkHukdis(form, kode);
  if ("galat" in berkas) return berkas.galat;

  const sekarang = new Date();
  const baris: LaporanHukdisRow = {
    id: newId(),
    pegawaiId,
    satker: kode,
    jenisHukdis,
    nomorSK: isian.nomorSK,
    tanggalSK: isian.tanggalSK,
    tmtMulai: isian.tmtMulai,
    tmtBerakhir: isian.tmtBerakhir,
    keterangan: teks("keterangan") || null,
    pathBerkas: berkas.jalur ?? digantikan?.pathBerkas ?? null,
    status: "menunggu",
    catatanKanwil: null,
    dilaporkanOleh: `${pengguna.nama} (${pengguna.nip})`,
    dilaporkanAt: sekarang,
    ditinjauOleh: null,
    ditinjauAt: null,
    riwayatId: null,
  };
  try {
    await db.laporanHukdis.create(baris);
  } catch (e) {
    await hapusSkHukdis(berkas.jalur);
    if (tabelBelumAda(e)) return NextResponse.json({ error: PESAN_BELUM_AKTIF }, { status: 503 });
    throw e;
  }

  if (digantikan) {
    await db.laporanHukdis.delete({ id: digantikan.id });
    await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.HUKDIS_UPT, referenceId: digantikan.id });
    // Pindaian lama dibuang hanya bila digantikan unggahan baru; bila tidak, ia sudah pindah ke laporan ini.
    if (berkas.jalur) await hapusSkHukdis(digantikan.pathBerkas);
  }

  const labelJenis = (jenis as { label?: string | null } | null)?.label ?? jenisHukdis;
  try {
    await db.notifikasi.create({
      ...notifikasiHukdisUpt({ id: baris.id, labelJenis, satker: satker.nama }, pegawai),
      id: newId(),
      dibaca: false,
      createdAt: sekarang,
    });
  } catch {
    // Laporannya sudah tersimpan dan tampak pada antrian Kanwil; loncengnya saja yang tidak jadi.
  }

  logAudit({
    userId: pengguna.id,
    aksi: digantikan ? "kirim_ulang_lapor_hukdis" : "lapor_hukdis_upt",
    detail:
      `${satker.nama} ${digantikan ? "mengirim ulang laporan" : "melaporkan"} hukuman disiplin ${labelJenis} ` +
      `${pegawai.nama} (${pegawai.nip}), SK ${isian.nomorSK}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true, id: baris.id }, { status: 201 });
}
