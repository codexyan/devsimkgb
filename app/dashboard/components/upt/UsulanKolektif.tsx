"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BATAS_BERKAS_USULAN_BYTE, PESAN_BERKAS_TERLALU_BESAR, berkasUntukKeadaan, hitungUsulan, pernahKgb } from "@/lib/usulanPegawai";
import { BIDANG_DIISI } from "@/lib/usulanFormulir";
import {
  KETERANGAN_DASAR_BARU,
  LABEL_DASAR_BARU,
  kekuranganDasarBaru,
  perluDasarBaru,
  type JenisDasarBaru,
} from "@/lib/dasarBaruUsulan";
import { JENIS_KP } from "@/lib/kenaikanPangkat";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { kunciBulanTmt } from "@/lib/rekapKgb";
import { geserBulan, namaBulan } from "@/app/dashboard/satker/labelSatker";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";

/* Usulan kolektif Admin UPT (ADR-015, ADR-029). Satu surat Srikandi lazimnya memuat banyak pegawai: pegawai baru,
   perbaikan data, dan kelengkapan berkas sekaligus. Halaman ini tiga langkah:
     1. Pilih pegawai: dikelompokkan per bulan TMT, dengan saringan jatuh tempo periode ini, ada draf, dan semua.
     2. Lengkapi: daftar pegawai terpilih di kiri dengan lingkar kelengkapan, detail satu pegawai di kanan (keadaan
        KGB, dasar gaji dengan gaji pokok hasil hitungan, berkas tarik-lepas, catatan). Tanpa gulir mendatar.
     3. Ajukan: pilih draf yang siap, isi surat, lalu kirim ke Kanwil.
   Tiap pegawai tetap disimpan lewat rute yang sama dengan formulir perorangan (POST/PATCH /api/upt/usulan),
   sehingga aturan kelengkapan dan pemeriksaannya tidak berbeda. SK dasar dan berkas yang sudah disetujui Kanwil
   ikut terbawa (lib/bawaanUsulan.ts); laporan hukuman disiplin lewat modulnya sendiri. Dibuka dari pengingat
   dashboard dengan ?bulan=yyyy-mm, pegawai jatuh tempo bulan itu langsung tercentang. */

interface PegawaiUpt {
  id: string;
  nama: string;
  nip: string;
  golonganRuang: string;
  tmtKgb: string | null;
  bulanTmt: string | null;
  statusKGB: string | null;
  usulanBerjalan?: string | null;
  dataSekarang: Record<string, string>;
  bawaan?: { nomorSkTerakhir: string; tanggalSkTerakhir: string; berkas: BerkasTersimpan[] };
}

interface BerkasTersimpan {
  medan: string;
  label: string;
  nama?: string | null;
  /** Terisi bila berkasnya bawaan dari usulan yang sudah disetujui, belum milik draf ini. */
  usulanId?: string;
}

interface DrafUpt {
  id: string;
  pegawaiId: string | null;
  jenis: string;
  nama: string;
  nip: string;
  status: string;
  nilai: Record<string, string> | null;
  surat: { nomorSkTerakhir: string; tanggalSkTerakhir: string; catatanUpt: string } | null;
  hukdis: { ada: boolean; jenis: string; nomorSk: string; tmtMulai: string; tmtBerakhir: string; keterangan: string } | null;
  dasarBaru: { jenis: string; jenisKp: string; nomorSk: string; tanggalSk: string; tmt: string; penetap: string } | null;
  berkas: { medan: string; label: string; nama?: string | null }[];
  kekurangan: string[];
}

type Keadaan = "siap" | "menyimpan" | "tersimpan" | "galat";

interface Baris {
  kunci: string;
  pegawaiId: string | null;
  drafId: string | null;
  jenis: "perubahan" | "baru";
  nama: string;
  nip: string;
  /** Nilai tercatat (data pegawai atau isi draf); pembanding untuk menandai yang berubah. */
  awal: Record<string, string>;
  isian: Record<string, string>;
  pernah: boolean;
  berkas: Record<string, File | null>;
  tersimpan: BerkasTersimpan[];
  /** Berkas yang sudah disetujui Kanwil; disalin server ke draf bila kolomnya masih kosong. */
  bawaan: BerkasTersimpan[];
  catatanUpt: string;
  /** SK yang menetapkan gaji pokok baru, bila golongan atau masa kerja golongan berubah (ADR-030). */
  dasar: { jenis: string; jenisKp: string; nomorSk: string; tanggalSk: string; tmt: string; penetap: string };
  keadaan: Keadaan;
  pesan: string | null;
}

const DASAR_KOSONG = { jenis: "", jenisKp: "reguler", nomorSk: "", tanggalSk: "", tmt: "", penetap: "" };

/** Isian yang disunting di tabel; sisanya ikut dari data tercatat apa adanya. */
const KOLOM_TABEL = ["golonganRuang", "mkgTahun", "mkgBulan", "tmtKgbTerakhir", "nomorSkTerakhir", "tanggalSkTerakhir"] as const;

function barisDari(p: PegawaiUpt | null, d: DrafUpt | null): Baris {
  const data = d?.nilai ?? p?.dataSekarang ?? {};
  // SK dasar draf lebih dulu; bila kosong, yang sudah disetujui Kanwil sehingga tidak perlu diketik ulang.
  const skDraf = d?.surat?.nomorSkTerakhir?.trim() ? d.surat : null;
  const awal: Record<string, string> = {
    ...data,
    tmtKgbTerakhir: data.tmtKgbTerakhir || data.tmtGolongan || "",
    nomorSkTerakhir: skDraf?.nomorSkTerakhir ?? p?.bawaan?.nomorSkTerakhir ?? "",
    tanggalSkTerakhir: skDraf ? skDraf.tanggalSkTerakhir : (d?.surat?.tanggalSkTerakhir || p?.bawaan?.tanggalSkTerakhir || ""),
  };
  return {
    kunci: d ? `draf:${d.id}` : `pegawai:${p!.id}`,
    pegawaiId: p?.id ?? d?.pegawaiId ?? null,
    drafId: d?.id ?? null,
    jenis: d?.jenis === "baru" ? "baru" : "perubahan",
    nama: p?.nama ?? d?.nama ?? "-",
    nip: p?.nip ?? d?.nip ?? "-",
    awal,
    isian: { ...awal },
    pernah: pernahKgb(awal.mkgTahun, awal.mkgBulan),
    berkas: {},
    tersimpan: d?.berkas ?? [],
    bawaan: p?.bawaan?.berkas ?? [],
    catatanUpt: d?.surat?.catatanUpt ?? "",
    dasar: d?.dasarBaru ? { ...d.dasarBaru, jenisKp: d.dasarBaru.jenisKp || "reguler" } : { ...DASAR_KOSONG },
    keadaan: "siap",
    pesan: null,
  };
}

