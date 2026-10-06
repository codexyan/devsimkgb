"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { Catatan } from "@/app/dashboard/components/kgb";
import { GAYA_MODAL_KGB } from "@/app/dashboard/components/kgb/gayaModal";
import PratinjauBerkas from "./PratinjauBerkas";
import {
  ATURAN_DASAR_BARU,
  BATAS_BARIS_IMPOR,
  KOLOM_DASAR_BARU,
  KOLOM_TEMPLAT_UPT,
  LABEL_PERAN_KOLOM,
  LEMBAR_DATA_UPT,
  PANDUAN_DASAR_BARU,
  bacaBerkasUpt,
  templatCsvUpt,
  type BerkasUpt,
  type HasilImpor,
} from "@/lib/imporUsulanUpt";
import { FORMAT_TANGGAL_DITERIMA } from "@/lib/dataPegawai";
import { buangPetunjukPemisah } from "@/lib/csv";

/* Unggah daftar pegawai sekaligus, tiga langkah: pilih berkas, periksa, selesai.
 *
 * Dulu seluruhnya satu jendela kecil yang hanya menampilkan tiga angka (berapa sah, berapa gagal,
 * berapa belum lengkap). Operator tidak pernah melihat datanya sendiri, padahal kesalahan yang paling
 * merugikan justru lolos pemeriksaan: tanggal Excel yang tertukar hari dan bulannya tetap terbaca
 * "sah", dan kolom yang bergeser satu posisi pun begitu. Karena itu langkah kedua sekarang menampilkan
 * setiap baris apa adanya menurut bacaan server, dan operator mencentang sendiri mana yang disimpan.
 *
 * Yang menilai isinya tetap server (lib/imporUsulanUpt.ts, lewat /api/upt/usulan/impor): peramban hanya
 * mengurai berkas dan menggambar hasilnya, sehingga aturannya tidak pernah ada dua salinan.
 */

/** Satu baris berkas beserta penilaian server atasnya. */
interface BarisPratinjau {
  baris: number;
  nip: string;
  nama: string;
  hasil: HasilImpor;
  galat: string | null;
  kurang: string[];
  namaTercatat: string | null;
  beda: { label: string; sekarang: string; diusulkan: string }[];
  nilai: { label: string; nilai: string }[];
  /** SK sebab perubahan golongan atau masa kerja yang disebut baris ini; null bila tidak disebut. */
  dasarBaru: string | null;
}

interface Pratinjau {
  baru: number;
  perubahan: number;
  sama: number;
  ditolak: number;
  belumLengkap: number;
  baris: BarisPratinjau[];
}

interface HasilSimpan {
  disimpan: number;
  baru: number;
  perubahan: number;
  sama: number;
  ditolak: number;
  belumLengkap: number;
  berubahSejakPratinjau: number;
}

type Saring = "semua" | HasilImpor;

const KELOMPOK: { k: HasilImpor; label: string; nada: string; ket: string }[] = [
  {
    k: "baru",
    label: "Pegawai baru",
    nada: "hijau",
    ket: "NIP belum tercatat. Disimpan sebagai draf pegawai baru.",
  },
  {
    k: "perubahan",
    label: "Perbaikan data",
    nada: "kuning",
    ket: "NIP sudah tercatat dan ada isian yang berbeda. Disimpan sebagai draf usulan perbaikan.",
  },
  {
    k: "sama",
    label: "Sama, dilewati",
    nada: "",
    ket: "Sudah tercatat dan tidak ada satu pun yang berbeda, jadi tidak ada yang perlu diusulkan.",
  },
  {
    k: "ditolak",
    label: "Ditolak",
    nada: "merah",
    ket: "Barisnya tidak dapat dipakai. Betulkan di berkasnya, lalu unggah bagian itu saja.",
  },
];

const dapatDipilih = (b: BarisPratinjau) => b.hasil === "baru" || b.hasil === "perubahan";

