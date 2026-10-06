"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { JENIS_KP } from "@/lib/kenaikanPangkat";
import { SARAN_PENETAP_SK } from "@/lib/penetapSk";
import { BATAS_BERKAS_USULAN_BYTE, PESAN_BERKAS_TERLALU_BESAR } from "@/lib/usulanPegawai";
import { formatTanggalId } from "@/lib/waktu";
import {
  kekuranganLaporSk,
  peringatanDampakKgb,
  pratayangLaporSk,
  teksMasaKerja,
  type IsianLaporSk,
  type JenisLaporSk,
} from "@/lib/laporSk";
import {
  ajukanLaporSk,
  berkasBelumAda,
  berkasDiminta,
  berkasTersedia,
  isianDariDraf,
  keadaanInduk,
  keadaanTercatat,
  simpanLaporSk,
} from "./laporSkKirim";
import type { DrafUsulanUpt, PegawaiUntukUsulan } from "./FormulirUsulan";

/* Lapor KP/PI/PMK massal untuk Admin UPT (ADR-074): beberapa pegawai naik pangkat atau menerima SK PMK pada periode
   yang sama, dilaporkan dalam satu halaman. Tiap pegawai satu kartu berisi isian SK, hasil hitungan, dan pindaian;
   pegawai tunggal hanyalah satu kartu. Yang tersimpan tetap usulan perbaikan yang sama dengan kartu Laporkan di menu
   tiga titik (lib/laporSk.ts dan laporSkKirim.ts dipakai bersama), dan laporan yang isinya murni SK berangkat tanpa
   surat usulan (ADR-046).

   Data UPT tidak boleh hilang: isian bersama (tanggal SK, TMT, penetap) hanya cadangan bagi kolom kartu yang kosong
   dan tidak pernah menimpa isian kartu; kartu yang gagal tetap utuh beserta pindaiannya; draf yang tersimpan
   dilanjutkan, bukan dibuat ganda; dan menutup halaman dengan isian yang belum disimpan ditanyakan dulu. */

interface PegawaiUpt {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
  tmtKgb: string | null;
  statusKGB: string | null;
  usulanBerjalan?: string | null;
  dataSekarang: Record<string, string>;
  bawaan?: PegawaiUntukUsulan["bawaan"];
  dasarKgb?: PegawaiUntukUsulan["dasarKgb"];
}

type DrafUpt = DrafUsulanUpt & { pegawaiId: string | null };

type Keadaan = "siap" | "mengirim" | "terkirim" | "draf" | "galat";

interface Baris {
  kunci: string;
  pegawai: PegawaiUpt;
  draf: DrafUpt | null;
  isian: IsianLaporSk;
  berkas: Record<string, File | null>;
  keadaan: Keadaan;
  pesan: string | null;
}

const LABEL_KEADAAN: Record<Keadaan, string> = {
  siap: "Belum dikirim",
  mengirim: "Mengirim…",
  terkirim: "Terkirim ke Kanwil",
  draf: "Tersimpan sebagai draf",
  galat: "Perlu diperiksa",
};

/** Kartu baru; laporan SK yang sudah tersimpan pada draf pegawai itu dipakai kembali sebagai isian awal. */
const kartuBaru = (p: PegawaiUpt, draf: DrafUpt | null, jenis: JenisLaporSk): Baris => ({
  kunci: p.id,
  pegawai: p,
  draf,
  isian: isianDariDraf(draf, jenis),
  berkas: {},
  keadaan: "siap",
  pesan: null,
});

const untukUsulan = (p: PegawaiUpt): PegawaiUntukUsulan => ({
  id: p.id,
  nama: p.nama,
  nip: p.nip,
  dataSekarang: p.dataSekarang,
  bawaan: p.bawaan,
  dasarKgb: p.dasarKgb,
  kgb: { status: p.statusKGB, tmt: p.tmtKgb },
});