const berubah = (b: Baris) =>
  KOLOM_TABEL.some((k) => (b.isian[k] ?? "") !== (b.awal[k] ?? "")) ||
  Object.values(b.berkas).some(Boolean) ||
  !!b.dasar.jenis;

/* ── Kelengkapan satu baris: dihitung di peramban untuk lingkar kemajuan dan daftar kekurangan. Server tetap
   menjadi penentu akhir (kekurangan draf dari /api/upt/usulan) saat diajukan. ─────────────────────────────── */
function kelengkapan(b: Baris): { selesai: number; total: number; kurang: string[] } {
  const kurang: string[] = [];
  // Golongan dan masa kerja golongan hanya berubah karena kenaikan pangkat, PMK, atau salah ketik (ADR-030).
  const perluSebab =
    b.jenis !== "baru" &&
    perluDasarBaru(
      (["golonganRuang", "mkgTahun", "mkgBulan"] as const)
        .filter((k) => (b.isian[k] ?? "") !== (b.awal[k] ?? ""))
        .map((kunci) => ({ kunci })),
    );
  const kurangDasar = kekuranganDasarBaru(
    {
      dasarBaruJenis: b.dasar.jenis,
      dasarBaruJenisKp: b.dasar.jenisKp,
      dasarBaruNomorSk: b.dasar.nomorSk,
      dasarBaruTanggalSk: b.dasar.tanggalSk,
      dasarBaruTmt: b.dasar.tmt,
    },
    perluSebab,
  );
  const cek: [boolean, string][] = [
    ...(perluSebab || b.dasar.jenis ? ([[kurangDasar.length === 0, "SK yang mengubah gaji pokok"]] as [boolean, string][]) : []),
    [!!b.isian.golonganRuang, "golongan"],
    [!b.pernah || /^\d+$/.test(b.isian.mkgTahun ?? ""), "masa kerja"],
    [!!b.isian.tmtKgbTerakhir, b.pernah ? "TMT KGB terakhir" : "TMT CPNS"],
    [!!b.isian.nomorSkTerakhir?.trim(), "nomor SK dasar"],
    [!!b.isian.tanggalSkTerakhir, "tanggal SK dasar"],
  ];
  for (const jenis of berkasUntukKeadaan(b.pernah).filter((j) => j.wajib)) {
    const ada = !!b.berkas[jenis.medan] || b.tersimpan.some((t) => t.medan === jenis.medan) || b.bawaan.some((t) => t.medan === jenis.medan);
    cek.push([ada, jenis.label]);
  }
  for (const [ok, label] of cek) if (!ok) kurang.push(label);
  return { selesai: cek.length - kurang.length, total: cek.length, kurang };
}

/** Lingkar kemajuan kecil: penuh hijau bila lengkap. */
function Lingkar({ selesai, total }: { selesai: number; total: number }) {
  const r = 9;
  const keliling = 2 * Math.PI * r;
  const pecahan = total > 0 ? selesai / total : 0;
  return (
    <svg className="kol-lingkar" data-penuh={pecahan >= 1 ? "" : undefined} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r={r} className="kol-lingkar-dasar" />
      <circle cx="12" cy="12" r={r} className="kol-lingkar-isi" strokeDasharray={`${keliling * pecahan} ${keliling}`} transform="rotate(-90 12 12)" />
      {pecahan >= 1 && <path d="M8 12.5l2.6 2.5L16 9.5" className="kol-lingkar-centang" />}
    </svg>
  );
}

const rupiah = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
const ukuranBerkas = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

type Langkah = 1 | 2 | 3;
type Saring = "periode" | "draf" | "semua";