function unduh(isi: BlobPart, jenis: string, nama: string) {
  const url = URL.createObjectURL(new Blob([isi], { type: jenis }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}

/* Templat Excel menjadi templat utama: kolom NIP-nya sudah bertipe Text, tanggalnya bertipe tanggal, dan
   kolom berpilihan berupa daftar pilihan, jadi tiga kesalahan CSV yang paling sering tidak dapat terjadi.
   Penulisnya dimuat saat tombolnya ditekan saja, supaya halaman ini tidak memikulnya sejak awal. */
async function unduhTemplatExcel() {
  const { templatXlsxUpt, NAMA_TEMPLAT_XLSX_UPT } = await import("@/lib/templatUnggahUpt");
  unduh(templatXlsxUpt() as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", NAMA_TEMPLAT_XLSX_UPT);
}

function unduhTemplatCsv() {
  unduh(templatCsvUpt(), "text/csv;charset=utf-8", "templat_data_pegawai_upt.csv");
}

/** Isian keenam kolom dasarBaru pada satu keadaan, sebagai teks pendek untuk panduan di layar. */
function ringkasIsianDasar(isian: Readonly<Record<string, string>>): string {
  const terisi = KOLOM_DASAR_BARU.filter((k) => isian[k]);
  if (terisi.length === 0) return "keenam kolom kosong";
  return terisi.map((k) => `${k}: ${isian[k]}`).join(" · ");
}

export default function UnggahDaftar() {
  const [langkah, setLangkah] = useState<1 | 2 | 3>(1);
  const [namaBerkas, setNamaBerkas] = useState("");
  // Isi berkas apa adanya, ditampilkan di Pratinjau berkas sebelum dikirim untuk diperiksa.
  const [berkas, setBerkas] = useState<{ isi: BerkasUpt; lembar: string | null } | null>(null);
  const [baris, setBaris] = useState<Record<string, unknown>[] | null>(null);
  const [pratinjau, setPratinjau] = useState<Pratinjau | null>(null);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [saring, setSaring] = useState<Saring>("semua");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasilSimpan, setHasilSimpan] = useState<HasilSimpan | null>(null);

  function ulangDariAwal() {
    setLangkah(1);
    setNamaBerkas("");
    setBerkas(null);
    setBaris(null);
    setPratinjau(null);
    setPilih(new Set());
    setSaring("semua");
    setCari("");
    setGalat(null);
    setHasilSimpan(null);
  }

  /**
   * Tabel hasil urai berkas, Excel maupun CSV, menjadi pratinjau. Belum ada yang dikirim: operator melihat
   * dulu kolom yang dibaca dan isinya, lalu menekan Lanjut (PratinjauBerkas).
   */
  function terima(tabel: string[][], lembar: string | null) {
    setBerkas({ isi: bacaBerkasUpt(tabel), lembar });
  }

  function lanjutPeriksa() {
    if (!berkas) return;
    setBaris(berkas.isi.baris);
    void periksa(berkas.isi.baris);
  }

  async function bacaExcel(file: File) {
    setSibuk(true);
    try {
      const { bacaLembarXlsx } = await import("@/lib/xlsx");
      // Lembar "Data Pegawai" pada templat; berkas buatan sendiri dibaca dari lembar pertamanya.
      const lembar = bacaLembarXlsx(new Uint8Array(await file.arrayBuffer()), { lembar: LEMBAR_DATA_UPT });
      setSibuk(false);
      terima(lembar.baris, lembar.nama);
    } catch (e) {
      setSibuk(false);
      setGalat(e instanceof Error && e.name === "GalatXlsx" ? e.message : "Berkas Excel tidak dapat dibaca. Simpan ulang sebagai Excel Workbook (.xlsx), lalu unggah lagi.");
    }
  }

  function pilihBerkas(file: File | null) {
    setBerkas(null);
    setPratinjau(null);
    setBaris(null);
    setGalat(null);
    setNamaBerkas(file?.name ?? "");
    if (!file) return;
    const nama = file.name.toLowerCase();
    if (nama.endsWith(".xls") || nama.endsWith(".xlsb") || nama.endsWith(".ods")) {
      setGalat("Berkas ini bukan .xlsx. Di Excel, pilih File → Save As → Excel Workbook (.xlsx), atau pakai templat Excel di langkah ini.");
      return;
    }
    if (nama.endsWith(".xlsx") || nama.endsWith(".xlsm")) {
      void bacaExcel(file);
      return;
    }
    // Diurai sebagai tabel, bukan rekaman berjudul: judul kolomnya dikenali bacaBerkasUpt, sama dengan berkas
    // Excel, termasuk baris judul yang tidak berada di baris pertama.
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      // Baris `sep=;` pada templat yang diunduh bukan data, jadi dibuang sebelum diurai. Pemisahnya
      // sendiri ditebak PapaParse, sehingga berkas simpanan Excel berkoma pun tetap terbaca.
      beforeFirstChunk: buangPetunjukPemisah,
      complete: (hasil) => terima(hasil.data, null),
      error: () => setGalat("Berkas tidak dapat dibaca. Pastikan berformat Excel (.xlsx) atau CSV."),
    });
  }

  async function periksa(data: Record<string, unknown>[]) {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/upt/usulan/impor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baris: data, periksaSaja: true }),
      });
      const d = (await res.json().catch(() => ({}))) as Pratinjau & { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Berkas gagal diperiksa");
        return;
      }
      setPratinjau(d);
      // Bawaannya semua yang dapat disimpan ikut tercentang; operator membuang yang tidak dikehendaki.
      setPilih(new Set(d.baris.filter(dapatDipilih).map((b) => b.baris)));
      setSaring(d.baru + d.perubahan > 0 ? "semua" : "ditolak");
      setLangkah(2);
    } catch {
      setGalat("Berkas gagal diperiksa");
    } finally {
      setSibuk(false);
    }
  }

  async function simpan() {
    if (!baris || pilih.size === 0) return;
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/upt/usulan/impor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baris, pilih: [...pilih] }),
      });
      const d = (await res.json().catch(() => ({}))) as HasilSimpan & { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Data gagal disimpan");
        return;
      }
      setHasilSimpan(d);
      setLangkah(3);
    } catch {
      setGalat("Data gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

  const jumlah = useMemo(() => {
    const p = pratinjau;
    return {
      semua: p?.baris.length ?? 0,
      baru: p?.baru ?? 0,
      perubahan: p?.perubahan ?? 0,
      sama: p?.sama ?? 0,
      ditolak: p?.ditolak ?? 0,
    };
  }, [pratinjau]);

  const tampil = useMemo(() => {
    if (!pratinjau) return [];
    const q = cari.trim().toLowerCase();
    return pratinjau.baris.filter((b) => {
      if (saring !== "semua" && b.hasil !== saring) return false;
      if (!q) return true;
      return b.nama.toLowerCase().includes(q) || b.nip.includes(q);
    });
  }, [pratinjau, saring, cari]);

  const dapatDipilihTampil = tampil.filter(dapatDipilih);
  const semuaTampilDipilih = dapatDipilihTampil.length > 0 && dapatDipilihTampil.every((b) => pilih.has(b.baris));

  function alih(n: number) {
    setPilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(n)) baru.delete(n);
      else baru.add(n);
      return baru;
    });
  }

  function alihSemuaTampil() {
    setPilih((lama) => {
      const baru = new Set(lama);
      for (const b of dapatDipilihTampil) {
        if (semuaTampilDipilih) baru.delete(b.baris);
        else baru.add(b.baris);
      }
      return baru;
    });
  }

  const LANGKAH: { n: 1 | 2 | 3; judul: string; ket: string; bisa: boolean }[] = [
    {
      n: 1,
      judul: "Pilih berkas",
      ket: berkas ? `${namaBerkas} · ${berkas.isi.baris.length} baris` : namaBerkas || "belum dipilih",
      bisa: true,
    },
    {
      n: 2,
      judul: "Periksa & konfirmasi",
      ket: pratinjau ? `${pilih.size} dari ${jumlah.semua} baris dicentang` : "unggah berkas dulu",
      bisa: !!pratinjau,
    },
    { n: 3, judul: "Selesai", ket: hasilSimpan ? `${hasilSimpan.disimpan} tersimpan` : "belum disimpan", bisa: !!hasilSimpan },
  ];

  return (
    <div className="dsb-halaman">
      {/* Halaman ini memakai komponen tampilan modal KGB (Catatan, kgbm-data, kgbm-panduan) di luar modal,
          sehingga gayanya tidak ikut termuat oleh KerangkaModal dan seluruh kotaknya tampil polos,
          termasuk peringatan NIP yang justru harus menonjol. href dan precedence-nya sama dengan yang
          dipasang KerangkaModal, jadi React menggabungkannya menjadi satu bila keduanya tampil. */}
      <style href="sim-kgb-modal-kgb" precedence="default">
        {GAYA_MODAL_KGB}
      </style>
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Pegawai Satker</p>
          <h1 className="dsb-halaman-judul">Unggah daftar pegawai</h1>
          <p className="dsb-sub">
            Satu berkas Excel (.xlsx) atau CSV berisi banyak pegawai sekaligus. Isinya diperiksa dan ditampilkan lebih
            dulu; tidak ada yang tersimpan sebelum Anda mencentang dan menekan Simpan.
          </p>
        </div>
      </header>

      <ol className="kol-langkah dsb-muncul" aria-label="Langkah unggah daftar">
        {LANGKAH.map((l) => (
          <li key={l.n}>
            <button
              type="button"
              aria-current={langkah === l.n ? "step" : undefined}
              data-lewat={langkah > l.n ? "" : undefined}
              disabled={!l.bisa || langkah === 3}
              onClick={() => l.bisa && langkah !== 3 && setLangkah(l.n)}
            >
              <span className="kol-langkah-nomor" aria-hidden="true">
                {langkah > l.n ? "✓" : l.n}
              </span>
              <span className="kol-langkah-teks">
                <strong>{l.judul}</strong>
                <span>{l.ket}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {galat && (
        <div className="dsb-pesan" data-nada="merah" role="alert">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <span>{galat}</span>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setGalat(null)}>
            ×
          </button>
        </div>
      )}

      {/* ── Langkah 1: pilih berkas ──────────────────────────────── */}
      {langkah === 1 && berkas && (
        <section className="dsb-panel kol-panel ung-panel" aria-label="Pratinjau berkas">
          <div className="ung-isi">
            <PratinjauBerkas
              berkas={berkas.isi}
              namaBerkas={namaBerkas}
              lembar={berkas.lembar}
              sibuk={sibuk}
              onLanjut={lanjutPeriksa}
              onGanti={ulangDariAwal}
            />
          </div>
        </section>
      )}

      {langkah === 1 && !berkas && (
        <section className="dsb-panel kol-panel ung-panel" aria-label="Pilih berkas">
          <div className="ung-isi">
            <Catatan>
              Unduh templat Excel di bawah, lalu isi lembar <strong>{LEMBAR_DATA_UPT}</strong>, satu baris untuk satu
              pegawai. Templatnya memuat lembar panduan dan contoh. Isinya masuk sebagai data yang disiapkan, belum
              terkirim: setelah ini pegawainya tampil di Pegawai Satker sebagai baris bertanda; pilih dan lengkapi di Usul KGB Kolektif, saringan Pegawai baru, lalu
              ajukan bersama satu surat usulan. Kolom unit kerja pada berkas diabaikan, sebab satkernya mengikuti akun
              ini.
            </Catatan>

            {/* Kesalahan yang paling sering terjadi dan paling sulit disadari, karena NIP yang rusak
                tetap berupa 18 angka. Diletakkan di depan, sebelum berkas dipilih, sebab sesudah
                berkasnya telanjur disimpan Excel angka aslinya sudah tidak dapat dikembalikan. */}
            <Catatan nada="amber">
              <strong>Jaga kolom NIP.</strong> Excel memperlakukan NIP sebagai angka biasa dan hanya menyimpan 15
              angka pertamanya, sehingga NIP <code>197112051998031004</code> berubah menjadi{" "}
              <code>197112051998031000</code>: tetap 18 angka, tetapi bukan lagi NIP siapa pun.
              <br />
              Pada <strong>templat Excel</strong> kolom <code>nip</code> sudah berformat Text, jadi NIP yang diketik
              di sana tetap utuh. Bila menyalin dari daftar lain, pastikan NIP-nya tampil 18 angka utuh, bukan{" "}
              <code>1,97E+17</code> atau berakhiran <code>000</code>; yang demikian harus diketik ulang dari SK.
              <br />
              Pada <strong>berkas CSV</strong>, jangan membukanya dengan klik ganda: buka lewat{" "}
              <strong>Data → From Text/CSV</strong> dan setel kolom <code>nip</code> sebagai <strong>Text</strong>{" "}
              sebelum ditarik masuk. NIP yang rusak ditolak di langkah berikutnya beserta sebabnya, jadi tidak akan
              diam-diam tersimpan sebagai pegawai baru.
            </Catatan>

            <div className="kgbm-data">
              <div className="kgbm-data-kepala">
                <span>Templat</span>
                <span className="ung-templat-tombol">
                  <button type="button" className="kgbm-tombol kgbm-utama kgbm-tombol-kecil" onClick={() => void unduhTemplatExcel()}>
                    Unduh templat Excel
                  </button>
                  <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" onClick={unduhTemplatCsv}>
                    CSV
                  </button>
                </span>
              </div>
              <details className="kgbm-panduan">
                <summary>Panduan kolom ({KOLOM_TEMPLAT_UPT.length} kolom)</summary>
                <dl>
                  {KOLOM_TEMPLAT_UPT.map((k) => (
                    <div className="kgbm-data-baris" key={k.kolom}>
                      <dt>
                        <code>{k.kolom}</code>
                        <br />
                        <span>{k.label}</span>
                        <br />
                        <span data-peran={k.peran}>{LABEL_PERAN_KOLOM[k.peran]}</span>
                      </dt>
                      <dd>
                        {k.keterangan}
                        {k.contoh && (
                          <>
                            {" "}
                            Contoh: <code>{k.contoh}</code>
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="kgbm-bantuan">
                  Judul kolom di baris pertama jangan diubah; judul yang ditulis sedikit berbeda, misalnya{" "}
                  <code>Golongan ruang*</code>, tetap dikenali. Tanggal ditulis {FORMAT_TANGGAL_DITERIMA}, atau
                  sebagai tanggal Excel biasa. Nomor SK dasar dan pindaian berkas tidak lewat berkas ini; keduanya
                  dilengkapi per pegawai sebelum diajukan. Templat CSV memuat satu baris contoh fiktif: hapus sebelum
                  mengunggah. Pemisahnya titik koma, seperti yang diharapkan Excel di sini; berkas yang disimpan Excel
                  dengan pemisah koma pun tetap terbaca.
                </p>
              </details>
              <details className="kgbm-panduan">
                <summary>Mengisi enam kolom dasarBaru (sebab golongan atau masa kerja berubah)</summary>
                <ul className="ung-aturan">
                  {ATURAN_DASAR_BARU.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <dl>
                  {PANDUAN_DASAR_BARU.map((p) => (
                    <div className="kgbm-data-baris" key={p.keadaan}>
                      <dt>
                        <strong>{p.keadaan}</strong>
                        <br />
                        <span>{p.misalnya}</span>
                      </dt>
                      <dd>
                        <code>{ringkasIsianDasar(p.isian)}</code>
                        <br />
                        {p.barisLain}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="kgbm-bantuan">
                  Nomor SK pada contoh di atas fiktif. Templat Excel memuat tabel yang sama pada lembar Panduan
                  dasarBaru, lengkap dengan arti tiap pilihan <code>dasarBaruJenisKp</code>.
                </p>
              </details>
            </div>

            <label className="kgbm-label">
              Berkas Excel atau CSV
              <input
                className="kgbm-input"
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                data-autofocus
                disabled={sibuk}
                onChange={(e) => pilihBerkas(e.target.files?.[0] ?? null)}
              />
              <span className="kgbm-bantuan">
                Paling banyak {BATAS_BARIS_IMPOR} baris sekali unggah. Pangkat, gaji pokok, dan TMT KGB berikutnya tidak
                perlu diisi: ketiganya dihitung sistem dari golongan, masa kerja golongan, dan TMT KGB terakhir.
              </span>
            </label>

            {sibuk && (
              <p className="dsb-kosong" role="status">
                Membaca {namaBerkas}…
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Langkah 2: periksa tiap baris, lalu centang ──────────── */}
      {langkah === 2 && pratinjau && (
        <section className="dsb-panel kol-panel" aria-label="Periksa dan konfirmasi">
          <div className="ung-ringkas">
            {KELOMPOK.map((g) => (
              <div key={g.k} className="ung-ringkas-butir" data-nada={g.nada || undefined}>
                <strong>{jumlah[g.k]}</strong>
                <span>{g.label}</span>
                <small>{g.ket}</small>
              </div>
            ))}
          </div>

          <p className="kol-info">
            Angka di bawah <b>adalah hasil bacaan sistem</b>, bukan tulisan mentah di berkas. Periksa terutama
            tanggalnya: Excel kerap menukar hari dengan bulan. Buka sebuah baris untuk melihat seluruh isinya.
          </p>

          <div className="kol-alat">
            <div className="dsb-segmen" role="group" aria-label="Saring baris">
              <button type="button" aria-pressed={saring === "semua"} onClick={() => setSaring("semua")}>
                Semua <small>{jumlah.semua}</small>
              </button>
              {KELOMPOK.map((g) => (
                <button key={g.k} type="button" aria-pressed={saring === g.k} onClick={() => setSaring(g.k)}>
                  {g.label} <small>{jumlah[g.k]}</small>
                </button>
              ))}
            </div>
            <input
              type="search"
              className="dsb-cari"
              placeholder="Cari nama atau NIP"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              aria-label="Cari baris"
            />
          </div>

          <div className="ung-kepala">
            {/* Centang semua sengaja berupa kotak centang di kolomnya sendiri, bukan tautan berteks:
                teksnya melebar dan menabrak kolom sebelahnya di layar sedang. */}
            <label className="ung-centang" data-pilih={semuaTampilDipilih ? "" : undefined}>
              <input
                type="checkbox"
                className="sr-only"
                checked={semuaTampilDipilih}
                disabled={dapatDipilihTampil.length === 0}
                onChange={alihSemuaTampil}
              />
              <span aria-hidden="true">{semuaTampilDipilih ? "✓" : ""}</span>
              <span className="sr-only">
                {semuaTampilDipilih ? "Batalkan centang semua baris yang tampil" : "Centang semua baris yang dapat disimpan"}
              </span>
            </label>
            <span>Baris</span>
            <span>Nama dan NIP</span>
            <span>Hasil pemeriksaan</span>
          </div>

          {tampil.length === 0 ? (
            <p className="dsb-kosong">Tidak ada baris yang cocok.</p>
          ) : (
            <ul className="ung-daftar">
              {tampil.map((b) => {
                const bisa = dapatDipilih(b);
                const dipilih = pilih.has(b.baris);
                const kelompok = KELOMPOK.find((g) => g.k === b.hasil)!;
                return (
                  <li key={b.baris}>
                    <div className="ung-baris" data-pilih={dipilih ? "" : undefined} data-mati={bisa ? undefined : ""}>
                      <label className="ung-centang">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={dipilih}
                          disabled={!bisa}
                          onChange={() => alih(b.baris)}
                        />
                        <span aria-hidden="true">{dipilih ? "✓" : ""}</span>
                        <span className="sr-only">
                          Sertakan baris {b.baris} {b.nama}
                        </span>
                      </label>
                      <span className="ung-nomor">{b.baris}</span>
                      <span className="ung-orang min-w-0">
                        <strong>{b.nama || "(nama kosong)"}</strong>
                        <span>{b.nip || "(NIP kosong)"}</span>
                        {b.namaTercatat && b.namaTercatat !== b.nama && (
                          <span className="ung-tercatat">tercatat sebagai {b.namaTercatat}</span>
                        )}
                      </span>
                      <span className="ung-hasil min-w-0">
                        <span className="dsb-tag" data-garis="" data-nada={kelompok.nada || undefined}>
                          {kelompok.label}
                        </span>
                        {b.galat && <span className="ung-galat">{b.galat}</span>}
                        {b.beda.length > 0 && (
                          <span className="ung-beda-ringkas">
                            {b.beda.length} isian berubah: {b.beda.map((x) => x.label).join(", ")}
                          </span>
                        )}
                        {b.dasarBaru && <span className="ung-dasar">Sebab: {b.dasarBaru}</span>}
                        {b.kurang.length > 0 && (
                          <span className="ung-kurang">Perlu dilengkapi nanti: {b.kurang.join(", ")}</span>
                        )}
                      </span>
                    </div>

                    {(b.nilai.length > 0 || b.beda.length > 0) && (
                      <details className="ung-rinci">
                        <summary>Lihat isi baris ini</summary>
                        {b.beda.length > 0 && (
                          <table className="ung-tabel">
                            <caption>Yang berbeda dari data tercatat</caption>
                            <thead>
                              <tr>
                                <th scope="col">Isian</th>
                                <th scope="col">Tercatat sekarang</th>
                                <th scope="col">Menurut berkas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {b.beda.map((x) => (
                                <tr key={x.label}>
                                  <th scope="row">{x.label}</th>
                                  <td>{x.sekarang}</td>
                                  <td data-baru="">{x.diusulkan}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {b.nilai.length > 0 && (
                          <dl className="ung-nilai">
                            {b.nilai.map((n) => (
                              <div key={n.label}>
                                <dt>{n.label}</dt>
                                <dd>{n.nilai}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="kol-kaki">
            <span>
              <strong>{pilih.size}</strong> baris dicentang
              {pratinjau.belumLengkap > 0 ? `, ${pratinjau.belumLengkap} di antaranya masih perlu dilengkapi` : ""}.
              {jumlah.sama > 0 && ` ${jumlah.sama} baris sama dengan data tercatat dan dilewati.`}
            </span>
            <span className="kol-kaki-tombol">
              <button
                type="button"
                className="dsb-tombol kol-kaki-kembali"
                data-jenis="garis"
                disabled={sibuk}
                onClick={() => setLangkah(1)}
              >
                ← Pratinjau berkas
              </button>
              <button type="button" className="dsb-tombol" disabled={sibuk || pilih.size === 0} onClick={() => void simpan()}>
                {sibuk ? "Menyimpan…" : `Simpan ${pilih.size} baris`}
              </button>
            </span>
          </div>
        </section>
      )}

      {/* ── Langkah 3: selesai ───────────────────────────────────── */}
      {langkah === 3 && hasilSimpan && (
        <section className="dsb-panel kol-panel ung-panel" aria-label="Selesai">
          <div className="ung-isi">
            <div className="ung-selesai">
              <span className="ung-selesai-ikon" aria-hidden="true">
                ✓
              </span>
              <div className="min-w-0">
                <h2>{hasilSimpan.disimpan} data pegawai tersimpan sebagai draf</h2>
                <p>
                  {hasilSimpan.baru} draf pegawai baru dan {hasilSimpan.perubahan} draf usulan perbaikan dari{" "}
                  {namaBerkas}. Belum ada yang terkirim ke Kanwil.
                </p>
              </div>
            </div>

            <dl className="ung-nilai ung-nilai-besar">
              <div>
                <dt>Masih perlu dilengkapi</dt>
                <dd>{hasilSimpan.belumLengkap}</dd>
              </div>
              <div>
                <dt>Dilewati karena sama</dt>
                <dd>{hasilSimpan.sama}</dd>
              </div>
              <div>
                <dt>Ditolak</dt>
                <dd>{hasilSimpan.ditolak}</dd>
              </div>
            </dl>

            {hasilSimpan.berubahSejakPratinjau > 0 && (
              <Catatan nada="amber">
                {hasilSimpan.berubahSejakPratinjau} baris yang Anda centang tidak jadi tersimpan, sebab keadaannya
                sudah berubah sejak pemeriksaan tadi, biasanya karena pegawainya baru saja diusulkan dari perangkat
                lain. Unggah ulang bagian itu untuk melihat keadaan terbarunya.
              </Catatan>
            )}

            {hasilSimpan.ditolak > 0 && (
              <Catatan nada="amber">
                {hasilSimpan.ditolak} baris ditolak dan tidak tersimpan. Betulkan baris itu di berkasnya, lalu unggah
                bagian itu saja.
              </Catatan>
            )}

            <p className="kgbm-bantuan">
              Drafnya terlihat di tiga tempat: tabel <strong>Pegawai Satker</strong> (baris bertanda, sampai Kanwil menyetujui),{" "}
              <strong>Perlu dikerjakan</strong> pada Dashboard, dan <strong>Usul KGB Kolektif</strong>. Langkah berikutnya: di Usul KGB
              Kolektif, saringan Pegawai baru, pilih pegawai yang akan dikirim (bisa
              bertahap), lengkapi data dan berkasnya, lalu ajukan bersama satu surat usulan Srikandi. Pegawai baru tidak
              ikut usulan KGB periode berjalan kecuali dipilih.
            </p>

            <div className="kol-kaki">
              <span />
              <span className="kol-kaki-tombol">
                <button type="button" className="dsb-tombol" data-jenis="garis" onClick={ulangDariAwal}>
                  Unggah berkas lain
                </button>
                <Link href="/dashboard/upt/pegawai" className="dsb-tombol" data-jenis="garis">
                  Pegawai Satker
                </Link>
                <Link href="/dashboard/upt/kolektif?saring=baru" className="dsb-tombol">
                  Lanjut ke Usul KGB Kolektif →
                </Link>
              </span>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
