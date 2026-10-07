import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { akunUpt } from "@/lib/auth/akunUpt";
import { pegawaiSatker } from "@/lib/aksesUpt";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { muatKppnSatker } from "@/lib/muatKppnSatker";
import { SATKER } from "@/lib/satker";
import { bacaAcuan, bacaDasarBaru, bacaIsianBaris } from "@/lib/usulanFormulir";
import { bacaTanggalInput, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import { dasarSkPratinjau, keadaanSesudahUsulan, rencanaKgbPratinjau } from "@/lib/pratinjauSkUsulan";
import { cariSkTercatat, type SkTercatat } from "@/lib/dasarSkUsulan";
import { satkerSurat, susunDataSuratKgb, type PenandatanganSurat } from "@/lib/dataSuratKgbServer";
import { JABATAN_BAWAAN, tentukanPenandatangan } from "@/lib/penandatangan";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { makeRiwayatKGB, type PegawaiRow, type RiwayatKGBRow, type RiwayatPangkatRow, type RiwayatPmkRow, type UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Pratinjau SK hanya untuk akun Admin UPT yang tertaut ke satker.";

/** Nomor surat pada pratinjau: nomornya baru diberikan Kanwil saat membuat SK. */
const NOMOR_PRATINJAU = "(nomor diberikan Kanwil saat membuat SK)";

/**
 * Pratinjau SK KGB berikutnya dari isian formulir usulan, sebelum disimpan atau diajukan (ADR-078). Tidak menulis apa
 * pun. Isinya disusun lib/dataSuratKgbServer.ts, sama dengan SK yang kelak dibuat Kanwil; PDF-nya disusun di peramban
 * dengan tanda air.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  await muatKppnSatker();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Isian pratinjau tidak valid" }, { status: 400 });
  }
  const teks = (kunci: string) => {
    const nilai = body[kunci];
    return nilai === null || nilai === undefined ? "" : String(nilai).trim();
  };
  const jenis = teks("jenis") === "baru" ? "baru" : "perubahan";

  const dibaca = bacaIsianBaris(body);
  if ("galat" in dibaca) return NextResponse.json({ error: dibaca.galat }, { status: 400 });
  const dasarBaru = bacaDasarBaru(teks);
  const usulan: Partial<UsulanPegawaiRow> = {
    ...dibaca.isian,
    ...dasarBaru,
    ...bacaAcuan(teks, dasarBaru),
    nomorSkTerakhir: teks("nomorSkTerakhir") || null,
    tanggalSkTerakhir: teks("tanggalSkTerakhir") ? bacaTanggalInput(teks("tanggalSkTerakhir")) : null,
  };

  let pegawaiLama: PegawaiRow | null = null;
  if (jenis === "perubahan") {
    const pegawai = teks("pegawaiId") ? await db.pegawai.findUnique({ id: teks("pegawaiId") }) : null;
    // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
    if (!pegawai || pegawaiSatker([pegawai], akun.kode).length === 0)
      return NextResponse.json({ error: "Pegawai tidak ditemukan di satker ini" }, { status: 404 });
    pegawaiLama = pegawai;
  }

  // Riwayat SK pegawai yang sudah tercatat menentukan Atas dasar, sama dengan Buat SK Kanwil (ADR-062), dan mengenali SK
  // yang dilaporkan ulang (ADR-079).
  let tercatat: SkTercatat | null = null;
  let riwayatTercatat: Omit<Parameters<typeof dasarSkPratinjau>[0], "usulan" | "pegawaiLama" | "tmtKgbBaru"> = {};
  if (pegawaiLama) {
    const id = pegawaiLama.id;
    const [kgb, surat, pangkat, pmk] = await Promise.all([
      db.riwayatKGB.findMany({ where: { pegawaiId: id } }) as Promise<RiwayatKGBRow[]>,
      db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
      db.riwayatPangkat.findMany({ where: { pegawaiId: id } }) as Promise<RiwayatPangkatRow[]>,
      db.riwayatPmk.findMany({ where: { pegawaiId: id } }) as Promise<RiwayatPmkRow[]>,
    ]);
    tercatat = cariSkTercatat(usulan, { pangkat, pmk });
    const suratByKgb = new Map(surat.map((s) => [s.kgbId, s]));
    riwayatTercatat = {
      kgb: kgb.map((k) => ({ ...k, surat: suratByKgb.get(k.id) ?? null })),
      pangkat: pangkat.map((r) => ({ id: r.id, nomorSK: r.nomorSK, tanggalSK: r.tanggalSK, tmt: r.tmtPangkat, jenisKp: r.jenisKp, penetapSK: r.penetapSK })),
      pmk: pmk.map((r) => ({ id: r.id, nomorSK: r.nomorSK, tanggalSK: r.tanggalSK, tmt: r.tmtPmk, penetapSK: r.penetapSK })),
    };
  }

  const keadaan = keadaanSesudahUsulan(usulan, pegawaiLama, tercatat);
  if (!keadaan.ok) return NextResponse.json({ error: keadaan.pesan }, { status: 422 });
  const hariIni = hariIniWita();
  const rencana = rencanaKgbPratinjau(keadaan.nilai, hariIni);
  if (!rencana.ok) return NextResponse.json({ error: rencana.pesan }, { status: 422 });

  // SK yang sudah tercatat tidak ditambahkan lagi sebagai calon Atas dasar.
  const usulanDasar = tercatat ? { ...usulan, dasarBaruJenis: null } : usulan;
  const dasar = dasarSkPratinjau({ usulan: usulanDasar, pegawaiLama, tmtKgbBaru: rencana.nilai.tmtKgbBaru, ...riwayatTercatat });

  const unitKerja = pegawaiLama ? pegawaiLama.unitKerja : SATKER.find((s) => s.kode === akun.kode)?.nama ?? "";
  const satker = satkerSurat(unitKerja);
  if (!satker)
    return NextResponse.json({ error: `Unit kerja "${unitKerja ?? ""}" belum sesuai daftar satker, sehingga SK tidak dapat disusun.` }, { status: 422 });

  const catatan: string[] = [];
  const nip = String(usulan.nip ?? pegawaiLama?.nip ?? "");
  const hasilTtd = tentukanPenandatangan(await db.penandatangan.findMany(), hariIni, nip);
  let penandatangan: PenandatanganSurat;
  if (hasilTtd.ok) {
    penandatangan = { jenis: hasilTtd.penandatangan.jenis, jabatan: hasilTtd.jabatan, nama: hasilTtd.penandatangan.nama };
  } else {
    penandatangan = { jenis: "definitif", jabatan: JABATAN_BAWAAN.definitif, nama: "(ditetapkan Kanwil)" };
    catatan.push("Penandatangan untuk tanggal hari ini belum diatur Kanwil, jadi namanya belum tampil.");
  }
  if (!dasar) catatan.push("Atas dasar SK belum dapat ditentukan: lengkapi nomor dan tanggal SK KGB terakhir atau SK yang dilaporkan.");
  else if (!dasar.penetap?.trim()) catatan.push("Pejabat penetap SK dasar belum diketahui; Kanwil mengisinya saat Input KGB.");
  if (rencana.nilai.flagRapelan)
    catatan.push(`TMT KGB ${formatTanggalId(rencana.nilai.tmtKgbBaru)} sudah lewat batas proses, jadi KGB ini dibayarkan sebagai rapelan.`);

  const kgb = makeRiwayatKGB({
    id: "pratinjau",
    pegawaiId: pegawaiLama?.id ?? "",
    ...rencana.nilai,
    nomorSK: dasar?.nomorSK ?? usulan.nomorSkTerakhir ?? "",
    tanggalSK: tanggalKalender(dasar?.tanggalSK ?? usulan.tanggalSkTerakhir),
    tmtSK: tanggalKalender(dasar?.tmt ?? keadaan.nilai.tmtKgbTerakhir),
    penetapSkDasar: dasar?.penetap ?? null,
    status: "sedang_diproses",
  });
  const pegawai = {
    ...(pegawaiLama ?? {}),
    nama: String(usulan.nama ?? pegawaiLama?.nama ?? ""),
    nip,
    pangkat: keadaan.nilai.pangkat,
    golonganRuang: keadaan.nilai.golonganRuang,
    unitKerja,
  } as PegawaiRow;

  const surat = await susunDataSuratKgb({ kgb, pegawai, satker, nomorSurat: NOMOR_PRATINJAU, tanggalSurat: hariIni, penandatangan });
  return NextResponse.json({ surat, catatan, atasDasar: dasar ? { label: dasar.label, nomorSK: dasar.nomorSK, tmt: dasar.tmt } : null });
}
