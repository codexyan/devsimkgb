"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import KolomBerkas from "./KolomBerkas";
import { BERKAS_USULAN, berkasDasarBaru, berkasUntukKeadaan, pernahKgb as sudahPernahKgb } from "@/lib/usulanPegawai";
import { BIDANG_DIISI } from "@/lib/usulanFormulir";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR, denganNilaiSaatIni } from "@/lib/pilihanPegawai";
import { formatTanggalId } from "@/lib/waktu";
import { kunciNomorSk } from "@/lib/nomorSurat";
import { KETERANGAN_DASAR_BARU, LABEL_DASAR_BARU, jawabanSkBaru, perluDasarBaru, type JenisDasarBaru } from "@/lib/dasarBaruUsulan";
import { JENIS_KP } from "@/lib/kenaikanPangkat";
import { pratinjauAtasDasarUsulan } from "@/lib/linimasaDasarSk";
import type { DasarKgbBerikutnya } from "@/lib/dasarKgbBerikutnya";
import {
  asalAtasDasar,
  hitungFormulirUsulan,
  isianUntukDisimpan,
  jawabSkBaru,
  koreksiAtas,
  mkgPadaSkTercatat,
  pisahkanIsianSk,
  teksAtasDasar,
} from "./skSesudahAcuan";
import ModalPratinjauSkUsulan from "./ModalPratinjauSkUsulan";

/* Formulir data pegawai UPT: dipakai untuk menyiapkan pegawai baru maupun mengusulkan perbaikan data
   pegawai yang sudah tercatat. Isiannya selalu disimpan sebagai draf lebih dulu; pengirimannya ke
   Kanwil dilakukan terpisah, sekali untuk satu surat usulan yang biasanya memuat beberapa pegawai.

   Gaji pokok, pangkat, dan TMT KGB berikutnya tidak diketik operator melainkan dihitung dari golongan,
   masa kerja golongan, dan TMT KGB terakhir. Ketiganya menentukan uang, dan salah ketik di situ berbuah
   kekurangan rapelan atau kelebihan yang harus dikembalikan ke kas negara.

   SK KGB terakhir (atau SK CPNS) menjadi acuan jadwal; SK kenaikan pangkat, penyesuaian ijazah, atau PMK
   sesudahnya dilaporkan lewat pertanyaan wajib, dan yang paling baru menjadi Atas dasar SK KGB berikutnya
   (ADR-065). Bagian atas memuat keadaan pada SK KGB terakhir; golongan dan masa kerja menurut SK sesudahnya
   diisi di bagian SK itu, dan sistem menghitung keadaan sesudahnya dengan cara persetujuan Kanwil (ADR-078).
   Data pegawai di SIM-KGB baru berubah setelah usulannya disetujui Kanwil. */

export interface DrafUsulanUpt {
  id: string;
  jenis: string;
  nama: string;
  nip: string;
  /** "draf" untuk yang belum pernah dikirim, "revisi" untuk yang dikembalikan Kanwil. */
  status?: string;
  /** Catatan peninjau Kanwil pada usulan yang dikembalikan; kolomnya dipakai bersama alasan penolakan lama. */
  alasanTolak?: string | null;
  nilai: Record<string, string> | null;
  surat: { nomorSurat: string; tanggalSurat: string; nomorSkTerakhir: string; tanggalSkTerakhir: string; catatanUpt: string } | null;
  hukdis: { ada: boolean; jenis: string; nomorSk: string; tmtMulai: string; tmtBerakhir: string; keterangan: string } | null;
  dasarBaru?: { jenis: string; jenisKp: string; nomorSk: string; tanggalSk: string; tmt: string; penetap: string } | null;
  /** Golongan dan masa kerja pada SK KGB terakhir, bila disimpan bersama SK sesudahnya (ADR-078); null pada draf lama. */
  acuan?: { golongan: string; mkgTahun: string; mkgBulan: string } | null;
  berkas: { medan: string; label: string; nama?: string | null }[];
}

/** SK dasar dan berkas yang sudah disetujui Kanwil untuk pegawai ini (lib/bawaanUsulan.ts). */
export interface BawaanUsulanUpt {
  nomorSkTerakhir: string;
  tanggalSkTerakhir: string;
  berkas: { medan: string; label: string; nama?: string | null; usulanId: string }[];
}

export interface PegawaiUntukUsulan {
  id: string;
  nama: string;
  nip: string;
  dataSekarang: Record<string, string>;
  bawaan?: BawaanUsulanUpt;
  /** Dasar SK KGB berikutnya menurut catatan SIM-KGB; pembanding pratinjau Atas dasar (ADR-065). */
  dasarKgb?: DasarKgbBerikutnya | null;
  /** KGB pegawai yang sedang berjalan di Kanwil: dasar peringatan dampak laporan SK (ADR-074). */
  kgb?: { status: string | null; tmt: string | null };
}

/**
 * Berkas milik tiap pegawai. Surat usulan Srikandi tidak termasuk: satu surat memuat banyak pegawai,
 * jadi suratnya diunggah sekali pada langkah Ajukan dan dipasang ke semua pegawai pada surat itu.
 */
const BERKAS_PEGAWAI = BERKAS_USULAN.filter((b) => b.keadaan !== "pengajuan");

const SK_KOSONG = { nomorSkTerakhir: "", tanggalSkTerakhir: "", catatanUpt: "" };

/** Isian identitas; sisanya dikelompokkan sendiri karena punya pemandu. */
const BIDANG_IDENTITAS = new Set(["nama", "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir"]);

/**
 * Isian yang nilainya terbatas, ditawarkan sebagai pilihan agar seragam dengan data Kanwil. Mengetik
 * bebas membuat "Non Eselon", "non eselon", dan "Eselon IV" hidup berdampingan pada kolom yang sama.
 */
const PILIHAN_BIDANG: Record<string, readonly string[]> = {
  jenisKelamin: JENIS_KELAMIN,
  pendidikanTerakhir: PENDIDIKAN_TERAKHIR,
  jenisJabatan: JENIS_JABATAN,
  eselon: ESELON,
};