export default function UsulanKolektif() {
  const [pegawai, setPegawai] = useState<PegawaiUpt[]>([]);
  const [draf, setDraf] = useState<DrafUpt[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set());
  const [cari, setCari] = useState("");
  // Dibuka dari kartu Terlambat, saringan periode justru menyembunyikan yang baru saja dicentang:
  // TMT mereka sudah lewat bulan usulan. Karena itu halaman langsung dibuka pada "Semua".
  const [saring, setSaring] = useState<Saring>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("terlambat") === "1"
      ? "semua"
      : "periode",
  );
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [aktif, setAktif] = useState<string | null>(null);
  const [langkah, setLangkah] = useState<Langkah>(1);
  const [menyimpan, setMenyimpan] = useState(false);
  const [surat, setSurat] = useState({ nomorSurat: "", tanggalSurat: "" });
  const [berkasSurat, setBerkasSurat] = useState<File | null>(null);
  const [pilihAjukan, setPilihAjukan] = useState<Set<string>>(() => new Set());
  const [mengajukan, setMengajukan] = useState(false);
  const [selesai, setSelesai] = useState<string | null>(null);

  // Bulan usulan: dari pengingat dashboard (?bulan=yyyy-mm) bila ada, selain itu TMT dua bulan ke depan.
  const [bulanUsulan] = useState(() => {
    const dariTautan = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("bulan") : null;
    return dariTautan && /^\d{4}-\d{2}$/.test(dariTautan) ? dariTautan : geserBulan(kunciBulanTmt(hariIniWita()) ?? "", 2);
  });

  /**
   * Pencentangan awal saat halaman dibuka dari dashboard:
   *   "periode"   — ?bulan=yyyy-mm, pegawai jatuh tempo bulan itu;
   *   "terlambat" — ?terlambat=1, seluruh pegawai yang TMT-nya sudah lewat bulan usulan dan belum selesai.
   * Keduanya melewatkan pegawai yang usulannya sedang ditinjau Kanwil, sebab datanya memang terkunci.
   */
  async function muat(pilihAwal: "periode" | "terlambat" | null = null) {
    setMemuat(true);
    try {
      const [rp, ru] = await Promise.all([fetch("/api/upt"), fetch("/api/upt/usulan")]);
      const dp = (await rp.json().catch(() => ({}))) as { pegawai?: PegawaiUpt[]; error?: string };
      const du = (await ru.json().catch(() => [])) as DrafUpt[];
      if (!rp.ok) throw new Error(dp.error ?? "Data pegawai gagal dimuat");
      const daftar = dp.pegawai ?? [];
      setPegawai(daftar);
      setDraf(Array.isArray(du) ? du : []);
      if (pilihAwal) {
        // Untuk yang terlambat, yang dicentang hanya yang benar-benar masih menunggu tindakan UPT: Kanwil
        // belum memproses KGB-nya sama sekali. Yang SK-nya sudah terbit atau sedang diproses tidak perlu
        // diusulkan lagi, dan angka "menunggu tindakan Anda" di dashboard memakai batasan yang sama.
        const cocok = (p: PegawaiUpt) =>
          pilihAwal === "periode"
            ? p.bulanTmt === bulanUsulan
            : !!p.bulanTmt && p.bulanTmt < bulanUsulan && !p.statusKGB;
        setTerpilih(new Set(daftar.filter((p) => cocok(p) && p.usulanBerjalan !== "menunggu").map((p) => p.id)));
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data gagal dimuat");
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pilihAwal = q.has("bulan") ? "periode" : q.get("terlambat") === "1" ? "terlambat" : null;
    const t = setTimeout(() => void muat(pilihAwal), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Usulan yang masih dipegang UPT (draf atau dikembalikan), per pegawai. */
  const drafPerPegawai = useMemo(
    () => new Map(draf.filter((d) => d.pegawaiId && (d.status === "draf" || d.status === "revisi")).map((d) => [d.pegawaiId as string, d])),
    [draf],
  );
  const drafBaru = draf.filter((d) => d.jenis === "baru" && (d.status === "draf" || d.status === "revisi"));
  const dapatDipilih = (p: PegawaiUpt) => p.usulanBerjalan !== "menunggu";

  const q = cari.trim().toLowerCase();
  const jatuhTempo = pegawai.filter((p) => p.bulanTmt === bulanUsulan && dapatDipilih(p));
  const adaDraf = pegawai.filter((p) => drafPerPegawai.has(p.id));
  const daftarPilih = pegawai.filter(
    (p) =>
      (saring === "semua" || (saring === "periode" ? p.bulanTmt === bulanUsulan : drafPerPegawai.has(p.id))) &&
      (!q || `${p.nama} ${p.nip}`.toLowerCase().includes(q)),
  );
  /** Pegawai dikelompokkan per bulan TMT, terdekat lebih dulu. */
  const kelompokPilih = useMemo(() => {
    const peta = new Map<string, PegawaiUpt[]>();
    for (const p of daftarPilih) {
      const k = p.bulanTmt ?? "tanpa";
      peta.set(k, [...(peta.get(k) ?? []), p]);
    }
    return [...peta.entries()].sort(([a], [b]) => (a === "tanpa" ? 1 : b === "tanpa" ? -1 : a.localeCompare(b)));
  }, [daftarPilih]);

  function alih(id: string) {
    setTerpilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  }

  function pilihKelompok(daftar: PegawaiUpt[], centang: boolean) {
    setTerpilih((lama) => {
      const baru = new Set(lama);
      for (const p of daftar) {
        if (!dapatDipilih(p)) continue;
        if (centang) baru.add(p.id);
        else baru.delete(p.id);
      }
      return baru;
    });
  }

  function lanjutLengkapi() {
    // Baris yang sudah disusun dan masih dipilih dipertahankan beserta isiannya; yang baru dipilih ditambahkan.
    const lama = new Map((baris ?? []).map((b) => [b.kunci, b]));
    const dariPegawai = pegawai
      .filter((p) => terpilih.has(p.id))
      .map((p) => lama.get(drafPerPegawai.has(p.id) ? `draf:${drafPerPegawai.get(p.id)!.id}` : `pegawai:${p.id}`) ?? barisDari(p, drafPerPegawai.get(p.id) ?? null));
    const baru = drafBaru.map((d) => lama.get(`draf:${d.id}`) ?? barisDari(null, d));
    const susun = [...dariPegawai, ...baru];
    setBaris(susun);
    setAktif((a) => (a && susun.some((b) => b.kunci === a) ? a : susun[0]?.kunci ?? null));
    setSelesai(null);
    setLangkah(2);
  }

  function ubahBaris(kunci: string, ubah: (b: Baris) => Baris) {
    setBaris((lama) => lama?.map((b) => (b.kunci === kunci ? ubah({ ...b, keadaan: b.keadaan === "tersimpan" ? "siap" : b.keadaan }) : b)) ?? null);
  }

  function isi(kunci: string, kolom: string, nilai: string) {
    ubahBaris(kunci, (b) => ({ ...b, isian: { ...b.isian, [kolom]: nilai } }));
  }

  function pilihBerkas(kunci: string, medan: string, file: File | null) {
    if (file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      ubahBaris(kunci, (b) => ({ ...b, keadaan: "galat", pesan: "Berkas harus PDF." }));
      return;
    }
    if (file && file.size > BATAS_BERKAS_USULAN_BYTE) {
      ubahBaris(kunci, (b) => ({ ...b, keadaan: "galat", pesan: PESAN_BERKAS_TERLALU_BESAR }));
      return;
    }
    ubahBaris(kunci, (b) => ({ ...b, berkas: { ...b.berkas, [medan]: file }, keadaan: b.keadaan === "galat" ? "siap" : b.keadaan, pesan: null }));
  }

  /** Satu baris menjadi FormData yang sama dengan formulir perorangan (FormulirUsulan). */
  function formBaris(b: Baris): FormData {
    const form = new FormData();
    form.set("status", "draf");
    form.set("jenis", b.jenis);
    if (b.pegawaiId && b.jenis === "perubahan") form.set("pegawaiId", b.pegawaiId);
    for (const bidang of BIDANG_DIISI) form.set(bidang.kunci, b.isian[bidang.kunci] ?? "");
    form.set("nomorSkTerakhir", b.isian.nomorSkTerakhir ?? "");
    form.set("tanggalSkTerakhir", b.isian.tanggalSkTerakhir ?? "");
    form.set("catatanUpt", b.catatanUpt);
    // Sebab perubahan golongan atau masa kerja golongan beserta SK-nya (ADR-030).
    form.set("dasarBaruJenis", b.dasar.jenis);
    form.set("dasarBaruJenisKp", b.dasar.jenisKp);
    form.set("dasarBaruNomorSk", b.dasar.nomorSk);
    form.set("dasarBaruTanggalSk", b.dasar.tanggalSk);
    form.set("dasarBaruTmt", b.dasar.tmt);
    form.set("dasarBaruPenetap", b.dasar.penetap);
    // Isian hukdis sengaja tidak dikirim: laporan lama pada draf dibiarkan utuh oleh server (ADR-016).
    for (const [medan, file] of Object.entries(b.berkas)) if (file) form.set(medan, file);
    return form;
  }

  async function simpanSemua(lanjut = false) {
    if (!baris) return;
    // Draf yang tidak diubah sudah tersimpan; yang disimpan hanya baris yang berubah atau diberi berkas.
    const sasaran = baris.filter((b) => b.keadaan !== "tersimpan" && berubah(b));
    if (sasaran.length === 0) {
      if (lanjut) setLangkah(3);
      else setGalat("Belum ada yang diubah atau dilampiri berkas.");
      return;
    }
    setMenyimpan(true);
    setGalat(null);
    const idTersimpan: string[] = [];
    let gagal = 0;
    // Berurutan, bukan serentak: tiap baris membawa berkas, dan antrean kecil lebih ramah bagi koneksi UPT.
    for (const b of sasaran) {
      ubahBaris(b.kunci, (x) => ({ ...x, keadaan: "menyimpan", pesan: null }));
      try {
        const res = b.drafId
          ? await fetch(`/api/upt/usulan/${b.drafId}`, { method: "PATCH", body: formBaris(b) })
          : await fetch("/api/upt/usulan", { method: "POST", body: formBaris(b) });
        const d = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
        if (!res.ok) {
          gagal++;
          ubahBaris(b.kunci, (x) => ({ ...x, keadaan: "galat", pesan: d.error ?? "Gagal disimpan" }));
          continue;
        }
        const id = b.drafId ?? d.id ?? null;
        if (id) idTersimpan.push(id);
        ubahBaris(b.kunci, (x) => ({ ...x, drafId: id, awal: { ...x.isian }, berkas: {}, keadaan: "tersimpan", pesan: null }));
      } catch {
        gagal++;
        ubahBaris(b.kunci, (x) => ({ ...x, keadaan: "galat", pesan: "Gagal disimpan" }));
      }
    }
    setMenyimpan(false);
    // Kelengkapan tiap draf dihitung server; yang sudah lengkap langsung dicentang untuk diajukan.
    const ru = await fetch("/api/upt/usulan");
    const du = (await ru.json().catch(() => [])) as DrafUpt[];
    if (Array.isArray(du)) {
      setDraf(du);
      // Berkas yang baru diunggah atau disalin dari bawaan kini milik draf; kolomnya menampilkan yang tersimpan.
      const perId = new Map(du.map((d) => [d.id, d]));
      setBaris((lama) => lama?.map((x) => (x.drafId && perId.has(x.drafId) ? { ...x, tersimpan: perId.get(x.drafId)!.berkas } : x)) ?? null);
      const idSesi = new Set([...idTersimpan, ...baris.map((b) => b.drafId).filter((id): id is string => !!id)]);
      setPilihAjukan(new Set(du.filter((d) => idSesi.has(d.id) && d.kekurangan.length === 0).map((d) => d.id)));
    }
    if (gagal > 0) setGalat(`${gagal} pegawai gagal disimpan. Lihat tanda merah pada daftar.`);
    else if (lanjut) setLangkah(3);
  }

  const drafSesiIni = baris ? draf.filter((d) => baris.some((b) => b.drafId === d.id) && (d.status === "draf" || d.status === "revisi")) : [];
  const siapAjukan = drafSesiIni.filter((d) => d.kekurangan.length === 0);

  async function ajukan() {
    if (pilihAjukan.size === 0) return;
    if (!surat.nomorSurat.trim() || !surat.tanggalSurat) {
      setGalat("Isi nomor dan tanggal surat usulan Srikandi.");
      return;
    }
    setMengajukan(true);
    setGalat(null);
    try {
      const form = new FormData();
      for (const id of pilihAjukan) form.append("id", id);
      form.set("nomorSurat", surat.nomorSurat.trim());
      form.set("tanggalSurat", surat.tanggalSurat);
      if (berkasSurat) form.set("berkas", berkasSurat);
      const res = await fetch("/api/upt/usulan/ajukan", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string; jumlah?: number };
      if (!res.ok) {
        setGalat(d.error ?? "Usulan gagal dikirim");
        return;
      }
      setSelesai(`${d.jumlah ?? pilihAjukan.size} pegawai diusulkan ke Kanwil dengan surat ${surat.nomorSurat.trim()}.`);
      setBaris(null);
      setAktif(null);
      setTerpilih(new Set());
      setPilihAjukan(new Set());
      setSurat({ nomorSurat: "", tanggalSurat: "" });
      setBerkasSurat(null);
      setLangkah(1);
      void muat();
    } catch {
      setGalat("Usulan gagal dikirim");
    } finally {
      setMengajukan(false);
    }
  }

  const jumlahBerubah = baris?.filter((b) => b.keadaan !== "tersimpan" && berubah(b)).length ?? 0;
  const jumlahLengkap = baris?.filter((b) => kelengkapan(b).kurang.length === 0).length ?? 0;
  const jumlahDipilih = terpilih.size + drafBaru.length;
  const barisAktif = baris?.find((b) => b.kunci === aktif) ?? baris?.[0] ?? null;
  const indeksAktif = barisAktif && baris ? baris.indexOf(barisAktif) : -1;

  const LANGKAH: { n: Langkah; judul: string; ket: string; bisa: boolean }[] = [
    { n: 1, judul: "Pilih pegawai", ket: `${jumlahDipilih} dipilih`, bisa: true },
    { n: 2, judul: "Lengkapi data & berkas", ket: baris ? `${jumlahLengkap}/${baris.length} lengkap` : "belum disusun", bisa: !!baris },
    { n: 3, judul: "Ajukan dengan surat", ket: drafSesiIni.length ? `${siapAjukan.length} siap diajukan` : "simpan draf dulu", bisa: drafSesiIni.length > 0 },
  ];

  return (
    <div className="dsb-halaman kol">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Data Pegawai</p>
          <h1 className="dsb-halaman-judul">Usulan kolektif</h1>
          <p className="dsb-sub">
            Siapkan banyak pegawai untuk satu surat Srikandi: pilih pegawainya, lengkapi data dan berkas satu per satu,
            lalu ajukan semuanya dengan satu surat ke Kanwil.
          </p>
        </div>
        <Link href="/dashboard/upt/pegawai" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">← Data Pegawai</Link>
      </header>

      <ol className="kol-langkah dsb-muncul" aria-label="Langkah usulan kolektif">
        {LANGKAH.map((l) => (
          <li key={l.n}>
            <button
              type="button"
              aria-current={langkah === l.n ? "step" : undefined}
              data-lewat={langkah > l.n ? "" : undefined}
              disabled={!l.bisa}
              onClick={() => (l.n === 2 && langkah === 1 ? lanjutLengkapi() : setLangkah(l.n))}
            >
              <span className="kol-langkah-nomor" aria-hidden="true">{langkah > l.n ? "✓" : l.n}</span>
              <span className="kol-langkah-teks">
                <strong>{l.judul}</strong>
                <span>{l.ket}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {selesai && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>
            {selesai} Pantau hasilnya di{" "}
            <Link href="/dashboard/upt/riwayat/aktivitas">Riwayat usulan dan laporan</Link>.
          </p>
        </div>
      )}
      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setGalat(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* ── Langkah 1: pilih pegawai ─────────────────────────────── */}
      {langkah === 1 && (
        <section className="dsb-panel kol-panel" aria-label="Pilih pegawai">
          <div className="kol-alat">
            <div className="dsb-segmen" role="group" aria-label="Saring pegawai">
              <button type="button" aria-pressed={saring === "periode"} onClick={() => setSaring("periode")}>
                Jatuh tempo TMT {namaBulan(bulanUsulan)} <small>{jatuhTempo.length}</small>
              </button>
              <button type="button" aria-pressed={saring === "draf"} onClick={() => setSaring("draf")}>
                Ada draf <small>{adaDraf.length}</small>
              </button>
              <button type="button" aria-pressed={saring === "semua"} onClick={() => setSaring("semua")}>
                Semua <small>{pegawai.length}</small>
              </button>
            </div>
            <input type="search" className="dsb-cari" placeholder="Cari nama atau NIP" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pegawai" />
          </div>

          {drafBaru.length > 0 && (
            <p className="kol-info">
              {drafBaru.length} pegawai baru dari Unggah daftar ikut otomatis: {drafBaru.map((d) => d.nama).join(", ")}.
            </p>
          )}

          {memuat ? (
            <p className="dsb-kosong">Memuat pegawai…</p>
          ) : kelompokPilih.length === 0 ? (
            <p className="dsb-kosong">
              {saring === "periode"
                ? `Tidak ada pegawai dengan KGB TMT ${namaBulan(bulanUsulan)}. Pilih "Semua" untuk mengusulkan perbaikan data pegawai lain.`
                : "Tidak ada pegawai yang cocok."}
            </p>
          ) : (
            <div className="kol-kelompok-daftar">
              {kelompokPilih.map(([bulan, daftar]) => {
                const bisa = daftar.filter(dapatDipilih);
                const semuaDipilih = bisa.length > 0 && bisa.every((p) => terpilih.has(p.id));
                return (
                  <section key={bulan} className="kol-kelompok" aria-label={bulan === "tanpa" ? "Tanpa jadwal KGB" : `TMT ${namaBulan(bulan)}`}>
                    <div className="kol-kelompok-kepala">
                      <p>
                        {bulan === "tanpa" ? "Tanpa jadwal KGB" : `TMT ${namaBulan(bulan)}`}
                        {bulan === bulanUsulan && <span className="dsb-tag" data-nada="kuning">periode ini</span>}
                        <small>{daftar.length} pegawai</small>
                      </p>
                      {bisa.length > 0 && (
                        <button type="button" className="pgw-tautan" onClick={() => pilihKelompok(daftar, !semuaDipilih)}>
                          {semuaDipilih ? "Batalkan semua" : "Pilih semua"}
                        </button>
                      )}
                    </div>
                    <ul className="kol-kartu-daftar">
                      {daftar.map((p) => {
                        const dipilih = terpilih.has(p.id);
                        const d = drafPerPegawai.get(p.id);
                        return (
                          <li key={p.id}>
                            <label className="kol-kartu" data-pilih={dipilih ? "" : undefined} data-mati={dapatDipilih(p) ? undefined : ""}>
                              <input type="checkbox" className="sr-only" checked={dipilih} disabled={!dapatDipilih(p)} onChange={() => alih(p.id)} />
                              <span className="kol-kartu-centang" aria-hidden="true">{dipilih ? "✓" : ""}</span>
                              <span className="min-w-0">
                                <strong>{p.nama}</strong>
                                <span className="kol-kartu-sub">{p.nip}</span>
                                <span className="kol-kartu-tanda">
                                  <span className="dsb-tag" data-garis="">{p.golonganRuang}</span>
                                  {!dapatDipilih(p) ? (
                                    <span className="dsb-tag" data-garis="" data-nada="biru">ditinjau Kanwil</span>
                                  ) : d?.status === "revisi" ? (
                                    <span className="dsb-tag" data-garis="" data-nada="merah">dikembalikan</span>
                                  ) : d ? (
                                    <span className="dsb-tag" data-garis="" data-nada="kuning">ada draf</span>
                                  ) : null}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          <div className="kol-kaki">
            <span>
              <strong>{jumlahDipilih}</strong> pegawai dipilih{drafBaru.length > 0 ? ` (termasuk ${drafBaru.length} pegawai baru)` : ""}.
              {terpilih.size > 0 && (
                <button type="button" className="pgw-tautan" onClick={() => setTerpilih(new Set())} style={{ marginLeft: 8 }}>
                  Kosongkan
                </button>
              )}
            </span>
            <button type="button" className="dsb-tombol" onClick={lanjutLengkapi} disabled={jumlahDipilih === 0}>
              Lanjut: lengkapi {jumlahDipilih > 0 ? jumlahDipilih : ""} →
            </button>
          </div>
        </section>
      )}

      {/* ── Langkah 2: lengkapi per pegawai (daftar dan detail) ──── */}
      {langkah === 2 && baris && (
        <section className="dsb-panel kol-panel" aria-label="Lengkapi data dan berkas">
          <div className="kol-md">
            <ul className="kol-md-daftar" aria-label="Pegawai yang diusulkan">
              {baris.map((b) => {
                const k = kelengkapan(b);
                return (
                  <li key={b.kunci}>
                    <button type="button" aria-current={barisAktif?.kunci === b.kunci ? "true" : undefined} data-keadaan={b.keadaan} onClick={() => setAktif(b.kunci)}>
                      <Lingkar selesai={k.selesai} total={k.total} />
                      <span className="min-w-0">
                        <strong>{b.nama}</strong>
                        <span>
                          {b.keadaan === "menyimpan"
                            ? "Menyimpan…"
                            : b.keadaan === "galat"
                              ? b.pesan ?? "Gagal disimpan"
                              : b.keadaan === "tersimpan"
                                ? "Tersimpan"
                                : berubah(b)
                                  ? "Berubah, belum disimpan"
                                  : k.kurang.length === 0
                                    ? "Lengkap"
                                    : `Kurang ${k.kurang.length}`}
                        </span>
                      </span>
                      {b.jenis === "baru" && <span className="dsb-tag" data-garis="" data-nada="hijau">baru</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            {barisAktif && (
              <DetailBaris
                key={barisAktif.kunci}
                b={barisAktif}
                ke={indeksAktif + 1}
                dari={baris.length}
                onKeadaan={(pernah) =>
                  ubahBaris(barisAktif.kunci, (x) => ({ ...x, pernah, isian: pernah ? x.isian : { ...x.isian, mkgTahun: "0", mkgBulan: "0" } }))
                }
                onIsi={(kolom, nilai) => isi(barisAktif.kunci, kolom, nilai)}
                onCatatan={(teks) => ubahBaris(barisAktif.kunci, (x) => ({ ...x, catatanUpt: teks }))}
                onDasar={(kolom, nilai) => ubahBaris(barisAktif.kunci, (x) => ({ ...x, dasar: { ...x.dasar, [kolom]: nilai } }))}
                onBerkas={(medan, f) => pilihBerkas(barisAktif.kunci, medan, f)}
                onSebelum={indeksAktif > 0 ? () => setAktif(baris[indeksAktif - 1].kunci) : undefined}
                onBerikut={indeksAktif < baris.length - 1 ? () => setAktif(baris[indeksAktif + 1].kunci) : undefined}
              />
            )}
          </div>

          <div className="kol-kaki">
            <span>
              <strong>{jumlahLengkap}</strong> dari {baris.length} lengkap · <strong>{jumlahBerubah}</strong> belum disimpan. Berkas PDF
              paling besar 500 KB.
            </span>
            <span className="kol-kaki-tombol">
              <button type="button" className="dsb-tombol kol-kaki-kembali" data-jenis="garis" onClick={() => setLangkah(1)} disabled={menyimpan}>
                ← Pilih pegawai
              </button>
              <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => void simpanSemua()} disabled={menyimpan || jumlahBerubah === 0}>
                {menyimpan ? "Menyimpan…" : `Simpan ${jumlahBerubah} draf`}
              </button>
              <button
                type="button"
                className="dsb-tombol"
                onClick={() => void simpanSemua(true)}
                disabled={menyimpan || (jumlahBerubah === 0 && drafSesiIni.length === 0)}
              >
                {jumlahBerubah > 0 ? "Simpan & lanjut ajukan →" : "Lanjut: ajukan →"}
              </button>
            </span>
          </div>
        </section>
      )}

      {/* ── Langkah 3: ajukan dengan satu surat ──────────────────── */}
      {langkah === 3 && baris && (
        <section className="dsb-panel kol-panel" aria-label="Ajukan dengan satu surat">
          <div className="kol-ajukan">
            <div className="kol-ajukan-daftar">
              <div className="kol-kelompok-kepala">
                <p>
                  Pegawai pada surat ini <small>{pilihAjukan.size} dipilih dari {drafSesiIni.length}</small>
                </p>
                {siapAjukan.length > 0 && (
                  <button
                    type="button"
                    className="pgw-tautan"
                    onClick={() => setPilihAjukan(pilihAjukan.size === siapAjukan.length ? new Set() : new Set(siapAjukan.map((d) => d.id)))}
                  >
                    {pilihAjukan.size === siapAjukan.length ? "Batalkan semua" : "Pilih semua yang siap"}
                  </button>
                )}
              </div>
              <ul className="kol-kartu-daftar kol-kartu-daftar-satu">
                {drafSesiIni.map((d) => {
                  const siap = d.kekurangan.length === 0;
                  const dipilih = pilihAjukan.has(d.id);
                  return (
                    <li key={d.id}>
                      <label className="kol-kartu" data-pilih={dipilih ? "" : undefined} data-mati={siap ? undefined : ""}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={dipilih}
                          disabled={!siap}
                          onChange={() => setPilihAjukan((lama) => { const n = new Set(lama); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                        />
                        <span className="kol-kartu-centang" aria-hidden="true">{dipilih ? "✓" : ""}</span>
                        <span className="min-w-0">
                          <strong>{d.nama}</strong>
                          <span className="kol-kartu-sub" style={{ color: siap ? "var(--st-green)" : "var(--st-red)" }}>
                            {siap ? "Siap diajukan" : `Belum lengkap: ${d.kekurangan.join(", ")}`}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="kol-info">Yang belum lengkap tetap tersimpan sebagai draf dan dapat diajukan belakangan.</p>
            </div>

            <div className="kol-ajukan-surat">
              <p className="kol-subjudul">Surat usulan Srikandi</p>
              <label className="kol-label">
                <span className="kol-wajib">Nomor surat</span>
                <input className="kol-isi" value={surat.nomorSurat} onChange={(e) => setSurat((s) => ({ ...s, nomorSurat: e.target.value }))} placeholder="W.19.PAS.7-KP.04.03-1" />
              </label>
              <label className="kol-label">
                <span className="kol-wajib">Tanggal surat</span>
                <input className="kol-isi" type="date" value={surat.tanggalSurat} onChange={(e) => setSurat((s) => ({ ...s, tanggalSurat: e.target.value }))} />
              </label>
              <KotakBerkas
                label="Berkas surat (PDF, paling besar 500 KB)"
                berkas={berkasSurat}
                keterangan="Surat yang sudah dikirim lewat Srikandi; berlaku untuk semua pegawai di surat ini."
                onPilih={(f) => {
                  if (f && f.size > BATAS_BERKAS_USULAN_BYTE) {
                    setGalat(PESAN_BERKAS_TERLALU_BESAR);
                    return;
                  }
                  setBerkasSurat(f);
                }}
              />
              <div className="kol-ringkas">
                <strong>{pilihAjukan.size}</strong> pegawai akan diusulkan ke Kanwil
                {surat.nomorSurat.trim() ? <> dengan surat <strong>{surat.nomorSurat.trim()}</strong></> : ""}.
                Selama ditinjau, datanya terkunci dan proses KGB-nya menunggu persetujuan Kanwil.
              </div>
            </div>
          </div>

          <div className="kol-kaki">
            <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => setLangkah(2)} disabled={mengajukan}>
              ← Lengkapi
            </button>
            <button type="button" className="dsb-tombol" onClick={() => void ajukan()} disabled={mengajukan || pilihAjukan.size === 0}>
              {mengajukan ? "Mengirim…" : `Ajukan ${pilihAjukan.size} pegawai ke Kanwil`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Kotak unggah satu berkas: tarik-lepas atau pilih; menampilkan berkas terpilih, tersimpan, atau bawaan. */
function KotakBerkas({
  label,
  wajib = false,
  keterangan,
  berkas,
  tersimpan,
  onPilih,
}: {
  label: string;
  wajib?: boolean;
  keterangan?: string;
  berkas: File | null | undefined;
  /** Berkas yang sudah tersimpan pada draf atau terbawa dari usulan yang disetujui. */
  tersimpan?: { nama: string; bawaan: boolean } | null;
  onPilih: (f: File | null) => void;
}) {
  const [seret, setSeret] = useState(false);
  const [kunci, setKunci] = useState(0);
  const keadaan = berkas ? "dipilih" : tersimpan ? (tersimpan.bawaan ? "bawaan" : "tersimpan") : "kosong";
  return (
    <div className="kol-berkas-kotak" data-keadaan={keadaan} data-seret={seret ? "" : undefined}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setSeret(true);
        }}
        onDragLeave={() => setSeret(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSeret(false);
          onPilih(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input key={kunci} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => onPilih(e.target.files?.[0] ?? null)} />
        <span className="kol-berkas-ikon" aria-hidden="true">{keadaan === "kosong" ? "+" : "PDF"}</span>
        <span className="min-w-0">
          <strong className={wajib ? "kol-wajib" : undefined}>{label}</strong>
          <span>
            {berkas
              ? `${berkas.name} · ${ukuranBerkas(berkas.size)} · belum disimpan`
              : tersimpan
                ? `${tersimpan.nama}${tersimpan.bawaan ? " · dari usulan yang disetujui Kanwil" : " · tersimpan"}`
                : keterangan ?? "Tarik PDF ke sini atau klik untuk memilih"}
          </span>
        </span>
        <span className="kol-berkas-aksi">{keadaan === "kosong" ? "Pilih" : "Ganti"}</span>
      </label>
      {berkas && (
        <button
          type="button"
          className="kol-berkas-hapus"
          aria-label={`Batalkan ${label}`}
          onClick={() => {
            onPilih(null);
            setKunci((k) => k + 1);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Detail satu pegawai di langkah 2: keadaan KGB, isian yang menentukan gaji, berkas, dan catatan. */
function DetailBaris({
  b,
  ke,
  dari,
  onKeadaan,
  onIsi,
  onCatatan,
  onDasar,
  onBerkas,
  onSebelum,
  onBerikut,
}: {
  b: Baris;
  ke: number;
  dari: number;
  onKeadaan: (pernah: boolean) => void;
  onIsi: (kolom: string, nilai: string) => void;
  onCatatan: (teks: string) => void;
  onDasar: (kolom: keyof Baris["dasar"], nilai: string) => void;
  onBerkas: (medan: string, f: File | null) => void;
  onSebelum?: () => void;
  onBerikut?: () => void;
}) {
  const k = kelengkapan(b);
  const perluSebab =
    b.jenis !== "baru" &&
    perluDasarBaru(
      (["golonganRuang", "mkgTahun", "mkgBulan"] as const)
        .filter((kolom) => (b.isian[kolom] ?? "") !== (b.awal[kolom] ?? ""))
        .map((kunci) => ({ kunci })),
    );
  const hitung = hitungUsulan({
    golonganRuang: b.isian.golonganRuang,
    mkgTahun: b.isian.mkgTahun ?? "0",
    mkgBulan: b.isian.mkgBulan ?? "0",
    tmtKgbTerakhir: b.isian.tmtKgbTerakhir || null,
  });
  const beda = (kolom: string) => ((b.isian[kolom] ?? "") !== (b.awal[kolom] ?? "") ? "" : undefined);

  return (
    <div className="kol-md-detail">
      <div className="kol-md-kepala">
        <div className="min-w-0">
          <p className="kol-md-urut">Pegawai {ke} dari {dari}</p>
          <h2>{b.nama}</h2>
          <p className="kol-kartu-sub">
            {b.nip}
            {b.jenis === "baru" ? " · pegawai baru" : ""}
          </p>
        </div>
        <span className="kol-md-nav">
          <button type="button" className="dsb-ikon-tombol" aria-label="Pegawai sebelumnya" disabled={!onSebelum} onClick={onSebelum}>‹</button>
          <button type="button" className="dsb-ikon-tombol" aria-label="Pegawai berikutnya" disabled={!onBerikut} onClick={onBerikut}>›</button>
        </span>
      </div>

      {b.keadaan === "galat" && b.pesan && <p className="pmh-galat">{b.pesan}</p>}
      {k.kurang.length > 0 ? (
        <p className="kol-kurang">
          <span aria-hidden="true">!</span> Belum lengkap: {k.kurang.join(", ")}.
        </p>
      ) : (
        <p className="kol-kurang" data-lengkap="">
          <span aria-hidden="true">✓</span> Data dan berkas wajib sudah lengkap.
        </p>
      )}

      <div className="kol-bagian">
        <p className="kol-subjudul">Keadaan KGB</p>
        <div className="kol-pilihan" role="radiogroup" aria-label="Keadaan KGB">
          <button type="button" role="radio" aria-checked={b.pernah} onClick={() => onKeadaan(true)}>Sudah pernah KGB</button>
          <button type="button" role="radio" aria-checked={!b.pernah} onClick={() => onKeadaan(false)}>Belum pernah KGB</button>
        </div>
      </div>

      <div className="kol-bagian">
        <p className="kol-subjudul">Dasar gaji <span>isian yang berubah ditandai kuning</span></p>
        <div className="kol-isian-kisi">
          <label className="kol-label">
            <span className="kol-wajib">Golongan ruang</span>
            <select className="kol-isi" data-beda={beda("golonganRuang")} value={b.isian.golonganRuang ?? ""} onChange={(e) => onIsi("golonganRuang", e.target.value)}>
              <option value="">Pilih golongan</option>
              {Object.entries(GOLONGAN_PANGKAT).map(([g, p]) => (
                <option key={g} value={g}>{g} · {p}</option>
              ))}
            </select>
          </label>
          <div className="kol-label">
            <span className={b.pernah ? "kol-wajib" : undefined}>Masa kerja golongan</span>
            <span className="kol-mkg">
              <input className="kol-isi" data-beda={beda("mkgTahun")} inputMode="numeric" value={b.isian.mkgTahun ?? ""} disabled={!b.pernah} onChange={(e) => onIsi("mkgTahun", e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Tahun" />
              <span>tahun</span>
              <input className="kol-isi" data-beda={beda("mkgBulan")} inputMode="numeric" value={b.isian.mkgBulan ?? ""} disabled={!b.pernah} onChange={(e) => onIsi("mkgBulan", e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Bulan" />
              <span>bulan</span>
            </span>
          </div>
          <label className="kol-label">
            <span className="kol-wajib">{b.pernah ? "TMT KGB terakhir" : "TMT CPNS"}</span>
            <input className="kol-isi" type="date" data-beda={beda("tmtKgbTerakhir")} value={b.isian.tmtKgbTerakhir ?? ""} onChange={(e) => onIsi("tmtKgbTerakhir", e.target.value)} />
          </label>
          <label className="kol-label">
            <span className="kol-wajib">{b.pernah ? "Nomor SK KGB terakhir" : "Nomor SK CPNS"}</span>
            <input className="kol-isi" data-beda={beda("nomorSkTerakhir")} value={b.isian.nomorSkTerakhir ?? ""} onChange={(e) => onIsi("nomorSkTerakhir", e.target.value)} placeholder="Sesuai SK" />
          </label>
          <label className="kol-label">
            <span className="kol-wajib">{b.pernah ? "Tanggal SK KGB terakhir" : "Tanggal SK CPNS"}</span>
            <input className="kol-isi" type="date" data-beda={beda("tanggalSkTerakhir")} value={b.isian.tanggalSkTerakhir ?? ""} onChange={(e) => onIsi("tanggalSkTerakhir", e.target.value)} />
          </label>
        </div>
        <div className="kol-hitung">
          <div>
            <span>Gaji pokok</span>
            <strong>{hitung.gajiPokok > 0 ? rupiah(hitung.gajiPokok) : "–"}</strong>
          </div>
          <div>
            <span>KGB berikutnya</span>
            <strong>{hitung.tmtKgbBerikutnya ? formatTanggalId(hitung.tmtKgbBerikutnya) : "–"}</strong>
          </div>
          {hitung.peringatan.length > 0 && <p>{hitung.peringatan[0]}</p>}
        </div>
      </div>

      {/* Sebab perubahan golongan atau masa kerja golongan; Kanwil memakainya membentuk riwayat (ADR-030). */}
      {(perluSebab || !!b.dasar.jenis) && (
        <div className="kol-bagian">
          <p className="kol-subjudul">
            Sebab golongan atau masa kerja berubah <span>SK inilah yang menjadi dasar SK KGB berikutnya</span>
          </p>
          <div className="kol-sebab">
            {(["kp", "pmk", "koreksi"] as JenisDasarBaru[]).map((j) => (
              <label key={j} className="kol-sebab-pilihan" data-pilih={b.dasar.jenis === j ? "" : undefined}>
                <input type="radio" name={`sebab-${b.kunci}`} className="sr-only" checked={b.dasar.jenis === j} onChange={() => onDasar("jenis", j)} />
                <span className="kol-sebab-titik" aria-hidden="true" />
                <span className="min-w-0">
                  <strong>{LABEL_DASAR_BARU[j]}</strong>
                  <span>{KETERANGAN_DASAR_BARU[j]}</span>
                </span>
              </label>
            ))}
          </div>
          {(b.dasar.jenis === "kp" || b.dasar.jenis === "pmk") && (
            <div className="kol-isian-kisi">
              {b.dasar.jenis === "kp" && (
                <label className="kol-label">
                  <span className="kol-wajib">Jenis kenaikan pangkat</span>
                  <select className="kol-isi" value={b.dasar.jenisKp} onChange={(e) => onDasar("jenisKp", e.target.value)}>
                    {Object.entries(JENIS_KP).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="kol-label">
                <span className="kol-wajib">Nomor {b.dasar.jenis === "kp" ? "SK kenaikan pangkat" : "SK PMK"}</span>
                <input className="kol-isi" value={b.dasar.nomorSk} onChange={(e) => onDasar("nomorSk", e.target.value)} placeholder="Sesuai SK" />
              </label>
              <label className="kol-label">
                <span className="kol-wajib">Tanggal SK</span>
                <input className="kol-isi" type="date" value={b.dasar.tanggalSk} onChange={(e) => onDasar("tanggalSk", e.target.value)} />
              </label>
              <label className="kol-label">
                <span className="kol-wajib">{b.dasar.jenis === "kp" ? "TMT pangkat" : "TMT PMK"}</span>
                <input className="kol-isi" type="date" value={b.dasar.tmt} onChange={(e) => onDasar("tmt", e.target.value)} />
              </label>
              <label className="kol-label">
                <span>Ditetapkan oleh</span>
                <input className="kol-isi" value={b.dasar.penetap} onChange={(e) => onDasar("penetap", e.target.value)} placeholder="Pejabat penanda tangan SK" />
              </label>
            </div>
          )}
          {b.dasar.jenis === "kp" && (
            <p className="kol-catatan-kecil">
              Golongan di atas diisi golongan baru menurut SK. Masa kerja golongan dihitung ulang Kanwil dari SK itu:
              naik dari golongan II ke III memotong masa kerja 5 tahun.
            </p>
          )}
          {b.dasar.jenis === "pmk" && (
            <p className="kol-catatan-kecil">
              Masa kerja golongan di atas diisi sesuai yang tertulis pada SK PMK. Jadwal KGB berikutnya dapat maju,
              dan Kanwil menghitungnya ulang saat menyetujui.
            </p>
          )}
        </div>
      )}

      <div className="kol-bagian">
        <p className="kol-subjudul">Berkas pendukung</p>
        <div className="kol-berkas-daftar">
          {berkasUntukKeadaan(b.pernah).map((jenis) => {
            const ada = b.tersimpan.find((t) => t.medan === jenis.medan) ?? b.bawaan.find((t) => t.medan === jenis.medan);
            return (
              <KotakBerkas
                key={jenis.medan}
                label={jenis.label}
                wajib={jenis.wajib}
                keterangan={jenis.keterangan}
                berkas={b.berkas[jenis.medan]}
                tersimpan={ada ? { nama: ada.nama ?? jenis.label, bawaan: !!ada.usulanId } : null}
                onPilih={(f) => onBerkas(jenis.medan, f)}
              />
            );
          })}
        </div>
      </div>

      <div className="kol-bagian">
        <label className="kol-label">
          <span>
            Catatan untuk Kanwil <span className="kol-opsional">(opsional)</span>
          </span>
          <textarea className="kol-isi" rows={2} value={b.catatanUpt} onChange={(e) => onCatatan(e.target.value)} placeholder="mis. SK kenaikan pangkat terbaru masih diproses BKN" />
        </label>
      </div>
    </div>
  );
}