/** Draf atau usulan dikembalikan yang masih dipegang UPT untuk pegawai ini. */
const drafPegawai = (daftar: readonly DrafUpt[], pegawaiId: string): DrafUpt | null =>
  daftar.find((u) => u.pegawaiId === pegawaiId && (u.status === "draf" || u.status === "revisi")) ?? null;

export default function LaporSkMassal() {
  const [pegawai, setPegawai] = useState<PegawaiUpt[]>([]);
  const [semuaDraf, setSemuaDraf] = useState<DrafUpt[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [umum, setUmum] = useState({ tanggalSk: "", tmt: "", penetap: "" });
  const [cari, setCari] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [ringkasan, setRingkasan] = useState<{ nada: "hijau" | "kuning"; teks: string } | null>(null);

  async function ambil(): Promise<{ pegawai: PegawaiUpt[]; draf: DrafUpt[] }> {
    const [rp, ru] = await Promise.all([fetch("/api/upt"), fetch("/api/upt/usulan")]);
    const dp = (await rp.json().catch(() => ({}))) as { pegawai?: PegawaiUpt[]; error?: string };
    const du = (await ru.json().catch(() => [])) as DrafUpt[];
    if (!rp.ok) throw new Error(dp.error ?? "Data pegawai gagal dimuat");
    return { pegawai: dp.pegawai ?? [], draf: Array.isArray(du) ? du : [] };
  }

  useEffect(() => {
    const t = setTimeout(() => {
      ambil()
        .then((d) => {
          setPegawai(d.pegawai);
          setSemuaDraf(d.draf);
          // Dibuka dari tautan dengan ?pegawai=<id>&jenis=kp|pmk: kartunya langsung tersedia.
          const q = new URLSearchParams(window.location.search);
          const id = q.get("pegawai");
          const p = id ? d.pegawai.find((x) => x.id === id) : null;
          if (p && p.usulanBerjalan !== "menunggu")
            setBaris([
              kartuBaru(p, drafPegawai(d.draf, p.id), q.get("jenis") === "pmk" ? "pmk" : "kp"),
            ]);
        })
        .catch((e: unknown) => setGalatMuat(e instanceof Error ? e.message : "Data gagal dimuat"))
        .finally(() => setMemuat(false));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Isian di halaman ini baru aman setelah disimpan; menutup atau memuat ulang halaman ditanyakan dulu.
  const adaBelumTersimpan = baris.some((b) => b.keadaan === "siap" || b.keadaan === "galat");
  useEffect(() => {
    if (!adaBelumTersimpan) return;
    const jaga = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", jaga);
    return () => window.removeEventListener("beforeunload", jaga);
  }, [adaBelumTersimpan]);

  const ubahBaris = (kunci: string, ubah: Partial<Baris> | ((b: Baris) => Partial<Baris>)) =>
    setBaris((lama) => lama.map((b) => (b.kunci === kunci ? { ...b, ...(typeof ubah === "function" ? ubah(b) : ubah) } : b)));
  const ubahIsian = (kunci: string, sebagian: Partial<IsianLaporSk>) =>
    ubahBaris(kunci, (b) => ({ isian: { ...b.isian, ...sebagian }, keadaan: b.keadaan === "terkirim" ? b.keadaan : "siap", pesan: null }));

  /** Isian kartu; kolom yang kosong memakai isian bersama di atas halaman. */
  const isianEfektif = (b: Baris): IsianLaporSk => ({
    ...b.isian,
    tanggalSk: b.isian.tanggalSk || umum.tanggalSk,
    tmt: b.isian.tmt || umum.tmt,
    penetap: b.isian.penetap || umum.penetap,
  });

  function nilai(b: Baris) {
    const isian = isianEfektif(b);
    const usulan = untukUsulan(b.pegawai);
    // Berkas ditagih menurut isian draf (yang juga diperiksa server), tetapi hitungan dan keterangan "tercatat" bertolak
    // dari data induk, seperti Kanwil saat menyetujui. Draf yang sudah memuat golongan baru bukan golongan lama.
    const tercatat = keadaanTercatat(usulan, b.draf);
    const induk = keadaanInduk(usulan, b.draf);
    const hitung = pratayangLaporSk(induk, isian);
    return {
      isian,
      usulan,
      tercatat,
      induk,
      hitung,
      galatHitung: hitung && !hitung.ok ? hitung.galat : null,
      kurang: kekuranganLaporSk(isian),
      belumBerkas: berkasBelumAda(usulan, b.draf, tercatat, isian.jenis, b.berkas),
      dampak: peringatanDampakKgb(b.pegawai.statusKGB, b.pegawai.tmtKgb),
    };
  }

  const q = cari.trim().toLowerCase();
  const sudahDipilih = useMemo(() => new Set(baris.map((b) => b.kunci)), [baris]);
  const calon = useMemo(
    () =>
      q
        ? pegawai
            .filter((p) => !sudahDipilih.has(p.id))
            .filter((p) => p.nama.toLowerCase().includes(q) || p.nip.includes(q) || p.jabatan.toLowerCase().includes(q))
            .slice(0, 8)
        : [],
    [pegawai, q, sudahDipilih],
  );

  function tambah(p: PegawaiUpt) {
    setBaris((lama) => [...lama, kartuBaru(p, drafPegawai(semuaDraf, p.id), "kp")]);
    setCari("");
    setRingkasan(null);
  }

  function pilihBerkas(kunci: string, medan: string, f: File | null) {
    if (f && f.type !== "application/pdf") return ubahBaris(kunci, { pesan: "Berkas harus PDF." });
    if (f && f.size > BATAS_BERKAS_USULAN_BYTE) return ubahBaris(kunci, { pesan: PESAN_BERKAS_TERLALU_BESAR });
    ubahBaris(kunci, (b) => ({ berkas: { ...b.berkas, [medan]: f }, keadaan: b.keadaan === "terkirim" ? b.keadaan : "siap", pesan: null }));
  }

  /**
   * Simpan semua kartu yang lengkap sebagai draf, dan bila `langsung` sekalian ajukan. Kartu dikerjakan satu per satu
   * dan tiap kegagalan terisolasi: kartu lain tetap diproses, dan kartu yang gagal tetap utuh beserta pindaiannya.
   */
  async function proses(langsung: boolean) {
    setMengirim(true);
    setRingkasan(null);
    let terkirim = 0;
    let tersimpan = 0;
    let dilewati = 0;
    let gagal = 0;
    for (const b of baris.filter((x) => x.keadaan !== "terkirim")) {
      const n = nilai(b);
      const kurang = [...n.kurang, ...(n.galatHitung ? [n.galatHitung] : [])];
      if (kurang.length > 0 || (langsung && n.belumBerkas.length > 0)) {
        ubahBaris(b.kunci, {
          keadaan: "galat",
          pesan:
            kurang.length > 0
              ? `Belum lengkap: ${kurang.join(", ")}.`
              : `Belum dapat dikirim sebelum ${n.belumBerkas.map((x) => x.label).join(" dan ")} dilampirkan. Isiannya dapat disimpan sebagai draf.`,
        });
        dilewati += 1;
        continue;
      }
      ubahBaris(b.kunci, { keadaan: "mengirim", pesan: null });
      const simpan = await simpanLaporSk({ pegawai: n.usulan, draf: b.draf, isian: n.isian, berkas: b.berkas });
      if (!simpan.ok) {
        ubahBaris(b.kunci, { keadaan: "galat", pesan: simpan.galat });
        gagal += 1;
        continue;
      }
      // Draf yang baru terbentuk dicatat pada kartu, supaya percobaan ulang memperbaruinya dan tidak membuat draf kedua.
      const drafKartu: DrafUpt =
        b.draf ?? { id: simpan.id, pegawaiId: b.pegawai.id, jenis: "perubahan", nama: b.pegawai.nama, nip: b.pegawai.nip, status: "draf", nilai: null, surat: null, hukdis: null, dasarBaru: null, berkas: [] };
      if (!langsung) {
        ubahBaris(b.kunci, { draf: drafKartu, keadaan: "draf", pesan: "Tersimpan. Kirim ke Kanwil bila berkasnya sudah lengkap." });
        tersimpan += 1;
        continue;
      }
      const ajukan = await ajukanLaporSk(simpan.id);
      if (!ajukan.ok) {
        ubahBaris(b.kunci, { draf: drafKartu, keadaan: "draf", pesan: ajukan.galat });
        gagal += 1;
        continue;
      }
      ubahBaris(b.kunci, { draf: drafKartu, keadaan: "terkirim", pesan: null });
      terkirim += 1;
    }
    // Keadaan terbaru dari server: pegawai yang baru diajukan tidak lagi ditawarkan, dan draf terbaru dipakai ulang.
    try {
      const d = await ambil();
      setPegawai(d.pegawai);
      setSemuaDraf(d.draf);
      setBaris((lama) => lama.map((b) => (b.keadaan === "terkirim" ? b : { ...b, draf: drafPegawai(d.draf, b.kunci) ?? b.draf })));
    } catch {
      // Hasil kirim sudah tercatat di kartu; muat ulang keadaan hanya penyempurna.
    }
    const bagian = [
      terkirim > 0 ? `${terkirim} laporan terkirim ke Kanwil` : null,
      tersimpan > 0 ? `${tersimpan} tersimpan sebagai draf` : null,
      dilewati > 0 ? `${dilewati} belum lengkap dan tidak diproses` : null,
      gagal > 0 ? `${gagal} gagal; isiannya tetap ada` : null,
    ].filter(Boolean);
    setRingkasan({
      nada: dilewati + gagal > 0 ? "kuning" : "hijau",
      teks: `${bagian.join(", ") || "Tidak ada yang diproses"}. Pantau hasilnya di Pegawai Satker atau Riwayat.`,
    });
    setMengirim(false);
  }

  const aktif = baris.filter((b) => b.keadaan !== "terkirim");
  const lengkap = aktif.filter((b) => {
    const n = nilai(b);
    return n.kurang.length === 0 && !n.galatHitung;
  }).length;
  const siapKirim = aktif.filter((b) => {
    const n = nilai(b);
    return n.kurang.length === 0 && !n.galatHitung && n.belumBerkas.length === 0;
  }).length;

  return (
    <div className="dsb-halaman kol">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Pegawai Satker</p>
          <h1 className="dsb-halaman-judul">Lapor KP/PI/PMK</h1>
          <p className="dsb-sub">
            Laporkan SK kenaikan pangkat, penyesuaian ijazah, atau peninjauan masa kerja untuk beberapa pegawai sekaligus.
            Tiap pegawai satu kartu: isi SK-nya, periksa hasil hitungannya, lampirkan pindaian, lalu kirim semuanya.
            Laporan SK tidak memerlukan surat usulan Srikandi.
          </p>
        </div>
        <Link href="/dashboard/upt/pegawai" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">← Pegawai Satker</Link>
      </header>

      {ringkasan && (
        <div role="status" className="dsb-pesan" data-nada={ringkasan.nada === "hijau" ? "hijau" : "kuning"}>
          <span className="dsb-pesan-ikon" aria-hidden="true">{ringkasan.nada === "hijau" ? "✓" : "!"}</span>
          <p>{ringkasan.teks}</p>
        </div>
      )}
      {galatMuat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galatMuat}</p>
        </div>
      )}

      <section className="dsb-panel lsk-panel dsb-muncul" aria-label="Pilih pegawai">
        <div className="lsk-alat">
          <label className="kol-label lsk-cari">
            <span>Tambah pegawai ke laporan</span>
            <input
              type="search"
              className="kol-isi"
              placeholder={memuat ? "Memuat pegawai…" : "Ketik nama, NIP, atau jabatan"}
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              disabled={memuat}
              aria-controls="lsk-calon"
            />
          </label>
          <div className="lsk-umum">
            <p className="kol-catatan-kecil">
              Isian bersama, dipakai bagi kartu yang kolom tersebut masih kosong. Tidak menimpa isian kartu.
            </p>
            <div className="lsk-kisi">
              <label className="kol-label">
                <span>Tanggal SK</span>
                <input className="kol-isi" type="date" value={umum.tanggalSk} onChange={(e) => setUmum((u) => ({ ...u, tanggalSk: e.target.value }))} />
              </label>
              <label className="kol-label">
                <span>TMT</span>
                <input className="kol-isi" type="date" value={umum.tmt} onChange={(e) => setUmum((u) => ({ ...u, tmt: e.target.value }))} />
              </label>
              <label className="kol-label">
                <span>Ditetapkan oleh</span>
                <input
                  className="kol-isi"
                  list="lsk-saran-penetap"
                  value={umum.penetap}
                  onChange={(e) => setUmum((u) => ({ ...u, penetap: e.target.value }))}
                  placeholder="Pejabat penanda tangan SK"
                />
              </label>
            </div>
            <datalist id="lsk-saran-penetap">
              {SARAN_PENETAP_SK.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
        {q && (
          <ul id="lsk-calon" className="lsk-calon" aria-label="Hasil pencarian pegawai">
            {calon.length === 0 ? (
              <li className="lsk-kosong">Tidak ada pegawai yang cocok, atau pegawainya sudah ada di laporan ini.</li>
            ) : (
              calon.map((p) => {
                const ditinjau = p.usulanBerjalan === "menunggu";
                return (
                  <li key={p.id}>
                    <button type="button" disabled={ditinjau} onClick={() => tambah(p)}>
                      <span>
                        <strong>{p.nama}</strong>
                        <small>{p.nip} · {p.golonganRuang} · {p.jabatan}</small>
                      </span>
                      <em>
                        {ditinjau
                          ? "Sedang ditinjau Kanwil"
                          : p.usulanBerjalan === "draf"
                            ? "Ada draf; dilanjutkan"
                            : p.usulanBerjalan === "revisi"
                              ? "Dikembalikan; diperbaiki"
                              : "Tambahkan"}
                      </em>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </section>

      {baris.length === 0 ? (
        <p className="dsb-kosong lsk-kosong-besar">
          {memuat ? "Memuat pegawai…" : "Belum ada pegawai di laporan ini. Cari nama pegawai di atas untuk menambahkannya."}
        </p>
      ) : (
        <ul className="lsk-daftar" aria-label="Pegawai yang dilaporkan">
          {baris.map((b) => {
            const n = nilai(b);
            const terkunci = b.keadaan === "terkirim" || b.keadaan === "mengirim";
            const medanDilaporkan = n.isian.jenis === "kp" ? "skPangkat" : "skPmk";
            return (
              <li key={b.kunci} className="lsk-baris dsb-muncul" data-keadaan={b.keadaan}>
                <div className="lsk-kepala">
                  <div className="min-w-0">
                    <strong>{b.pegawai.nama}</strong>
                    <small>
                      {b.pegawai.nip} · {n.induk.golongan} · {teksMasaKerja(n.induk.mkgTahun, n.induk.mkgBulan)}
                      {n.induk.tmtKgbTerakhir ? ` · TMT KGB terakhir ${formatTanggalId(n.induk.tmtKgbTerakhir)}` : ""}
                    </small>
                  </div>
                  <span className="lsk-kanan">
                    <span className="dsb-tag" data-garis="" data-nada={b.keadaan === "terkirim" ? "hijau" : b.keadaan === "galat" ? "merah" : b.keadaan === "draf" ? "biru" : undefined}>
                      {LABEL_KEADAAN[b.keadaan]}
                    </span>
                    {!terkunci && (
                      <button
                        type="button"
                        className="dsb-tombol dsb-tombol-kecil"
                        data-jenis="garis"
                        onClick={() => setBaris((lama) => lama.filter((x) => x.kunci !== b.kunci))}
                        aria-label={`Keluarkan ${b.pegawai.nama} dari laporan`}
                      >
                        Keluarkan
                      </button>
                    )}
                  </span>
                </div>

                {b.keadaan === "terkirim" ? (
                  <p className="lsk-selesai">
                    {n.isian.jenis === "kp" ? "Kenaikan pangkat" : "Peninjauan masa kerja"} SK {n.isian.nomorSk} terkirim ke Kanwil beserta pindaiannya.
                  </p>
                ) : (
                  <div className="lsk-isi">
                    {n.dampak && (
                      <p className="lsk-dampak" data-nada={n.dampak.nada}>
                        <strong>{n.dampak.nada === "merah" ? "Laporan akan tertahan. " : "Perhatikan. "}</strong>
                        {n.dampak.teks}
                      </p>
                    )}
                    {b.draf && (
                      <p className="kol-catatan-kecil">
                        Pegawai ini sudah punya {b.draf.status === "revisi" ? "usulan yang dikembalikan Kanwil" : "draf usulan"}; isinya dilanjutkan dan
                        tidak dibuat ganda. Isian lainnya pada draf itu tidak diubah.
                      </p>
                    )}
                    <div className="lsk-kisi">
                      <label className="kol-label">
                        <span className="kol-wajib">Jenis SK</span>
                        <select
                          className="kol-isi"
                          value={n.isian.jenis}
                          disabled={terkunci}
                          onChange={(e) => ubahIsian(b.kunci, { jenis: e.target.value === "pmk" ? "pmk" : "kp" })}
                        >
                          <option value="kp">Kenaikan pangkat atau PI</option>
                          <option value="pmk">Peninjauan masa kerja (PMK)</option>
                        </select>
                      </label>
                      {n.isian.jenis === "kp" ? (
                        <>
                          <label className="kol-label">
                            <span className="kol-wajib">Jenis kenaikan pangkat</span>
                            <select className="kol-isi" value={n.isian.jenisKp} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { jenisKp: e.target.value })}>
                              {Object.entries(JENIS_KP).map(([k, l]) => (
                                <option key={k} value={k}>{l}</option>
                              ))}
                            </select>
                          </label>
                          <label className="kol-label">
                            <span className="kol-wajib">Golongan baru menurut SK</span>
                            <select className="kol-isi" value={n.isian.golonganBaru} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { golonganBaru: e.target.value })}>
                              <option value="">Pilih golongan</option>
                              {Object.entries(GOLONGAN_PANGKAT).map(([g, p]) => (
                                <option key={g} value={g}>{g} · {p}</option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : (
                        <div className="kol-label">
                          <span className="kol-wajib">Masa kerja pada SK</span>
                          <span className="kol-mkg">
                            <input className="kol-isi" inputMode="numeric" aria-label="Tahun" value={n.isian.mkgTahunSk} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { mkgTahunSk: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                            <span>tahun</span>
                            <input className="kol-isi" inputMode="numeric" aria-label="Bulan" value={n.isian.mkgBulanSk} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { mkgBulanSk: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                            <span>bulan</span>
                          </span>
                        </div>
                      )}
                      <label className="kol-label">
                        <span className="kol-wajib">Nomor SK</span>
                        <input className="kol-isi" value={b.isian.nomorSk} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { nomorSk: e.target.value })} placeholder="Sesuai SK" />
                      </label>
                      <label className="kol-label">
                        <span className="kol-wajib">Tanggal SK</span>
                        <input className="kol-isi" type="date" value={b.isian.tanggalSk || umum.tanggalSk} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { tanggalSk: e.target.value })} />
                      </label>
                      <label className="kol-label">
                        <span className="kol-wajib">{n.isian.jenis === "kp" ? "TMT pangkat" : "TMT PMK"}</span>
                        <input className="kol-isi" type="date" value={b.isian.tmt || umum.tmt} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { tmt: e.target.value })} />
                      </label>
                      <label className="kol-label">
                        <span>Ditetapkan oleh</span>
                        <input className="kol-isi" list="lsk-saran-penetap" value={b.isian.penetap || umum.penetap} disabled={terkunci} onChange={(e) => ubahIsian(b.kunci, { penetap: e.target.value })} placeholder="Pejabat penanda tangan SK" />
                      </label>
                    </div>

                    {n.galatHitung ? (
                      <p className="lsk-dampak" data-nada="kuning">{n.galatHitung}</p>
                    ) : (
                      n.hitung?.ok && (
                        <div className="kol-hitung">
                          {n.hitung.baris.map(([label, nilaiBaris]) => (
                            <div key={label}>
                              <span>{label}</span>
                              <strong>{nilaiBaris}</strong>
                            </div>
                          ))}
                          <p data-ket="">{n.hitung.catatan}</p>
                        </div>
                      )
                    )}

                    <div className="lsk-kisi">
                      {berkasDiminta(n.tercatat, n.isian.jenis)
                        .filter((x) => x.wajib)
                        .map((x) => {
                          const ada = berkasTersedia(n.usulan, b.draf, x.medan);
                          const dipilih = b.berkas[x.medan] ?? null;
                          const sudahAda = ada.draf ?? ada.bawaan;
                          return (
                            <label key={x.medan} className="kol-label">
                              <span className={sudahAda || dipilih ? undefined : "kol-wajib"}>{x.label}</span>
                              <input
                                className="kol-isi"
                                type="file"
                                accept="application/pdf"
                                disabled={terkunci}
                                onChange={(e) => pilihBerkas(b.kunci, x.medan, e.target.files?.[0] ?? null)}
                              />
                              <span className="kol-catatan-kecil">
                                {dipilih
                                  ? `Dipilih: ${dipilih.name}`
                                  : sudahAda
                                    ? x.medan === medanDilaporkan && ada.bawaan && !ada.draf
                                      ? "Terlampir masih SK dari usulan sebelumnya. Bila SK yang Anda laporkan berbeda, pilih berkas baru."
                                      : `Sudah ada: ${sudahAda.nama ?? x.label}. Pilih berkas baru untuk menggantinya.`
                                    : "PDF, paling besar 500 KB."}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                    {b.pesan && (
                      <p className="lsk-pesan" data-nada={b.keadaan === "galat" ? "merah" : undefined} role={b.keadaan === "galat" ? "alert" : undefined}>
                        {b.pesan}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="kol-kaki lsk-kaki">
        <span>
          <strong>{baris.length}</strong> pegawai · <strong>{lengkap}</strong> isiannya lengkap · <strong>{siapKirim}</strong> siap dikirim.
          {adaBelumTersimpan ? " Isian belum tersimpan sebelum Anda menekan Simpan atau Kirim." : ""}
        </span>
        <span className="kol-kaki-tombol">
          <button type="button" className="dsb-tombol" data-jenis="garis" disabled={mengirim || aktif.length === 0} onClick={() => void proses(false)}>
            Simpan semua sebagai draf
          </button>
          <button type="button" className="dsb-tombol" disabled={mengirim || aktif.length === 0} onClick={() => void proses(true)}>
            {mengirim ? "Mengirim…" : `Kirim ${siapKirim > 0 ? siapKirim : "semua"} ke Kanwil`}
          </button>
        </span>
      </div>
    </div>
  );
}
