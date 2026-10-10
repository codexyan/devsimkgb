import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { newId } from "@/lib/sheets/id";
import { logAudit } from "@/lib/auditLog";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { adaPenandaPdf } from "@/lib/prosesKgb";
import { BERKAS_USULAN } from "@/lib/usulanPegawai";
import { daftarDokumenArsip, simpanDokumenArsip } from "@/lib/dokumenPegawaiServer";
import {
  JENIS_BERKAS_USULAN,
  JENIS_DOKUMEN,
  idAman,
  periksaDokumen,
  type DokumenArsip,
  type DokumenPegawai,
  type JenisDokumen,
} from "@/lib/dokumenPegawai";
import { formatTanggalId } from "@/lib/waktu";
import type { RiwayatKGBRow, UsulanPegawaiRow } from "@/lib/sheets/tables";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";

export const runtime = "nodejs";

/*
 * Dokumen seorang pegawai dari semua sumber (ADR-023): arsip dokumen yang diunggah di tab ini, SK KGB bertanda
 * tangan di SIM-KGB, dan berkas usulan UPT. Hanya Super Admin dan Tim SDM KGB.
 */

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : "");

/**
 * Nomor dan tanggal yang diketik UPT untuk satu berkas usulan, supaya berkasnya dapat dicocokkan dengan SK di
 * linimasa (ADR-066). Pindaian SK kenaikan pangkat dan PMK bernomor SK yang dilaporkan; SK KGB terakhir dan SK CPNS
 * bernomor SK acuan. "SK kenaikan pangkat terakhir" tanpa laporan kenaikan pangkat tidak bernomor, sebab berkas itu
 * bisa saja SK lama yang terbawa dari usulan sebelumnya.
 */
function nomorBerkasUsulan(u: UsulanPegawaiRow, medan: string): { nomor: string; tanggal: string } {
  if (medan === "berkas") return { nomor: u.nomorSurat ?? "", tanggal: iso(u.tanggalSurat) };
  if ((medan === "skPangkat" && u.dasarBaruJenis === "kp") || (medan === "skPmk" && u.dasarBaruJenis === "pmk"))
    return { nomor: u.dasarBaruNomorSk ?? "", tanggal: iso(u.dasarBaruTanggalSk) };
  if (medan === "skTerakhir" || medan === "skCpns") return { nomor: u.nomorSkTerakhir ?? "", tanggal: iso(u.tanggalSkTerakhir) };
  return { nomor: "", tanggal: "" };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const { id } = await params;
  if (!idAman(id)) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const [arsip, kgb, surat, usulan] = await Promise.all([
    daftarDokumenArsip(id),
    db.riwayatKGB.findMany({ where: { pegawaiId: id } }) as Promise<RiwayatKGBRow[]>,
    db.suratKGB.findMany() as Promise<(SuratKgbTersimpan & { kgbId: string; pathFile?: string | null })[]>,
    db.usulanPegawai.findMany({ where: { pegawaiId: id } }) as Promise<UsulanPegawaiRow[]>,
  ]);

  const hasil: DokumenPegawai[] = [];
  for (const d of arsip) {
    hasil.push({
      id: `arsip-${d.id}`,
      sumber: "arsip",
      judul: JENIS_DOKUMEN[d.jenis] ?? "Dokumen",
      nomorSK: d.nomorSK,
      tanggal: d.tanggalSK,
      keterangan: [d.keterangan, `diunggah ${d.diunggahOleh} ${formatTanggalId(d.diunggahAt)}`].filter(Boolean).join(" · "),
      ukuran: d.ukuran,
      url: `/api/pegawai/${encodeURIComponent(id)}/dokumen/${encodeURIComponent(d.id)}`,
      bisaHapus: true,
      jenis: d.jenis,
    });
  }

  const kgbById = new Map(kgb.map((k) => [k.id, k]));
  for (const s of surat) {
    const k = kgbById.get(s.kgbId);
    if (!k || !s.pathFile) continue;
    hasil.push({
      id: `sk-${s.kgbId}`,
      sumber: "sk_kgb",
      judul: `SK KGB TMT ${formatTanggalId(k.tmtKgbBaru)}`,
      nomorSK: s.nomorSurat && s.nomorSurat !== "-" ? s.nomorSurat : "",
      tanggal: iso(s.tanggalSurat),
      keterangan: k.isArsip ? "Arsip KGB" : "Bertanda tangan",
      ukuran: null,
      url: `/api/blob/download?url=${encodeURIComponent(s.pathFile)}`,
      bisaHapus: false,
      jenis: "sk_kgb",
    });
  }

  for (const u of usulan) {
    if (u.status === "draf") continue;
    for (const b of BERKAS_USULAN) {
      const path = (u as unknown as Record<string, string | null>)[b.kunci];
      if (!path) continue;
      const sk = nomorBerkasUsulan(u, b.medan);
      hasil.push({
        id: `usulan-${u.id}-${b.medan}`,
        sumber: "usulan",
        judul: b.label,
        nomorSK: sk.nomor,
        tanggal: sk.tanggal,
        keterangan: `Usulan ${u.jenis === "baru" ? "pegawai baru" : "perubahan data"} · ${u.status}`,
        ukuran: null,
        url: `/api/usulan/${encodeURIComponent(u.id)}/berkas?berkas=${b.medan}`,
        bisaHapus: false,
        jenis: JENIS_BERKAS_USULAN[b.medan],
        status: u.status,
      });
    }
  }

  return NextResponse.json(hasil, { headers: { "Cache-Control": "no-store" } });
}

/** Unggah satu dokumen ke arsip dokumen pegawai (multipart: berkas, jenis, nomorSK, tanggalSK, keterangan). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  const { id } = await params;
  if (!idAman(id)) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data formulir tidak valid." }, { status: 400 });
  }
  const teks = (k: string) => String(form.get(k) ?? "").trim();
  const berkas = form.get("berkas");
  const ukuran = berkas instanceof File ? berkas.size : 0;
  const kurang = periksaDokumen({ jenis: teks("jenis"), tanggalSK: teks("tanggalSK"), ukuran });
  if (kurang.length > 0 || !(berkas instanceof File)) return NextResponse.json({ error: kurang.join(" ") || "Pilih berkas PDF." }, { status: 400 });
  const isi = await berkas.arrayBuffer();
  if (!adaPenandaPdf(new Uint8Array(isi.slice(0, 1024))))
    return NextResponse.json({ error: "Berkas bukan PDF." }, { status: 400 });

  const dokumen: DokumenArsip = {
    id: newId(),
    jenis: teks("jenis") as JenisDokumen,
    nomorSK: teks("nomorSK").slice(0, 120),
    tanggalSK: teks("tanggalSK"),
    keterangan: teks("keterangan").slice(0, 300),
    namaBerkas: berkas.name.slice(0, 160),
    ukuran,
    diunggahOleh: pengguna.nama,
    diunggahAt: new Date().toISOString(),
  };
  await simpanDokumenArsip(id, dokumen, isi);
  logAudit({
    userId: pengguna.id,
    aksi: "unggah_dokumen_pegawai",
    targetNama: pegawai.nama,
    detail: `Unggah ${JENIS_DOKUMEN[dokumen.jenis]}${dokumen.nomorSK ? ` ${dokumen.nomorSK}` : ""} untuk ${pegawai.nama} (${pegawai.nip})`,
  });
  return NextResponse.json({ ok: true, id: dokumen.id }, { status: 201 });
}
