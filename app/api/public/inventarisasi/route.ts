import { NextResponse } from "next/server";
import { adaPenandaPdf } from "@/lib/prosesKgb";
import {
  BATAS_BERKAS_INVENTARIS_BYTE,
  BERKAS_MAKS_PER_KIRIMAN,
  berkasUntuk,
  keadaanFormulir,
  namaBerkasInventaris,
  periksaIsianInventaris,
  tanggalUntukBerkas,
  type IsianInventaris,
  type JenisBerkasInventaris,
} from "@/lib/inventarisKgb";
import { bacaKegiatan, simpanKiriman } from "@/lib/inventarisServer";
import { ID_KEGIATAN_KANWIL, TEMPLATE_KEGIATAN, satkerPilihan } from "@/lib/kegiatanInventaris";

export const runtime = "nodejs";

const BIDANG: (keyof IsianInventaris)[] = [
  "nip", "nama", "tempatLahir", "tanggalLahir", "jabatan", "bidang", "golonganRuang", "tmtGolongan",
  "naikSetelahKgb", "pmkSetelahKgb", "tmtPmk", "tanggalSkPmk", "mkgTahun", "mkgBulan", "tmtDasar", "nomorSkDasar", "tanggalSkDasar", "tanggalSkPendukung", "nomorWa", "catatan", "satker",
];

/**
 * Kiriman formulir kegiatan pengumpulan data (/inventarisasi-kgb[/<kegiatan>], ADR-022). Kegiatannya dibawa pada
 * ?kegiatan= (bawaan "kanwil"), supaya formulir yang ditutup ditolak sebelum isinya dibaca. Tanpa login: yang
 * menjaga adalah kode akses kegiatan yang diumumkan di grup WA (diatur Super Admin), pembatas percobaan per alamat IP di worker-entry.js
 * (kode salah dihitung gagal, jawaban 403), serta pemeriksaan isian dan berkas PDF di sini.
 */
export async function POST(req: Request) {
  const kegiatan = await bacaKegiatan(new URL(req.url).searchParams.get("kegiatan") ?? ID_KEGIATAN_KANWIL);
  if (!kegiatan) return NextResponse.json({ error: "Formulir tidak ditemukan. Periksa kembali tautannya." }, { status: 404 });
  const keadaanForm = keadaanFormulir(kegiatan);
  if (keadaanForm === "ditutup")
    return NextResponse.json({ error: "Formulir sedang ditutup. Tunggu pengumuman dari Tim SDM Kanwil." }, { status: 403 });
  // 410, bukan 403: pegawai yang terlambat mengirim tidak dihitung sebagai percobaan kode salah di worker-entry.js.
  if (keadaanForm === "lewat_batas")
    return NextResponse.json(
      { error: "Batas pengisian sudah lewat, jadi formulir sudah ditutup. Hubungi Tim SDM Kanwil bila data Anda belum terkirim." },
      { status: 410 },
    );

  const panjang = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjang) && panjang > BERKAS_MAKS_PER_KIRIMAN * BATAS_BERKAS_INVENTARIS_BYTE + 64 * 1024)
    return NextResponse.json({ error: "Ukuran kiriman terlalu besar. Tiap berkas paling besar 1 MB." }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data formulir tidak valid." }, { status: 400 });
  }
  const teks = (k: string) => String(form.get(k) ?? "").trim();

  if (teks("kode").toUpperCase() !== kegiatan.kode.trim().toUpperCase())
    return NextResponse.json({ error: "Kode akses salah. Lihat pengumuman di grup WA." }, { status: 403 });

  const keadaan = teks("keadaan") === "belum" ? "belum" : "pernah";
  const isian = { keadaan } as IsianInventaris;
  for (const k of BIDANG) (isian as unknown as Record<string, string>)[k] = teks(k);

  const pakaiSatker = TEMPLATE_KEGIATAN[kegiatan.template].pakaiSatker;
  if (!pakaiSatker) delete isian.satker;
  const kurang = periksaIsianInventaris(
    isian,
    undefined,
    pakaiSatker ? satkerPilihan(kegiatan).map((s) => s.kode) : undefined,
  );
  const berkas: { jenis: JenisBerkasInventaris; nama: string; isi: ArrayBuffer }[] = [];
  for (const aturan of berkasUntuk(isian)) {
    const f = form.get(aturan.jenis);
    if (!(f instanceof File) || f.size === 0) {
      if (aturan.wajib) kurang.push(`berkas ${aturan.label}`);
      continue;
    }
    if (f.size > BATAS_BERKAS_INVENTARIS_BYTE) {
      kurang.push(`${aturan.label} lebih dari 1 MB`);
      continue;
    }
    const isi = await f.arrayBuffer();
    if (!adaPenandaPdf(new Uint8Array(isi.slice(0, 1024)))) {
      kurang.push(`${aturan.label} bukan berkas PDF`);
      continue;
    }
    berkas.push({
      jenis: aturan.jenis,
      nama: namaBerkasInventaris(isian.nip, aturan.jenis, tanggalUntukBerkas(isian, aturan.jenis)),
      isi,
    });
  }
  if (kurang.length > 0) return NextResponse.json({ error: "Periksa kembali isian.", kurang }, { status: 400 });

  try {
    const kiriman = await simpanKiriman(kegiatan.id, isian, berkas);
    return NextResponse.json({ ok: true, kirimanKe: kiriman.kirimanKe }, { status: 201 });
  } catch (err) {
    console.error("[inventarisasi] gagal menyimpan:", err);
    return NextResponse.json({ error: "Kiriman gagal disimpan. Coba lagi beberapa saat lagi." }, { status: 500 });
  }
}
