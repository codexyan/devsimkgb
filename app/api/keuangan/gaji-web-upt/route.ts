import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cariDalam } from "@/lib/dataSatker";
import { kodeSatkerPegawai } from "@/lib/rekapSatker";
import { auth } from "@/auth";
import { canViewKGB } from "@/lib/auth";
import { SATKER_UPT, waktuUnggahSk } from "@/lib/aksesUpt";
import { hariIniWita, isoTanggalLokal } from "@/lib/waktu";
import type { SuratKgbTersimpan } from "@/lib/prosesKgb";

export const runtime = "nodejs";

/** SK lama yang dikonfirmasi keuangan Kanwil sebelum ADR-009 hanya dipantau selama rentang ini. */
const HARI_SK_LAMA = 60;
const HARI_MS = 86_400_000;

/**
 * Pemantauan Kanwil atas SK pegawai UPT yang belum direkam di Gaji Web satkernya (ADR-009).
 *
 * Sejak SK diunggah Tim SDM, keuangan UPT yang menetapkan rapelan dan merekamnya; Kanwil tidak dapat
 * mengubah apa pun di sini, hanya melihat SK mana yang sudah lama menunggu agar dapat mengingatkan UPT-nya.
 * Dibaca Super Admin, Tim SDM KGB, dan Keuangan Kanwil.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewKGB(session.user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sekarang = Date.now();
  const batasLama = sekarang - HARI_SK_LAMA * HARI_MS;
  // Hanya KGB yang mungkin tampil, pegawai cukup nama dan unit kerjanya, dan surat hanya milik KGB itu (ADR-079).
  const [semuaKgb, semuaPegawai] = await Promise.all([
    db.riwayatKGB.findMany({
      where: {
        inputGajiWebAt: null,
        OR: [{ status: "menunggu_keuangan" }, { status: "selesai", konfirmasiKeuanganAt: { gte: new Date(batasLama) } }],
      },
    }),
    db.pegawai.findKolom(["id", "nama", "nip", "unitKerja"]),
  ]);
  const semuaSurat = await cariDalam(
    (where) => db.suratKGB.findMany({ where }) as Promise<SuratKgbTersimpan[]>,
    "kgbId",
    semuaKgb.map((k) => k.id),
  );
  const suratByKgb = new Map(semuaSurat.map((s) => [s.kgbId, s]));
  // Satker tiap pegawai dicocokkan sekali, bukan sekali per satker.
  const kodePegawai = new Map(semuaPegawai.map((p) => [p.id, kodeSatkerPegawai(p.unitKerja)]));

  const satker = SATKER_UPT.map((st) => {
    const pegawaiById = new Map(semuaPegawai.filter((p) => kodePegawai.get(p.id) === st.kode).map((p) => [p.id, p]));
    const sk = semuaKgb
      .filter((k) => pegawaiById.has(k.pegawaiId) && !k.isArsip && !k.inputGajiWebAt)
      .filter(
        (k) =>
          k.status === "menunggu_keuangan" ||
          (k.status === "selesai" && !!k.konfirmasiKeuanganAt && new Date(k.konfirmasiKeuanganAt).getTime() >= batasLama),
      )
      .map((k) => {
        const p = pegawaiById.get(k.pegawaiId)!;
        const diunggah = waktuUnggahSk(suratByKgb.get(k.id)?.pathFile) ?? (k.konfirmasiKeuanganAt ? new Date(k.konfirmasiKeuanganAt) : null);
        return {
          kgbId: k.id,
          nama: p.nama,
          nip: p.nip,
          tmtKgbBaru: k.tmtKgbBaru ? isoTanggalLokal(new Date(k.tmtKgbBaru)) : null,
          diunggahAt: diunggah?.toISOString() ?? null,
          hariMenunggu: diunggah ? Math.max(0, Math.floor((sekarang - diunggah.getTime()) / HARI_MS)) : null,
        };
      })
      .sort((a, b) => (b.hariMenunggu ?? -1) - (a.hariMenunggu ?? -1));
    return { satker: { kode: st.kode, nama: st.nama }, sk };
  })
    .filter((r) => r.sk.length > 0)
    .sort((a, b) => (b.sk[0].hariMenunggu ?? -1) - (a.sk[0].hariMenunggu ?? -1));

  return NextResponse.json({ hariIni: isoTanggalLokal(hariIniWita()), satker });
}