/** Isian pilihan; nilai lama yang di luar daftar tetap ditampilkan agar tidak hilang saat disimpan. */
function IsianPilihan({
  label,
  daftar,
  nilai,
  onUbah,
}: {
  label: string;
  daftar: readonly string[];
  nilai: string;
  onUbah: (nilai: string) => void;
}) {
  return (
    <label className="kgbm-label">
      {label}
      <select className="kgbm-input" value={nilai} onChange={(e) => onUbah(e.target.value)}>
        <option value="">Belum diisi</option>
        {denganNilaiSaatIni(daftar, nilai).map((pilihan) => (
          <option key={pilihan} value={pilihan}>{pilihan}</option>
        ))}
      </select>
    </label>
  );
}

/** Isian tanggal dengan tombol pengosong: isian date yang terisi tidak dapat dikosongkan dari ponsel. */
export function IsianTanggal({
  label,
  nilai,
  onUbah,
  wajib = false,
  bantuan,
  nonaktif = false,
}: {
  label: string;
  nilai: string;
  onUbah: (nilai: string) => void;
  wajib?: boolean;
  bantuan?: string;
  nonaktif?: boolean;
}) {
  return (
    <label className="kgbm-label">
      {wajib ? <span className="kgbm-wajib">{label}</span> : label}
      <input className="kgbm-input" type="date" value={nilai} disabled={nonaktif} onChange={(e) => onUbah(e.target.value)} />
      {bantuan && <span className="kgbm-bantuan">{bantuan}</span>}
      {nilai && !nonaktif && (
        <button type="button" className="kgbm-kosongkan" onClick={() => onUbah("")}>
          Kosongkan
        </button>
      )}
    </label>
  );
}

