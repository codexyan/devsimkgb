import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { bandingkanUsulan, nilaiUsulan, ringkasHukdisUsulan } from "@/lib/usulanPegawai";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Antrian usulan data pegawai dari UPT untuk ditinjau Kanwil. Peninjaunya Super Admin dan Tim SDM KGB
 * (canProcessKGB), karena merekalah yang memakai datanya untuk memproses KGB.
 * Perbandingan dengan data induk dihitung di sini agar peramban tidak perlu memuat seluruh data pegawai.
 */
export async function GET(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status") ?? "";
  const [semuaUsulan, semuaPegawai] = await Promise.all([
    db.usulanPegawai.findMany(status ? { where: { status } } : undefined) as Promise<UsulanPegawaiRow[]>,
    db.pegawai.findMany(),
  ]);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));
  const namaSatker = new Map(SATKER.map((s) => [s.kode, s.nama]));

  const daftar = semuaUsulan
    .map((u) => {
      const p = pegawaiById.get(u.pegawaiId);
      return {
        id: u.id,
        pegawaiId: u.pegawaiId,
        nama: p?.nama ?? "-",
        nip: p?.nip ?? "-",
        unitKerja: namaSatker.get(u.satker) ?? u.satker,
        status: u.status,
        nomorSurat: u.nomorSurat,
        tanggalSurat: u.tanggalSurat ? new Date(u.tanggalSurat).toISOString() : null,
        berkasAda: !!u.pathBerkas,
        // Usulan yang menunggu dibandingkan dengan data induk; yang sudah ditinjau menampilkan nilai
        // yang diusulkan, karena data induk mungkin sudah menyamainya.
        perubahan: u.status === "menunggu" && p ? bandingkanUsulan(p, u) : [],
        nilaiDiusulkan: u.status === "menunggu" ? [] : nilaiUsulan(u),
        hukdis: ringkasHukdisUsulan(u),
        hukdisKeterangan: u.hukdisKeterangan,
        nomorSkTerakhir: u.nomorSkTerakhir,
        tanggalSkTerakhir: u.tanggalSkTerakhir ? new Date(u.tanggalSkTerakhir).toISOString() : null,
        catatanUpt: u.catatanUpt,
        diajukanOleh: u.diajukanOleh,
        diajukanAt: u.diajukanAt ? new Date(u.diajukanAt).toISOString() : null,
        ditinjauOleh: u.ditinjauOleh,
        ditinjauAt: u.ditinjauAt ? new Date(u.ditinjauAt).toISOString() : null,
        alasanTolak: u.alasanTolak,
      };
    })
    .sort((a, b) => {
      // Yang menunggu selalu di atas, lalu yang paling lama diajukan lebih dulu.
      if ((a.status === "menunggu") !== (b.status === "menunggu")) return a.status === "menunggu" ? -1 : 1;
      return (a.diajukanAt ?? "").localeCompare(b.diajukanAt ?? "");
    });

  return NextResponse.json(daftar);
}
