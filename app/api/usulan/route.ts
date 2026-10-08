import { NextResponse } from "next/server";
import { db, type Where } from "@/lib/db";
import { cariDalam, pegawaiMenurutId } from "@/lib/dataSatker";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { BERKAS_USULAN, bandingkanUsulan, nilaiUsulan, perubahanPegawai, ringkasHukdisUsulan, namaAsliBerkas } from "@/lib/usulanPegawai";
import { ringkasDasarBaru } from "@/lib/dasarBaruUsulan";
import { cariSkTercatat, catatanSkDilaporkan, usulanBaruMenurutSk, usulanMenurutSk } from "@/lib/dasarSkUsulan";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { RiwayatKGBRow, RiwayatPangkatRow, RiwayatPmkRow, UsulanPegawaiRow } from "@/lib/sheets/tables";
import { jadikanPerbaikan, nipBaruTercatat } from "@/lib/usulanBaruTercatat";
import { kgbBerjalanTerbaru } from "@/lib/dataPegawai";
import { suratSudahDibuat, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { penetapSkAcuanUsulan } from "@/lib/penetapSk";

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

  const params = new URL(req.url).searchParams;
  const status = params.get("status") ?? "";
  // Draf adalah data yang masih disiapkan UPT dan belum diajukan, jadi tidak pernah tampil di Kanwil.
  const saring = status && status !== "draf" ? { status } : { status: { not: "draf" } };

  // Lencana sidebar hanya perlu angkanya, dan sidebar ikut pada setiap halaman. Tanpa jalan pintas ini
  // satu lencana menarik seluruh pegawai, riwayat KGB, dan surat hanya untuk dihitung panjangnya.
  if (params.get("ringkas") === "1") {
    return NextResponse.json({ jumlah: await db.usulanPegawai.count(saring) });
  }

  const [usulanTersimpan, namaPegawai] = await Promise.all([
    db.usulanPegawai.findMany({ where: saring }) as Promise<UsulanPegawaiRow[]>,
    db.pegawai.findKolom(["id", "nama", "nip"]),
  ]);
  // Usulan pegawai baru yang menunggu sementara NIP-nya sudah tercatat (ADR-091): pegawainya ikut dimuat, supaya usulan
  // di satker yang sama ditinjau sebagai perbaikan data pegawai itu, sama dengan yang terjadi saat disetujui.
  const idPerNip = new Map(namaPegawai.map((p) => [p.nip, p.id]));
  const idTercatat = (u: UsulanPegawaiRow) =>
    u.jenis === "baru" && u.status === "menunggu" && u.nip ? (idPerNip.get(u.nip) ?? null) : null;
  // Data induk lengkap dan riwayatnya hanya dibutuhkan usulan yang menunggu; usulan lain cukup nama dan NIP. Seluruh
  // tabel tidak lagi dibaca untuk setiap pembukaan daftar (ADR-079).
  const idMenunggu = [
    ...new Set(
      usulanTersimpan.flatMap((u) => (u.status !== "menunggu" ? [] : u.pegawaiId ? [u.pegawaiId] : [idTercatat(u)])).filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  const dariPegawai = <T>(ambil: (where: Where) => Promise<T[]>) => cariDalam(ambil, "pegawaiId", idMenunggu);
  const [semuaPegawai, semuaKgb, semuaPangkat, semuaPmk] = await Promise.all([
    pegawaiMenurutId(idMenunggu),
    dariPegawai((where) => db.riwayatKGB.findMany({ where }) as Promise<RiwayatKGBRow[]>),
    // SK yang dilaporkan dan sudah tercatat: hasil persetujuan yang terputus, atau laporan ulang (ADR-079).
    dariPegawai((where) => db.riwayatPangkat.findMany({ where }) as Promise<RiwayatPangkatRow[]>),
    dariPegawai((where) => db.riwayatPmk.findMany({ where }) as Promise<RiwayatPmkRow[]>),
  ]);
  const semuaSurat = await cariDalam(
    (where) => db.suratKGB.findMany({ where }) as Promise<SuratKgbTersimpan[]>,
    "kgbId",
    semuaKgb.map((k) => k.id),
  );
  const namaById = new Map(namaPegawai.map((p) => [p.id, p]));
  const pangkatPerPegawai = new Map<string, RiwayatPangkatRow[]>();
  for (const r of semuaPangkat) pangkatPerPegawai.set(r.pegawaiId, [...(pangkatPerPegawai.get(r.pegawaiId) ?? []), r]);
  const pmkPerPegawai = new Map<string, RiwayatPmkRow[]>();
  for (const r of semuaPmk) pmkPerPegawai.set(r.pegawaiId, [...(pmkPerPegawai.get(r.pegawaiId) ?? []), r]);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));
  /** Keadaan NIP usulan pegawai baru yang sudah tercatat, per id usulan (ADR-091). */
  const nipTercatat = new Map<string, { nama: string; unitKerja: string; satkerSama: boolean }>();
  const semuaUsulan = usulanTersimpan.map((u) => {
    const id = idTercatat(u);
    const tercatat = id ? pegawaiById.get(id) : undefined;
    const keadaan = nipBaruTercatat(u, tercatat);
    if (!keadaan || !tercatat) return u;
    nipTercatat.set(u.id, { nama: tercatat.nama, unitKerja: tercatat.unitKerja, satkerSama: keadaan === "satker_sama" });
    return keadaan === "satker_sama" ? jadikanPerbaikan(u, tercatat) : u;
  });
  const kgbPerPegawai = new Map<string, RiwayatKGBRow[]>();
  for (const k of semuaKgb) kgbPerPegawai.set(k.pegawaiId, [...(kgbPerPegawai.get(k.pegawaiId) ?? []), k]);
  const suratByKgb = new Map(semuaSurat.map((sr) => [sr.kgbId, sr]));

  /**
   * KGB pegawai yang tersentuh bila usulan disetujui (ADR-011, ADR-014): yang sedang berjalan, atau jadwal
   * Belum Diproses bila tidak ada yang berjalan. Peninjau melihatnya sebelum memutuskan.
   */
  const kgbTerdampak = (pegawaiId: string | null) => {
    if (!pegawaiId) return null;
    const daftar = kgbPerPegawai.get(pegawaiId) ?? [];
    const k = kgbBerjalanTerbaru(daftar) ?? daftar.find((x) => x.status === "belum_diproses") ?? null;
    if (!k) return null;
    return { status: k.status, tmtKgbBaru: isoTanggalKalender(k.tmtKgbBaru), skDibuat: suratSudahDibuat(suratByKgb.get(k.id)) };
  };
  const namaSatker = new Map(SATKER.map((s) => [s.kode, s.nama]));

  const daftar = semuaUsulan
    .map((u) => {
      // Baris lengkap hanya untuk usulan yang menunggu; nama dan NIP untuk semuanya.
      const p = u.pegawaiId ? pegawaiById.get(u.pegawaiId) : null;
      const n = u.pegawaiId ? namaById.get(u.pegawaiId) : null;
      const tercatat =
        p && u.status === "menunggu"
          ? cariSkTercatat(u, { pangkat: pangkatPerPegawai.get(p.id), pmk: pmkPerPegawai.get(p.id) })
          : null;
      return {
        id: u.id,
        pegawaiId: u.pegawaiId,
        jenis: u.jenis,
        /** Diajukan sebagai pegawai baru padahal NIP-nya sudah tercatat (ADR-091); null bila tidak. */
        nipTercatat: nipTercatat.get(u.id) ?? null,
        nama: n?.nama ?? u.nama ?? "-",
        nip: n?.nip ?? u.nip ?? "-",
        unitKerja: namaSatker.get(u.satker) ?? u.satker,
        status: u.status,
        nomorSurat: u.nomorSurat,
        tanggalSurat: u.tanggalSurat ? new Date(u.tanggalSurat).toISOString() : null,
        berkas: BERKAS_USULAN.filter((b) => u[b.kunci]).map((b) => ({ medan: b.medan, label: b.label, nama: namaAsliBerkas(u[b.kunci]) })),
        // Usulan yang menunggu dibandingkan dengan data induk; yang sudah ditinjau menampilkan nilai
        // yang diusulkan, karena data induk mungkin sudah menyamainya.
        // Usulan pegawai baru belum punya pembanding, jadi selalu menampilkan nilai yang diusulkan.
        // Kolom dasar gaji pada laporan SK kenaikan pangkat atau PMK ditampilkan menurut hitungan SK-nya,
        // yang sama dengan yang diterapkan saat disetujui, bukan angka mentah usulan (ADR-052).
        perubahan: u.status === "menunggu" && p ? bandingkanUsulan(p, usulanMenurutSk(p, u, perubahanPegawai(u), tercatat)) : [],
        nilaiDiusulkan: u.status === "menunggu" && p ? [] : nilaiUsulan(u.jenis === "baru" ? usulanBaruMenurutSk(u) : u),
        hukdis: ringkasHukdisUsulan(u),
        // SK kenaikan pangkat atau PMK yang disebut UPT sebagai sebab perubahan dasar gaji (ADR-030).
        dasarBaru: ringkasDasarBaru(u),
        // Hasil hitungan SK yang dilaporkan: pada pegawai baru, keadaan pada SK KGB terakhir atau hitungan mundurnya
        // (ADR-065); pada keduanya, masa kerja yang tertulis pada SK kenaikan pangkat dicocokkan dengan hitungan sistem
        // (ADR-078). Pegawai yang sudah disetujui tidak lagi dibandingkan, sebab data induknya sudah berubah.
        catatanSkBaru: u.jenis === "baru" || u.status === "menunggu" ? catatanSkDilaporkan(u, p, tercatat) : null,
        hukdisKeterangan: u.hukdisKeterangan,
        nomorSkTerakhir: u.nomorSkTerakhir,
        tanggalSkTerakhir: u.tanggalSkTerakhir ? new Date(u.tanggalSkTerakhir).toISOString() : null,
        // Isian UPT, atau saran dari awalan nomornya bila usulan dibuat sebelum isian itu ada (ADR-086).
        penetapSkTerakhir: u.nomorSkTerakhir?.trim() ? penetapSkAcuanUsulan(u) : null,
        catatanUpt: u.catatanUpt,
        kgb: u.status === "menunggu" ? kgbTerdampak(u.pegawaiId) : null,
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