export default function FormulirUsulan({
  jenis,
  pegawai,
  draf,
  onTutup,
  onSelesai,
}: {
  jenis: "perubahan" | "baru";
  pegawai: PegawaiUntukUsulan | null;
  draf: DrafUsulanUpt | null;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  // Data tercatat di SIM-KGB; pada pegawai yang sudah tercatat, inilah keadaan sebelum SK yang dilaporkan.
  const tercatat = jenis === "perubahan" ? (pegawai?.dataSekarang ?? null) : null;
  // Draf yang melaporkan SK sesudah SK KGB terakhir dipisahkan: keadaan pada SK acuan di bagian atas, golongan dan masa
  // kerja menurut SK itu di bagian SK (ADR-078).
  const terpisah = pisahkanIsianSk({
    nilai: draf?.nilai ?? pegawai?.dataSekarang ?? {},
    jenisSk: draf?.dasarBaru?.jenis,
    acuan: draf?.acuan,
    tercatat,
  });
  const tersimpan: Record<string, string> = terpisah.atas;
  // Pegawai yang belum pernah KGB memakai TMT CPNS sebagai awal hitungan, dan TMT golongan pertamanya
  // adalah tanggal yang sama. Isian yang masih kosong diisikan dari sana daripada dibiarkan menebak;
  // operator tetap dapat menggantinya bila SK-nya berkata lain.
  const awal: Record<string, string> = {
    ...tersimpan,
    tmtKgbTerakhir: tersimpan.tmtKgbTerakhir || tersimpan.tmtGolongan || "",
    // Draf lama belum menyimpan NIP di isiannya; yang ditampilkan NIP yang tercatat.
    nip: tersimpan.nip || pegawai?.nip || (draf?.nip && draf.nip !== "-" ? draf.nip : ""),
  };
  const [isian, setIsian] = useState<Record<string, string>>({ ...awal });
  // SK dasar yang sudah disetujui Kanwil menjadi isian awal, agar tidak diketik ulang pada tiap perbaikan.
  const bawaan = jenis === "perubahan" ? pegawai?.bawaan : undefined;
  const skDraf = draf?.surat?.nomorSkTerakhir?.trim() ? draf.surat : null;
  const [sk, setSk] = useState({
    nomorSkTerakhir: skDraf?.nomorSkTerakhir ?? bawaan?.nomorSkTerakhir ?? "",
    tanggalSkTerakhir: skDraf ? skDraf.tanggalSkTerakhir : (draf?.surat?.tanggalSkTerakhir || bawaan?.tanggalSkTerakhir || ""),
    catatanUpt: draf?.surat?.catatanUpt ?? "",
  });
  // SK sesudah SK KGB terakhir beserta isinya, atau jawaban tidak ada (ADR-030, ADR-065). Jenis kosong berarti
  // pertanyaannya belum dijawab.
  const [dasar, setDasar] = useState({
    jenis: draf?.dasarBaru?.jenis ?? "",
    jenisKp: draf?.dasarBaru?.jenisKp || "reguler",
    nomorSk: draf?.dasarBaru?.nomorSk ?? "",
    tanggalSk: draf?.dasarBaru?.tanggalSk ?? "",
    tmt: draf?.dasarBaru?.tmt ?? "",
    penetap: draf?.dasarBaru?.penetap ?? "",
    golongan: terpisah.sk.golongan,
    mkgTahun: terpisah.sk.mkgTahun,
    mkgBulan: terpisah.sk.mkgBulan,
    jenisAda: "",
  });
  const [berkas, setBerkas] = useState<Record<string, File | null>>({});
  // Berkas tersimpan yang ditandai operator untuk dihapus; dihapus server saat data disimpan.
  const [hapusTersimpan, setHapusTersimpan] = useState<Set<string>>(() => new Set());
  // Pegawai yang belum pernah KGB mengisi TMT CPNS dan masa kerja 0; yang sudah pernah menyalin SK KGB
  // terakhirnya. Pemisahan ini yang menghilangkan tebak-tebakan pada dua isian tersulit.
  const [pernahKgb, setPernahKgb] = useState(() => sudahPernahKgb(awal.mkgTahun, awal.mkgBulan));
  // Golongan dan masa kerja golongan hanya berubah karena kenaikan pangkat, PMK, atau salah ketik (ADR-030).
  const perluSebab =
    jenis !== "baru" &&
    perluDasarBaru(
      (["golonganRuang", "mkgTahun", "mkgBulan"] as const)
        .filter((kolom) => (isian[kolom] ?? "") !== (awal[kolom] ?? ""))
        .map((kunci) => ({ kunci })),
    );
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  /** Berkas tersimpan yang sedang dibuka, agar operator dapat memastikan yang diunggah memang benar. */
  const [pratinjau, setPratinjau] = useState<{ judul: string; url: string; lokal: boolean } | null>(null);
  /** Isian yang sedang dipratinjau sebagai SK KGB (ADR-078); null bila jendelanya tertutup. */
  const [pratinjauSk, setPratinjauSk] = useState<Record<string, string> | null>(null);


  const ubah = (kunci: string, nilai: string) => setIsian((f) => ({ ...f, [kunci]: nilai }));
  /** Usulan yang dilempar kembali Kanwil; isinya utuh, yang berubah hanya kalimat pemandunya. */
  const dikembalikan = draf?.status === "revisi";

  /**
   * Isian identitas yang wajib, dan hanya pada pegawai baru. Pada usulan perbaikan, isian yang
   * dikosongkan berarti "tidak diusulkan berubah", jadi menandainya wajib justru menyesatkan: yang
   * benar-benar wajib di situ hanya yang menentukan uang, yaitu golongan dan hitungan KGB-nya.
   */
  const wajibIdentitas = (kunci: string) => jenis === "baru" && (kunci === "nama" || kunci === "jabatan");
  const label = (kunci: string, teks: string) =>
    wajibIdentitas(kunci) ? <span className="kgbm-wajib">{teks}</span> : teks;

  // Bagian atas yang dibetulkan dari data tercatat (ADR-079). Selama sama, kenaikan pangkat mempertahankan jadwal KGB yang
  // tercatat; bila dibetulkan, jadwalnya dihitung dari isian itu, sama dengan persetujuan Kanwil.
  const koreksi = koreksiAtas(isian, tercatat);
  const tmtBerikutTercatat = tercatat && koreksi.every((k) => k.label === "TMT golongan") ? tercatat.tmtKgbBerikutnya ?? null : null;
  const hitungan = useMemo(
    () =>
      hitungFormulirUsulan(
        {
          golonganRuang: isian.golonganRuang ?? "",
          mkgTahun: isian.mkgTahun ?? "0",
          mkgBulan: isian.mkgBulan ?? "0",
          tmtKgbTerakhir: isian.tmtKgbTerakhir ?? "",
        },
        { jenis: dasar.jenis, tmt: dasar.tmt, golongan: dasar.golongan, mkgTahun: dasar.mkgTahun, mkgBulan: dasar.mkgBulan },
        tmtBerikutTercatat,
      ),
    [
      isian.golonganRuang, isian.mkgTahun, isian.mkgBulan, isian.tmtKgbTerakhir,
      dasar.jenis, dasar.tmt, dasar.golongan, dasar.mkgTahun, dasar.mkgBulan, tmtBerikutTercatat,
    ],
  );
  const hitung = hitungan.acuan;
  const sesudahSk = hitungan.sesudahSk;

  // SK KGB terakhir (atau SK CPNS) tetap acuan jadwal; SK sesudahnya yang dilaporkan, atau yang sudah tercatat, menjadi
  // Atas dasar SK KGB berikutnya bila TMT-nya lebih baru (ADR-020, ADR-065).
  const skAcuan = pernahKgb ? "SK KGB terakhir" : "SK CPNS";
  const jawaban = jawabanSkBaru(dasar.jenis);
  const adaSkBaru = jawaban === "ada";
  const pratinjauDasar = pratinjauAtasDasarUsulan({
    acuan: { nomorSK: sk.nomorSkTerakhir, tanggalSK: sk.tanggalSkTerakhir, tmt: isian.tmtKgbTerakhir ?? "", cpns: !pernahKgb },
    laporan: adaSkBaru ? { jenis: dasar.jenis, jenisKp: dasar.jenisKp, nomorSk: dasar.nomorSk, tmt: dasar.tmt } : null,
    tercatat: pegawai?.dasarKgb ?? null,
  });
  // Masa kerja menurut SK kenaikan pangkat atau PMK yang sudah tercatat sesudah KGB terakhir: angka yang tertulis pada SK
  // itu, berbeda dari masa kerja tercatat (pada TMT KGB terakhir) yang menjadi dasar hitungan (ADR-078).
  const mkgSkTercatat = tercatat ? mkgPadaSkTercatat(tercatat, pegawai?.dasarKgb ?? null) : null;
  // SK yang dilaporkan sama dengan SK yang sudah menjadi dasar KGB berikutnya: tidak dicatat dua kali (ADR-079).
  const skSudahTercatat =
    adaSkBaru && !!pegawai?.dasarKgb?.nomorSK && !!dasar.nomorSk.trim() && kunciNomorSk(dasar.nomorSk) === kunciNomorSk(pegawai.dasarKgb.nomorSK);

  /** Jawaban pertanyaan SK sesudah SK acuan. Isian yang sudah diketik, di bagian atas maupun bagian SK, tidak berubah. */
  function jawabSk(ada: boolean) {
    setDasar((d) => jawabSkBaru(d, ada));
  }

  /** Isian sebagaimana disimpan: isian utama, keadaan acuan, SK, dan SK acuan. Dipakai simpan dan pratinjau SK. */
  function isianKirim(): Record<string, string> {
    const { nilai, acuan } = isianUntukDisimpan(isian, dasar);
    const hasil: Record<string, string> = { jenis };
    if (pegawai) hasil.pegawaiId = pegawai.id;
    for (const bidang of BIDANG_DIISI) hasil[bidang.kunci] = nilai[bidang.kunci] ?? "";
    Object.assign(hasil, acuan);
    hasil.nomorSkTerakhir = sk.nomorSkTerakhir;
    hasil.tanggalSkTerakhir = sk.tanggalSkTerakhir;
    hasil.catatanUpt = sk.catatanUpt;
    hasil.dasarBaruJenis = dasar.jenis;
    hasil.dasarBaruJenisKp = dasar.jenisKp;
    hasil.dasarBaruNomorSk = dasar.nomorSk;
    hasil.dasarBaruTanggalSk = dasar.tanggalSk;
    hasil.dasarBaruTmt = dasar.tmt;
    hasil.dasarBaruPenetap = dasar.penetap;
    return hasil;
  }

  function tandaiHapus(medan: string, hapus: boolean) {
    setHapusTersimpan((lama) => {
      const baru = new Set(lama);
      if (hapus) baru.add(medan);
      else baru.delete(medan);
      return baru;
    });
  }

  // Berkas yang baru dipilih hanya ada di peramban sampai data disimpan; menutup formulir tanpa
  // menyimpan membuangnya, jadi ditanyakan dulu agar tidak hilang tanpa disadari.
  const adaBerkasBelumDisimpan = Object.values(berkas).some(Boolean) || hapusTersimpan.size > 0;
  function tutup() {
    if (
      adaBerkasBelumDisimpan &&
      !window.confirm("Ada berkas yang belum disimpan. Bila formulir ditutup sekarang, berkas itu tidak ikut tersimpan. Tutup tanpa menyimpan?")
    )
      return;
    onTutup();
  }

  function tutupPratinjau() {
    // Blob URL berkas yang baru dipilih dicabut agar memorinya dilepas.
    if (pratinjau?.lokal) URL.revokeObjectURL(pratinjau.url);
    setPratinjau(null);
  }

  async function simpan() {
    setMengirim(true);
    setGalat(null);
    try {
      const form = new FormData();
      form.set("status", "draf");
      for (const [kunci, nilai] of Object.entries(isianKirim())) form.set(kunci, nilai);
      for (const b of BERKAS_PEGAWAI) {
        const isi = berkas[b.medan];
        if (isi) form.set(b.medan, isi);
        // Termasuk berkas bawaan yang ditolak operator, agar server tidak menyalinnya.
        else if (hapusTersimpan.has(b.medan)) form.append("hapusBerkas", b.medan);
      }

      const res = draf
        ? await fetch(`/api/upt/usulan/${draf.id}`, { method: "PATCH", body: form })
        : await fetch("/api/upt/usulan", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Data gagal disimpan");
        return;
      }
      const nama = isian.nama || pegawai?.nama || "pegawai";
      onSelesai(
        dikembalikan
          ? `Perbaikan data ${nama} tersimpan. Kirim ulang lewat Ajukan ke Kanwil di daftar Perlu dikerjakan.`
          : draf
            ? `Draf data ${nama} diperbarui. Ajukan ke Kanwil bila sudah lengkap.`
            : `Data ${nama} tersimpan sebagai draf. Lengkapi kapan saja, lalu ajukan bersama pegawai lain dalam satu surat.`,
      );
    } catch {
      setGalat("Data gagal disimpan");
    } finally {
      setMengirim(false);
    }
  }

  const judul = dikembalikan
    ? "Perbaiki usulan yang dikembalikan"
    : jenis === "baru"
      ? (draf ? "Lanjutkan data pegawai baru" : "Tambah data pegawai")
      : (draf ? "Lanjutkan usulan perbaikan data" : "Usulkan perbaikan data pegawai");

  return (
    <KerangkaModal
      judul={judul}
      subjudul={
        pegawai
          ? `${pegawai.nama} · ${pegawai.nip}`
          : "Pegawai yang belum tercatat di SIM-KGB, misalnya CPNS yang baru dilantik"
      }
      ukuran="lg"
      sibuk={mengirim}
      onTutup={tutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutup} disabled={mengirim}>
            Batal
          </button>
          {/* Pratinjau SK KGB dari isian ini, sebelum disimpan atau diajukan (ADR-078). */}
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setPratinjauSk(isianKirim())} disabled={mengirim}>
            Pratinjau SK KGB
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={mengirim}>
            {mengirim ? "Menyimpan…" : dikembalikan ? "Simpan perbaikan" : "Simpan draf usulan"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      {dikembalikan && (
        <Catatan nada="amber">
          Kanwil mengembalikan usulan ini untuk diperbaiki: {draf?.alasanTolak ?? "tanpa catatan"}. Betulkan yang
          disebut lalu simpan; usulannya belum kembali ke Kanwil sampai dikirim ulang lewat Ajukan ke Kanwil di daftar Perlu dikerjakan.
        </Catatan>
      )}
      <Catatan>
        {jenis === "baru"
          ? "Data disimpan dulu sebagai draf usulan milik satker: belum dikirim ke Kanwil dan belum tercatat di SIM-KGB. Setelah semua pegawai yang akan diusulkan lengkap, ajukan sekaligus dengan satu surat usulan; pegawai ini tercatat di SIM-KGB setelah Kanwil menyetujuinya. Selama itu ia tampil di Pegawai Satker sebagai baris bertanda."
          : "Isian sudah diisi dengan data yang tercatat di Kanwil. Ubah yang perlu diperbaiki saja; yang dikosongkan berarti tidak diusulkan berubah. Yang disimpan di sini draf usulan: data pegawai di SIM-KGB baru berubah setelah usulannya diajukan dan disetujui Kanwil."}
      </Catatan>
      <p className="kgbm-legenda">
        Isian dan berkas bertanda <i>*</i> wajib. Daftarnya berubah menurut keadaan pegawai:{" "}
        <b>{pernahKgb ? "sudah pernah KGB" : "belum pernah KGB"}</b>
        {pernahKgb
          ? " menuntut TMT KGB terakhir, masa kerja golongan yang disalin dari SK KGB itu, serta lampiran SK KGB terakhir dan SK kenaikan pangkat terakhir."
          : " menuntut TMT CPNS, masa kerja golongan 0 tahun 0 bulan, serta nomor, tanggal, dan lampiran SK CPNS sebagai acuan pertama; SK pengangkatan PNS dilampirkan bila sudah terbit."}{" "}
        Pilihannya diatur pada bagian Pangkat, gaji pokok, dan KGB di bawah.
      </p>

      {/* ── Identitas ─────────────────────────────────────────────────── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Identitas</p>
          <p className="kgbm-bagian-ket">Sesuai SK pengangkatan</p>
        </div>
        <div className="kgbm-bagian-isi">
          <label className="kgbm-label">
            {jenis === "baru" ? <span className="kgbm-wajib">NIP (18 digit)</span> : "NIP (18 digit)"}
            <input
              className="kgbm-input"
              data-autofocus={jenis === "baru" ? true : undefined}
              inputMode="numeric"
              value={isian.nip ?? ""}
              onChange={(e) => ubah("nip", e.target.value.replace(/\D/g, "").slice(0, 18))}
              placeholder="198809042025062014"
            />
            <span className="kgbm-bantuan">
              {jenis === "baru"
                ? "Delapan angka pertama tanggal lahir, enam berikutnya TMT CPNS. Masih dapat dibetulkan selama data ini belum diajukan ke Kanwil."
                : pegawai && isian.nip && isian.nip !== pegawai.nip
                  ? `Diusulkan berubah dari ${pegawai.nip}. Kanwil mencocokkannya dengan SK CPNS sebelum menyetujui.`
                  : "Ubah hanya bila NIP yang tercatat keliru. Kanwil mencocokkannya dengan SK CPNS sebelum menyetujui."}
            </span>
          </label>
          <div className="kgbm-grid2">
            {BIDANG_DIISI.filter((b) => BIDANG_IDENTITAS.has(b.kunci)).map((bidang) =>
              bidang.jenis === "tanggal" ? (
                <IsianTanggal
                  key={bidang.kunci}
                  label={bidang.label}
                  nilai={isian[bidang.kunci] ?? ""}
                  onUbah={(v) => ubah(bidang.kunci, v)}
                />
              ) : PILIHAN_BIDANG[bidang.kunci] ? (
                <IsianPilihan
                  key={bidang.kunci}
                  label={bidang.label}
                  daftar={PILIHAN_BIDANG[bidang.kunci]}
                  nilai={isian[bidang.kunci] ?? ""}
                  onUbah={(v) => ubah(bidang.kunci, v)}
                />
              ) : (
                <label className="kgbm-label" key={bidang.kunci}>
                  {label(bidang.kunci, bidang.label)}
                  <input
                    className="kgbm-input"
                    value={isian[bidang.kunci] ?? ""}
                    onChange={(e) => ubah(bidang.kunci, e.target.value)}
                  />
                </label>
              ),
            )}
          </div>
        </div>
      </div>

      {/* ── Jabatan ───────────────────────────────────────────────────── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Jabatan</p>
        </div>
        <div className="kgbm-bagian-isi">
          <div className="kgbm-grid2">
            {BIDANG_DIISI.filter((b) => ["jabatan", "jenisJabatan", "eselon"].includes(b.kunci)).map((bidang) =>
              PILIHAN_BIDANG[bidang.kunci] ? (
                <IsianPilihan
                  key={bidang.kunci}
                  label={bidang.label}
                  daftar={PILIHAN_BIDANG[bidang.kunci]}
                  nilai={isian[bidang.kunci] ?? ""}
                  onUbah={(v) => ubah(bidang.kunci, v)}
                />
              ) : (
                <label className="kgbm-label" key={bidang.kunci}>
                  {label(bidang.kunci, bidang.label)}
                  <input
                    className="kgbm-input"
                    value={isian[bidang.kunci] ?? ""}
                    onChange={(e) => ubah(bidang.kunci, e.target.value)}
                    placeholder="Penjaga Tahanan, Analis Kepegawaian, dan sebagainya"
                  />
                </label>
              ),
            )}
          </div>
        </div>
      </div>

      {/* ── Pangkat, gaji, dan KGB: bagian yang paling mudah keliru ───── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Pangkat, gaji pokok, dan KGB</p>
          <p className="kgbm-bagian-ket">
            Golongan, masa kerja golongan, TMT, dan nomor dari {skAcuan}, acuan jadwal KGB. SK sesudahnya diisi di bagian berikut.
          </p>
        </div>
        <div className="kgbm-bagian-isi">
          <div className="kgbm-grid2">
            <label className="kgbm-label">
              <span className="kgbm-wajib">{adaSkBaru ? `Golongan/ruang pada ${skAcuan}` : "Golongan/ruang"}</span>
              <select
                className="kgbm-input"
                value={isian.golonganRuang ?? ""}
                onChange={(e) => ubah("golonganRuang", e.target.value)}
              >
                <option value="">Pilih golongan</option>
                {Object.entries(GOLONGAN_PANGKAT).map(([golongan, pangkat]) => (
                  <option key={golongan} value={golongan}>{golongan} · {pangkat}</option>
                ))}
              </select>
            </label>
            <IsianTanggal
              label="TMT golongan"
              nilai={isian.tmtGolongan ?? ""}
              onUbah={(v) => ubah("tmtGolongan", v)}
              bantuan={
                adaSkBaru
                  ? "TMT golongan di atas. Golongan baru berlaku sejak TMT pangkat pada SK di bagian berikut."
                  : "Tanggal berlakunya golongan sekarang, dari SK kenaikan pangkat atau SK pengangkatan."
              }
            />
          </div>
          {adaSkBaru && mkgSkTercatat && koreksi.length === 0 && (
            <Catatan nada="navy">
              Terisi dari data tercatat, yang sudah memuat {mkgSkTercatat.jenis === "kp" ? "kenaikan pangkat" : "PMK"} TMT{" "}
              {formatTanggalId(mkgSkTercatat.tmt)}. Bila SK itu yang dilaporkan di bagian berikut, isi bagian ini dengan keadaan pada{" "}
              {skAcuan} supaya Kanwil menghitungnya dari sana.
            </Catatan>
          )}
          {adaSkBaru && koreksi.length > 0 && (
            <Catatan nada="amber">
              Data tercatat ikut dibetulkan: {koreksi.map((k) => `${k.label} ${k.lama} → ${k.baru}`).join(", ")}. Kanwil menghitung SK di
              bagian berikut dari isian ini dan melihat koreksinya saat meninjau.
            </Catatan>
          )}

          <div className="kgbm-pilihan" role="radiogroup" aria-label="Keadaan KGB pegawai">
            <button
              type="button"
              role="radio"
              aria-checked={!pernahKgb}
              onClick={() => { setPernahKgb(false); ubah("mkgTahun", "0"); ubah("mkgBulan", "0"); }}
            >
              Belum pernah KGB
            </button>
            <button type="button" role="radio" aria-checked={pernahKgb} onClick={() => setPernahKgb(true)}>
              Sudah pernah KGB
            </button>
          </div>

          {pernahKgb ? (
            <>
              <div className="kgbm-grid2">
                <IsianTanggal
                  label="TMT KGB terakhir"
                  wajib
                  nilai={isian.tmtKgbTerakhir ?? ""}
                  onUbah={(v) => ubah("tmtKgbTerakhir", v)}
                  bantuan="TMT pada SK KGB terakhir. Baru naik pangkat? Tanggal ini tetap dari siklus KGB sebelumnya, sebab kenaikan pangkat tidak mengulang hitungan KGB."
                />
                <div className="kgbm-grid2">
                  <label className="kgbm-label">
                    <span className="kgbm-wajib">Masa kerja (tahun)</span>
                    <input
                      className="kgbm-input"
                      inputMode="numeric"
                      value={isian.mkgTahun ?? ""}
                      onChange={(e) => ubah("mkgTahun", e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <label className="kgbm-label">
                    Masa kerja (bulan)
                    <input
                      className="kgbm-input"
                      inputMode="numeric"
                      value={isian.mkgBulan ?? ""}
                      onChange={(e) => ubah("mkgBulan", e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                </div>
              </div>
              <p className="kgbm-bantuan">
                {tercatat
                  ? "Masa kerja golongan tercatat adalah masa kerja pada TMT KGB terakhir, dasar hitungan KGB. SK kenaikan pangkat atau PMK sesudahnya dilaporkan di bagian berikut beserta masa kerja yang tertulis di SK itu."
                  : `Masa kerja golongan pada ${skAcuan}, disalin apa adanya dari SK itu, bukan dihitung sendiri dari lama bekerja. SK kenaikan pangkat atau PMK sesudahnya diisi di bagian berikut beserta golongan dan masa kerja menurut SK itu.`}
              </p>
              {mkgSkTercatat && (
                <p className="kgbm-bantuan" data-mkg-sk="">
                  Tercatat {tercatat?.mkgTahun || 0} tahun {tercatat?.mkgBulan || 0} bulan pada TMT KGB terakhir (dasar hitungan). Pada TMT{" "}
                  {mkgSkTercatat.jenis === "kp" ? "kenaikan pangkat" : "PMK"} {formatTanggalId(mkgSkTercatat.tmt)} masa kerjanya{" "}
                  {mkgSkTercatat.mkg.tahun} tahun {mkgSkTercatat.mkg.bulan} bulan, angka yang tertulis pada SK itu. Keduanya
                  benar; yang pertama dipakai menghitung KGB.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="kgbm-grid2">
                <IsianTanggal
                  label="TMT CPNS"
                  wajib
                  nilai={isian.tmtKgbTerakhir ?? ""}
                  onUbah={(v) => { ubah("tmtKgbTerakhir", v); if (!isian.tmtGolongan) ubah("tmtGolongan", v); }}
                  bantuan="Dari SK pengangkatan CPNS. Inilah tanggal awal hitungan KGB pertama, dan bagi CPNS sama dengan TMT golongan."
                />
              </div>
              <Catatan nada="amber">
                Masa kerja golongan diisi 0 tahun 0 bulan. Bila SK pengangkatan PNS terbit terlambat, SK itu
                biasanya sudah memuat KGB yang belum dibayarkan. Jangan menyalin masa kerja dan gaji pokok
                dari sana, sebab KGB beserta rapelannya justru yang sedang diusulkan.
              </Catatan>
            </>
          )}

          <div className="kgbm-hitungan">
            <p className="kgbm-hitungan-judul">{adaSkBaru ? `Dihitung sistem menurut ${skAcuan}` : "Dihitung sistem"}</p>
            <dl>
              <div><dt>Pangkat</dt><dd>{hitung.pangkat || "-"}</dd></div>
              <div>
                <dt>Gaji pokok</dt>
                <dd>{hitung.gajiPokok > 0 ? "Rp" + new Intl.NumberFormat("id-ID").format(hitung.gajiPokok) : "-"}</dd>
              </div>
              <div>
                <dt>TMT KGB berikutnya</dt>
                <dd>{hitung.tmtKgbBerikutnya ? formatTanggalId(hitung.tmtKgbBerikutnya) : "-"}</dd>
              </div>
            </dl>
            {hitung.penjelasan && <p className="kgbm-hitungan-ket">{hitung.penjelasan}</p>}
            {hitung.peringatan.map((pesan) => (
              <p className="kgbm-hitungan-ingat" key={pesan}>{pesan}</p>
            ))}
            {adaSkBaru && (
              <p className="kgbm-hitungan-ket">Keadaan sesudah SK yang dilaporkan dihitung di bagian berikut; itulah yang dicatat Kanwil.</p>
            )}
          </div>

          <div className="kgbm-grid2">
            <label className="kgbm-label">
              {`Nomor ${skAcuan}`}
              <input
                className="kgbm-input"
                value={sk.nomorSkTerakhir}
                onChange={(e) => setSk((f) => ({ ...f, nomorSkTerakhir: e.target.value }))}
              />
              <span className="kgbm-bantuan">
                {pernahKgb
                  ? "Selalu SK KGB terakhir, acuan jadwal KGB. SK kenaikan pangkat atau PMK sesudahnya tidak diisi di sini, melainkan dilaporkan pada bagian di bawah."
                  : "Bagi pegawai yang belum pernah KGB, SK CPNS inilah acuan pertama. SK kenaikan pangkat atau PMK sesudahnya dilaporkan pada bagian di bawah."}
              </span>
            </label>
            <IsianTanggal
              label={`Tanggal ${skAcuan}`}
              nilai={sk.tanggalSkTerakhir}
              onUbah={(v) => setSk((f) => ({ ...f, tanggalSkTerakhir: v }))}
            />
          </div>
        </div>
      </div>

      {/* ── SK sesudah SK KGB terakhir: pertanyaan wajib, lalu Atas dasar (ADR-030, ADR-065) ───── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">SK sesudah {skAcuan}</p>
          <p className="kgbm-bagian-ket">Kenaikan pangkat, penyesuaian ijazah, atau PMK yang belum tercatat di SIM-KGB</p>
        </div>
        <div className="kgbm-bagian-isi">
          <span className="kgbm-label">
            <span className="kgbm-wajib">Sesudah {skAcuan}, ada SK kenaikan pangkat, penyesuaian ijazah, atau PMK yang belum tercatat?</span>
          </span>
          <div className="kgbm-pilihan" role="radiogroup" aria-label={`SK sesudah ${skAcuan}`}>
            <button type="button" role="radio" aria-checked={jawaban === "tidak"} onClick={() => jawabSk(false)}>
              Tidak ada
            </button>
            <button type="button" role="radio" aria-checked={adaSkBaru} onClick={() => jawabSk(true)}>
              Ada
            </button>
          </div>
          {!jawaban && (
            <p className="kgbm-petunjuk">Wajib dijawab sebelum diajukan ke Kanwil, juga bila jawabannya tidak ada.</p>
          )}

          {adaSkBaru && (
            <>
              <div className="kol-sebab">
                {(["kp", "pmk"] as JenisDasarBaru[]).map((j) => (
                  <label key={j} className="kol-sebab-pilihan" data-pilih={dasar.jenis === j ? "" : undefined}>
                    <input type="radio" name="sebab-dasar" className="sr-only" checked={dasar.jenis === j} onChange={() => setDasar((d) => ({ ...d, jenis: j }))} />
                    <span className="kol-sebab-titik" aria-hidden="true" />
                    <span className="min-w-0">
                      <strong>{LABEL_DASAR_BARU[j]}</strong>
                      <span>{KETERANGAN_DASAR_BARU[j]}</span>
                    </span>
                  </label>
                ))}
              </div>
              {dasar.jenis === "kp" && (
                <div className="kgbm-grid2">
                  <label className="kgbm-label">
                    <span className="kgbm-wajib">Jenis kenaikan pangkat</span>
                    <select className="kgbm-input" value={dasar.jenisKp} onChange={(e) => setDasar((d) => ({ ...d, jenisKp: e.target.value }))}>
                      {Object.entries(JENIS_KP).map(([k, l]) => (
                        <option key={k} value={k}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <label className="kgbm-label">
                    <span className="kgbm-wajib">Golongan/ruang baru menurut SK</span>
                    <select className="kgbm-input" value={dasar.golongan ?? ""} onChange={(e) => setDasar((d) => ({ ...d, golongan: e.target.value }))}>
                      <option value="">Pilih golongan</option>
                      {Object.entries(GOLONGAN_PANGKAT).map(([golongan, pangkat]) => (
                        <option key={golongan} value={golongan}>{golongan} · {pangkat}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="kgbm-grid2">
                <label className="kgbm-label">
                  <span className="kgbm-wajib">Masa kerja golongan menurut SK (tahun)</span>
                  <input
                    className="kgbm-input"
                    inputMode="numeric"
                    value={dasar.mkgTahun ?? ""}
                    onChange={(e) => setDasar((d) => ({ ...d, mkgTahun: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                  />
                </label>
                <label className="kgbm-label">
                  Masa kerja golongan menurut SK (bulan)
                  <input
                    className="kgbm-input"
                    inputMode="numeric"
                    value={dasar.mkgBulan ?? ""}
                    onChange={(e) => setDasar((d) => ({ ...d, mkgBulan: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                  />
                </label>
              </div>
              <p className="kgbm-bantuan">
                {dasar.jenis === "kp"
                  ? "Salin dari SK kenaikan pangkat apa adanya: masa kerja golongan pada TMT pangkat, sesudah potongan bila pindah golongan. Sistem mencocokkannya dengan hitungannya sendiri."
                  : `Salin dari SK PMK apa adanya: masa kerja golongan pada TMT PMK sesudah ditambah. Golongan tetap ${isian.golonganRuang || "seperti di atas"}.`}
              </p>
              <div className="kgbm-grid2">
                <label className="kgbm-label">
                  <span className="kgbm-wajib">Nomor {dasar.jenis === "kp" ? "SK kenaikan pangkat" : "SK PMK"}</span>
                  <input className="kgbm-input" value={dasar.nomorSk} onChange={(e) => setDasar((d) => ({ ...d, nomorSk: e.target.value }))} />
                </label>
                <IsianTanggal label="Tanggal SK" wajib nilai={dasar.tanggalSk} onUbah={(v) => setDasar((d) => ({ ...d, tanggalSk: v }))} />
              </div>
              <div className="kgbm-grid2">
                <IsianTanggal
                  label={dasar.jenis === "kp" ? "TMT pangkat" : "TMT PMK"}
                  wajib
                  nilai={dasar.tmt}
                  onUbah={(v) => setDasar((d) => ({ ...d, tmt: v }))}
                />
                <label className="kgbm-label">
                  Ditetapkan oleh
                  <input className="kgbm-input" value={dasar.penetap} onChange={(e) => setDasar((d) => ({ ...d, penetap: e.target.value }))} placeholder="Pejabat penanda tangan SK" />
                </label>
              </div>
              {skSudahTercatat && (
                <Catatan nada="amber">
                  SK ini sudah tercatat di SIM-KGB. Bila datanya sudah benar, jawab Tidak ada. Bila keadaan sebelum SK keliru, betulkan
                  bagian atas ke keadaan pada {skAcuan}: Kanwil menghitung ulang SK ini dari isian Anda tanpa mencatatnya dua kali.
                </Catatan>
              )}
              {/* Keadaan sesudah SK ini, dengan hitungan persetujuan Kanwil (ADR-078). */}
              <div className="kgbm-hitungan" data-sesudah-sk="">
                <p className="kgbm-hitungan-judul">Dihitung sistem sesudah SK ini</p>
                {sesudahSk?.ok ? (
                  <>
                    <dl>
                      <div><dt>Pangkat</dt><dd>{sesudahSk.pangkat ? `${sesudahSk.pangkat} (${sesudahSk.golongan})` : sesudahSk.golongan}</dd></div>
                      <div>
                        <dt>Gaji pokok</dt>
                        <dd>{sesudahSk.gajiPokok > 0 ? "Rp" + new Intl.NumberFormat("id-ID").format(sesudahSk.gajiPokok) : "-"}</dd>
                      </div>
                      <div>
                        <dt>TMT KGB berikutnya</dt>
                        <dd>{sesudahSk.tmtKgbBerikutnya ? formatTanggalId(sesudahSk.tmtKgbBerikutnya) : "-"}</dd>
                      </div>
                    </dl>
                    <p className="kgbm-hitungan-ket">{sesudahSk.penjelasan}</p>
                    {sesudahSk.cocok && !sesudahSk.cocok.cocok && (
                      <p className="kgbm-hitungan-ingat">
                        Masa kerja menurut SK {sesudahSk.cocok.menurutSk.tahun} tahun {sesudahSk.cocok.menurutSk.bulan} bulan, sedangkan
                        hitungan sistem {sesudahSk.cocok.hitungan.tahun} tahun {sesudahSk.cocok.hitungan.bulan} bulan. Periksa lagi golongan dan
                        masa kerja pada {skAcuan} di atas, TMT pangkat, dan masa kerja di SK. Bila SK memang berbeda, sebutkan pada catatan
                        untuk Kanwil.
                      </p>
                    )}
                    {sesudahSk.cocok?.cocok && (
                      <p className="kgbm-hitungan-ket" data-cocok="">
                        Masa kerja menurut SK sesuai hitungan sistem.
                      </p>
                    )}
                    {sesudahSk.gajiPokok === 0 && (
                      <p className="kgbm-hitungan-ingat">
                        Masa kerja hasil hitungan belum ada di tabel gaji PP 5/2024 untuk golongan {sesudahSk.golongan}. Periksa golongan dan masa kerjanya.
                      </p>
                    )}
                  </>
                ) : sesudahSk ? (
                  <p className="kgbm-hitungan-ingat">{sesudahSk.pesan}</p>
                ) : (
                  <p className="kgbm-hitungan-ket">
                    {dasar.jenis === "kp"
                      ? "Pilih golongan baru dan isi TMT pangkat untuk melihat gaji pokok dan KGB berikutnya sesudah SK ini."
                      : "Isi masa kerja menurut SK PMK dan TMT PMK untuk melihat gaji pokok dan KGB berikutnya sesudah SK ini."}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Tidak ada SK, tetapi golongan atau masa kerja berbeda dari yang tercatat: hanya koreksi salah ketik. */}
          {jawaban === "tidak" && (perluSebab || dasar.jenis === "koreksi") && (
            <div className="kol-sebab">
              <label className="kol-sebab-pilihan" data-pilih={dasar.jenis === "koreksi" ? "" : undefined}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={dasar.jenis === "koreksi"}
                  onChange={(e) => setDasar((d) => ({ ...d, jenis: e.target.checked ? "koreksi" : "tidak" }))}
                />
                <span className="kol-sebab-titik" aria-hidden="true" />
                <span className="min-w-0">
                  <strong>{LABEL_DASAR_BARU.koreksi}</strong>
                  <span>
                    Golongan atau masa kerja golongan berbeda dari yang tercatat tanpa SK baru. Centang bila yang tercatat salah ketik;
                    bila perubahannya karena SK, jawab Ada.
                  </span>
                </span>
              </label>
            </div>
          )}

          {pratinjauDasar && (
            <Catatan nada="navy">
              Atas dasar SK KGB berikutnya: <strong>{teksAtasDasar(pratinjauDasar)}</strong>. {asalAtasDasar(pratinjauDasar, skAcuan)}{" "}
              {skAcuan} tetap acuan jadwal KGB.
            </Catatan>
          )}
        </div>
      </div>

      {/* ── Hukuman disiplin: kini lewat modulnya sendiri (ADR-016) ───── */}
      {draf?.hukdis?.ada ? (
        <Catatan nada="amber">
          Draf ini masih memuat laporan hukuman disiplin dari formulir lama, dan laporan itu tetap ikut terkirim.
          Laporan hukuman disiplin yang baru disampaikan lewat menu <Link href="/dashboard/upt/hukdis">Hukuman Disiplin</Link>.
        </Catatan>
      ) : (
        <p className="kgbm-legenda">
          Hukuman disiplin tidak lagi dilaporkan di sini. Gunakan menu <Link href="/dashboard/upt/hukdis">Hukuman Disiplin</Link>{" "}
          beserta pindaian SK hukumannya; Tim SDM Hukdis Kanwil yang meninjau dan mencatatnya.
        </p>
      )}

      {/* ── Berkas ────────────────────────────────────────────────────── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Berkas pendukung</p>
          <p className="kgbm-bagian-ket">Pindai sebagai dokumen, bukan foto: tiap berkas paling besar 500 KB</p>
        </div>
        <div className="kgbm-bagian-isi">
          {/* Pindaian SK PMK hanya diminta bila sebabnya memang PMK (ADR-045); usulan perbaikan biasa
              tidak menyertakannya. Kenaikan pangkat sudah terwakili "SK kenaikan pangkat terakhir". */}
          {[...berkasUntukKeadaan(pernahKgb), ...berkasDasarBaru(dasar.jenis)].map((b) => {
            const wajib = b.wajib;
            const simpanan = draf?.berkas.find((x) => x.medan === b.medan) ?? null;
            // Tanpa berkas sendiri, berkas terakhir yang disetujui Kanwil ikut terbawa saat disimpan.
            const dariBawaan = simpanan ? null : (bawaan?.berkas.find((x) => x.medan === b.medan) ?? null);
            return (
              <KolomBerkas
                key={b.medan}
                label={b.label}
                wajib={wajib}
                bantuan={b.keterangan}
                dipilih={berkas[b.medan] ?? null}
                urlTersimpan={
                  draf && simpanan
                    ? `/api/usulan/${draf.id}/berkas?berkas=${b.medan}`
                    : dariBawaan
                      ? `/api/usulan/${dariBawaan.usulanId}/berkas?berkas=${b.medan}`
                      : null
                }
                namaTersimpan={simpanan?.nama ?? (dariBawaan ? `${dariBawaan.nama ?? b.label} · dari usulan yang disetujui` : null)}
                ditandaiHapus={hapusTersimpan.has(b.medan)}
                onPilih={(f) => {
                  setBerkas((lama) => ({ ...lama, [b.medan]: f }));
                  // Berkas pengganti menggantikan yang tersimpan; tanda hapusnya tidak diperlukan lagi.
                  if (f) tandaiHapus(b.medan, false);
                }}
                onHapusTersimpan={() => tandaiHapus(b.medan, true)}
                onBatalHapus={() => tandaiHapus(b.medan, false)}
                onPratinjau={(judul, url, lokal) => setPratinjau({ judul, url, lokal })}
              />
            );
          })}
          <label className="kgbm-label">
            Catatan untuk Kanwil
            <textarea
              className="kgbm-input"
              rows={2}
              value={sk.catatanUpt}
              onChange={(e) => setSk((f) => ({ ...f, catatanUpt: e.target.value }))}
            />
          </label>
        </div>
      </div>
      {pratinjauSk && (
        <ModalPratinjauSkUsulan isian={pratinjauSk} nama={isian.nama || pegawai?.nama || "Pegawai"} onTutup={() => setPratinjauSk(null)} />
      )}
      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={`${isian.nama || pegawai?.nama || "Pegawai"} · berkas tersimpan`}
          url={pratinjau.url}
          onTutup={tutupPratinjau}
        />
      )}
    </KerangkaModal>
  );
}

export { SK_KOSONG };
