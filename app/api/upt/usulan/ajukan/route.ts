import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { notifikasiUsulanUpt } from "@/lib/generateNotifikasi";
import { kekuranganUsulan } from "@/lib/usulanPegawai";
import { BATAS_BERKAS_BYTE, PESAN_TERLALU_BESAR, simpanBerkasUsulan } from "@/lib/berkasUsulan";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { PegawaiRow, UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Usulan hanya dapat diajukan akun Admin UPT yang tertaut ke satker.";

/**
 * Ajukan beberapa draf sekaligus dengan satu surat usulan.
 *
 * Satu surat usulan UPT lazimnya memuat beberapa pegawai — surat Rutan Rantau 8 September 2026,
 * misalnya, memuat lima. Karena itu nomor surat, tanggalnya, dan salinan suratnya diisi sekali di sini
 * lalu disalin ke setiap baris, bukan diketik ulang per pegawai. Kelengkapan tiap draf diperiksa lebih
 * dulu dan yang kurang disebutkan satu per satu, supaya operator tahu persis apa yang harus dilengkapi.
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
    return NextResponse.json({ error: "Data pengajuan tidak valid" }, { status: 400 });
  }
  const teks = (kunci: string) => (form.get(kunci) as string | null)?.trim() || "";

  const nomorSurat = teks("nomorSurat");
  if (!nomorSurat) return NextResponse.json({ error: "Nomor surat usulan wajib diisi" }, { status: 400 });
  const tanggalSurat = teks("tanggalSurat") ? bacaTanggalInput(teks("tanggalSurat")) : null;
  if (!tanggalSurat) return NextResponse.json({ error: "Tanggal surat usulan wajib diisi dan harus valid" }, { status: 400 });

  const idTerpilih = form.getAll("id").map((v) => String(v)).filter(Boolean);
  if (idTerpilih.length === 0) return NextResponse.json({ error: "Pilih dulu data pegawai yang akan diajukan" }, { status: 400 });

  const semua = (await db.usulanPegawai.findMany({ where: { satker: kode, status: "draf" } })) as UsulanPegawaiRow[];
  const perId = new Map(semua.map((u) => [u.id, u]));
  const draf = idTerpilih.map((id) => perId.get(id)).filter((u): u is UsulanPegawaiRow => !!u);
  if (draf.length !== idTerpilih.length)
    return NextResponse.json(
      { error: "Ada data yang sudah tidak berstatus draf. Muat ulang halaman, lalu coba lagi." },
      { status: 409 },
    );

  // Kelengkapan diperiksa sebelum apa pun disimpan, agar satu draf yang kurang tidak membuat sebagian
  // terkirim dan sebagian tidak.
  const pegawaiPerId = new Map(
    ((await db.pegawai.findMany()) as PegawaiRow[]).map((p) => [p.id, p]),
  );
  const belumLengkap: { nama: string; kurang: string[] }[] = [];
  for (const u of draf) {
    const pegawai = u.pegawaiId ? pegawaiPerId.get(u.pegawaiId) : null;
    const kurang = kekuranganUsulan(u, u.jenis, pegawai);
    if (kurang.length > 0) belumLengkap.push({ nama: pegawai?.nama ?? u.nama ?? u.nip ?? "-", kurang });
  }
  if (belumLengkap.length > 0)
    return NextResponse.json(
      {
        error: `Belum dapat diajukan: ${belumLengkap.map((b) => `${b.nama} (${b.kurang.join(", ")})`).join("; ")}.`,
        belumLengkap,
      },
      { status: 400 },
    );

  // Satu salinan surat untuk seluruh pegawai pada pengajuan ini; jalurnya sama di tiap baris.
  const berkas = await simpanBerkasUsulan(form, kode);
  if ("galat" in berkas) return berkas.galat;

  const diajukanOleh = `${pengguna.nama} (${pengguna.nip})`;
  const sekarang = new Date();
  const terkirim: string[] = [];

  for (const u of draf) {
    const pegawai = u.pegawaiId ? pegawaiPerId.get(u.pegawaiId) : null;
    const nama = pegawai?.nama ?? u.nama ?? "-";
    await db.usulanPegawai.update(
      { id: u.id },
      {
        status: "menunggu",
        nomorSurat,
        tanggalSurat,
        pathBerkas: berkas.jalur.pathBerkas ?? u.pathBerkas,
        diajukanOleh,
        diajukanAt: sekarang,
      },
    );
    terkirim.push(nama);

    try {
      await db.notifikasi.create({
        ...notifikasiUsulanUpt({ ...u, nomorSurat }, { nama, nip: pegawai?.nip ?? u.nip ?? null }),
        id: newId(),
        dibaca: false,
        createdAt: new Date(),
      });
    } catch {
      // Usulannya sudah berstatus menunggu; notifikasinya menyusul lewat pemeriksaan berkala.
    }
  }

  logAudit({
    userId: pengguna.id,
    aksi: "usul_data_pegawai",
    detail: `Usulan ${terkirim.length} pegawai dari ${satker.nama} dengan surat ${nomorSurat}: ${terkirim.join(", ")}`,
    targetNama: satker.nama,
  });

  return NextResponse.json({ ok: true, jumlah: terkirim.length });
}
