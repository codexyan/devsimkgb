"use client";

import { useCallback, useEffect, useState } from "react";
import ModalKenaikanPangkat from "@/app/dashboard/components/ModalKenaikanPangkat";
import ModalPmk from "@/app/dashboard/components/ModalPmk";
import { ModalPratinjauBerkas } from "@/app/dashboard/components/kgb";
import {
  BATAS_DOKUMEN_BYTE,
  JENIS_DOKUMEN,
  LABEL_SUMBER_DOKUMEN,
  type DokumenPegawai,
  type JenisDokumen,
  type SumberDokumen,
} from "@/lib/dokumenPegawai";
import {
  LABEL_TINDAK_LANJUT,
  isoTanggal,
  type BarisBanding,
  type StatusTindakLanjut,
} from "@/lib/pemutakhiranPegawai";
import type { KirimanInventaris } from "@/lib/inventarisServer";
import { LABEL_KEADAAN } from "@/lib/inventarisKgb";
import { formatTanggalId } from "@/lib/waktu";

/* Tab "Dokumen & Pemutakhiran" di halaman pegawai (ADR-023): kiriman formulir pemutakhiran data dibandingkan dengan
   Data Pegawai, status tindak lanjutnya, penerapan isian yang berbeda, dan semua dokumen pegawai (arsip unggahan,
   SK KGB, berkas usulan UPT, berkas formulir) yang dapat dipratinjau di halaman. Golongan dan masa kerja diterapkan
   lewat Catat kenaikan pangkat atau PMK, supaya riwayat dan jadwal KGB tetap konsisten. */

interface PegawaiLengkap {
  id: string;
  nip: string;
  nama: string;
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbTerakhir: string | null;
  tmtKgbBerikutnya: string | null;
  [kolom: string]: unknown;
}

interface Pemutakhiran {
  kegiatan: { id: string; nama: string };
  kiriman: KirimanInventaris;
  banding: BarisBanding[];
  peringatan: string[];
}

/** Kolom yang dikirim ulang pada PATCH /api/pegawai/[id], yang mengganti seluruh isian Data Pegawai. */
const KOLOM_PATCH = [
  "nama", "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir", "jabatan", "pangkat", "golonganRuang",
  "unitKerja", "eselon", "jenisJabatan", "tmtGolongan", "mkgTahun", "mkgBulan", "gajiPokok", "tmtKgbTerakhir",
  "tmtKgbBerikutnya", "nomorSkDasar", "tanggalSkDasar", "penetapSkDasar",
] as const;
const KOLOM_TANGGAL = new Set(["tanggalLahir", "tmtGolongan", "tmtKgbTerakhir", "tmtKgbBerikutnya", "tanggalSkDasar"]);

const NADA_STATUS: Record<StatusTindakLanjut, string> = {
  belum_diperiksa: "kuning",
  sesuai: "hijau",
  perlu_perbaikan: "merah",
  diterapkan: "biru",
};

const ukuranTeks = (b: number | null) =>
  b === null ? "" : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const tanggalTeks = (v: string) => (v ? formatTanggalId(v) : "");

export default function TabDokumenPemutakhiran({
  pegawaiId,
  bolehUbah,
  onDataBerubah,
}: {
  pegawaiId: string;
  /** Peran yang boleh mengubah Data Pegawai dan mencatat kenaikan pangkat atau PMK. */
  bolehUbah: boolean;
  onDataBerubah: () => void;
}) {
  const [pegawai, setPegawai] = useState<PegawaiLengkap | null>(null);
  const [daftar, setDaftar] = useState<Pemutakhiran[] | null>(null);
  const [dokumen, setDokumen] = useState<DokumenPegawai[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<DokumenPegawai | null>(null);
  const [modal, setModal] = useState<{ jenis: "kp" | "pmk"; p: Pemutakhiran } | null>(null);

  const muat = useCallback(async () => {
    try {
      const [rp, rm, rd] = await Promise.all([
        fetch(`/api/pegawai/${pegawaiId}`, { cache: "no-store" }),
        fetch(`/api/pegawai/${pegawaiId}/pemutakhiran`, { cache: "no-store" }),
        fetch(`/api/pegawai/${pegawaiId}/dokumen`, { cache: "no-store" }),
      ]);
      if (!rp.ok || !rm.ok || !rd.ok) throw new Error("Dokumen dan pemutakhiran gagal dimuat.");
      setPegawai((await rp.json()) as PegawaiLengkap);
      setDaftar((await rm.json()) as Pemutakhiran[]);
      setDokumen((await rd.json()) as DokumenPegawai[]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Dokumen dan pemutakhiran gagal dimuat.");
    }
  }, [pegawaiId]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  function berhasil(teks: string) {
    setGalat(null);
    setPesan(teks);
    onDataBerubah();
    void muat();
  }

  return (
    <div className="flex flex-col gap-4">
      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
        </div>
      )}
      {pesan && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{pesan}</p>
        </div>
      )}

      <section className="dsb-panel" aria-labelledby="judul-pemutakhiran">
        <div className="dsb-panel-kepala">
          <h2 id="judul-pemutakhiran" className="dsb-panel-judul">
            Pemutakhiran data <small>dari formulir inventarisasi</small>
          </h2>
        </div>
        {!daftar || !pegawai ? (
          <p className="dsb-kosong">Memuat…</p>
        ) : daftar.length === 0 ? (
          <p className="dsb-kosong">
            Pegawai ini belum mengirim formulir pemutakhiran data. Kiriman dari formulir inventarisasi KGB akan tampil di
            sini untuk dicocokkan dengan Data Pegawai.
          </p>
        ) : (
          daftar.map((p) => (
            <KartuKiriman
              // Disusun ulang setiap kiriman atau tindak lanjutnya berubah, supaya isian status mengikuti yang tersimpan.
              key={`${p.kegiatan.id}-${p.kiriman.waktu}-${p.kiriman.tindakLanjut?.at ?? ""}`}
              p={p}
              pegawai={pegawai}
              bolehUbah={bolehUbah}
              onGalat={setGalat}
              onBerhasil={berhasil}
              onCatat={(jenis) => setModal({ jenis, p })}
            />
          ))
        )}
      </section>

      <BagianDokumen
        pegawaiId={pegawaiId}
        dokumen={dokumen}
        onLihat={setPratinjau}
        onGalat={setGalat}
        onBerhasil={berhasil}
      />

      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={[pratinjau.nomorSK, tanggalTeks(pratinjau.tanggal), LABEL_SUMBER_DOKUMEN[pratinjau.sumber]].filter(Boolean).join(" · ")}
          url={pratinjau.url}
          onTutup={() => setPratinjau(null)}
        />
      )}

      {modal && pegawai && modal.jenis === "kp" && (
        <ModalKenaikanPangkat
          pegawai={pegawai}
          awal={{
            golonganBaru: modal.p.kiriman.isian.golonganRuang !== pegawai.golonganRuang ? modal.p.kiriman.isian.golonganRuang : "",
            tanggalSK: modal.p.kiriman.isian.keadaan === "pernah" ? modal.p.kiriman.isian.tanggalSkPendukung : "",
            tmtPangkat: modal.p.kiriman.isian.tmtGolongan,
          }}
          onTutup={() => setModal(null)}
          onBerhasil={(teks) => {
            setModal(null);
            berhasil(teks);
          }}
        />
      )}
      {modal && pegawai && modal.jenis === "pmk" && (
        <ModalPmk
          pegawai={pegawai}
          awal={{
            tanggalSK: modal.p.kiriman.isian.tanggalSkPmk,
            tmtPmk: modal.p.kiriman.isian.tmtPmk,
            mkgTahunSk: modal.p.kiriman.isian.mkgTahun,
            mkgBulanSk: modal.p.kiriman.isian.mkgBulan,
          }}
          onTutup={() => setModal(null)}
          onBerhasil={(teks) => {
            setModal(null);
            berhasil(teks);
          }}
        />
      )}
    </div>
  );
}

function KartuKiriman({
  p,
  pegawai,
  bolehUbah,
  onGalat,
  onBerhasil,
  onCatat,
}: {
  p: Pemutakhiran;
  pegawai: PegawaiLengkap;
  bolehUbah: boolean;
  onGalat: (g: string | null) => void;
  onBerhasil: (teks: string) => void;
  onCatat: (jenis: "kp" | "pmk") => void;
}) {
  const { kiriman, kegiatan, banding, peringatan } = p;
  const isian = kiriman.isian;
  const status: StatusTindakLanjut = kiriman.tindakLanjut?.status ?? "belum_diperiksa";
  const [semua, setSemua] = useState(false);
  const [pilih, setPilih] = useState<Set<string>>(() => new Set());
  const [statusBaru, setStatusBaru] = useState<StatusTindakLanjut>(status === "belum_diperiksa" ? "sesuai" : status);
  const [catatan, setCatatan] = useState(kiriman.tindakLanjut?.catatan ?? "");
  const [sibuk, setSibuk] = useState(false);

  const beda = banding.filter((b) => b.beda);
  const tampil = semua ? banding : beda;
  const langsung = beda.filter((b) => b.jalur === "langsung" && b.kolom);
  const adaKp = beda.some((b) => b.jalur === "kp");
  const adaPmk = beda.some((b) => b.jalur === "pmk");

  async function catatStatus(s: StatusTindakLanjut, teks: string) {
    const res = await fetch("/api/inventarisasi/tindak-lanjut", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kegiatan: kegiatan.id, nip: isian.nip, status: s, catatan: teks }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(d.error ?? "Status tindak lanjut gagal disimpan.");
  }

  async function simpanStatus() {
    setSibuk(true);
    onGalat(null);
    try {
      await catatStatus(statusBaru, catatan);
      onBerhasil(`Kiriman ${kegiatan.nama} ditandai: ${LABEL_TINDAK_LANJUT[statusBaru]}.`);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Status tindak lanjut gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function terapkan() {
    const dipilih = langsung.filter((b) => pilih.has(b.kunci));
    if (dipilih.length === 0) return;
    if (!window.confirm(`Terapkan ${dipilih.length} isian dari kiriman ke Data Pegawai ${pegawai.nama}?`)) return;
    setSibuk(true);
    onGalat(null);
    try {
      // PATCH mengganti seluruh isian, jadi nilai tersimpan dikirim ulang dan hanya kolom terpilih yang diganti.
      const badan: Record<string, unknown> = {};
      for (const k of KOLOM_PATCH) {
        const v = pegawai[k];
        badan[k] = KOLOM_TANGGAL.has(k) ? isoTanggal(v as string | null) : (v ?? "");
      }
      for (const b of dipilih) badan[b.kolom!] = b.nilaiBaru ?? "";
      const res = await fetch(`/api/pegawai/${pegawai.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Data Pegawai gagal diperbarui.");
      const label = dipilih.map((b) => b.label.toLowerCase()).join(", ");
      const sisa = beda.length - dipilih.length;
      await catatStatus(sisa === 0 ? "diterapkan" : status === "belum_diperiksa" ? "perlu_perbaikan" : status, `Diterapkan: ${label}.${sisa > 0 ? ` ${sisa} isian lain belum.` : ""}`).catch(() => {});
      setPilih(new Set());
      onBerhasil(`Data Pegawai diperbarui dari kiriman: ${label}.`);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Data Pegawai gagal diperbarui.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <article className="pmh-kartu">
      <header className="pmh-kepala">
        <div className="min-w-0">
          <p className="pmh-judul">{kegiatan.nama}</p>
          <p className="dsb-kecil" style={{ margin: 0 }}>
            Dikirim {formatTanggalId(kiriman.waktu, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {kiriman.kirimanKe > 1 ? ` · kiriman ke-${kiriman.kirimanKe}` : ""} · {LABEL_KEADAAN[isian.keadaan]}
          </p>
        </div>
        <span className="dsb-tag" data-nada={NADA_STATUS[status]}>{LABEL_TINDAK_LANJUT[status]}</span>
      </header>

      {kiriman.tindakLanjut && (
        <p className="dsb-kecil pmh-riwayat">
          {LABEL_TINDAK_LANJUT[kiriman.tindakLanjut.status]} oleh {kiriman.tindakLanjut.oleh},{" "}
          {formatTanggalId(kiriman.tindakLanjut.at)}{kiriman.tindakLanjut.catatan ? `: ${kiriman.tindakLanjut.catatan}` : ""}
        </p>
      )}

      {peringatan.map((w) => (
        <p key={w} className="pmh-peringatan">{w}</p>
      ))}

      <div className="pmh-ringkas">
        <span><strong>{beda.length}</strong> isian berbeda dari SIM-KGB</span>
        <label className="inv-cek">
          <input type="checkbox" className="dsb-cek" checked={semua} onChange={(e) => setSemua(e.target.checked)} />
          Tampilkan juga yang sama
        </label>
      </div>

      {tampil.length === 0 ? (
        <p className="dsb-kosong">Semua isian yang dibandingkan sama dengan Data Pegawai.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="dsb-tabel pmh-tabel">
            <thead>
              <tr>
                <th scope="col">Isian</th>
                <th scope="col">SIM-KGB</th>
                <th scope="col">Kiriman</th>
                <th scope="col">Tindak lanjut</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((b) => (
                <tr key={b.kunci} data-beda={b.beda ? "" : undefined}>
                  <th scope="row">{b.label}</th>
                  <td>{/^\d{4}-\d{2}-\d{2}$/.test(b.simKgb) ? tanggalTeks(b.simKgb) : b.simKgb || "-"}</td>
                  <td className={b.beda ? "pmh-baru" : undefined}>
                    {/^\d{4}-\d{2}-\d{2}$/.test(b.kiriman) ? tanggalTeks(b.kiriman) : b.kiriman || "-"}
                  </td>
                  <td className="dsb-kecil">
                    {!b.beda ? (
                      "Sama"
                    ) : b.jalur === "langsung" && bolehUbah ? (
                      <label className="inv-cek">
                        <input
                          type="checkbox"
                          className="dsb-cek"
                          checked={pilih.has(b.kunci)}
                          onChange={(e) =>
                            setPilih((s) => {
                              const baru = new Set(s);
                              if (e.target.checked) baru.add(b.kunci);
                              else baru.delete(b.kunci);
                              return baru;
                            })
                          }
                        />
                        Terapkan
                      </label>
                    ) : (
                      b.catatan ?? "Periksa"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="pmh-lain">
        {isian.keadaan === "pernah" && (
          <div>
            <dt>Setelah KGB terakhir</dt>
            <dd>
              {isian.naikSetelahKgb === "ya" && isian.pmkSetelahKgb === "ya"
                ? "Kenaikan pangkat/PI dan PMK"
                : isian.naikSetelahKgb === "ya"
                  ? "Kenaikan pangkat/PI"
                  : isian.pmkSetelahKgb === "ya"
                    ? `PMK, TMT ${tanggalTeks(isian.tmtPmk)}`
                    : isian.naikSetelahKgb === "tidak"
                      ? "Tidak ada"
                      : "Tidak ditanyakan (kiriman lama)"}
            </dd>
          </div>
        )}
        <div>
          <dt>{isian.keadaan === "pernah" ? "SK KGB terakhir" : "SK CPNS"}</dt>
          <dd>{[isian.nomorSkDasar, tanggalTeks(isian.tanggalSkDasar)].filter(Boolean).join(" · ") || "-"}</dd>
        </div>
        {isian.bidang && (
          <div>
            <dt>Bidang/Bagian</dt>
            <dd>{isian.bidang}</dd>
          </div>
        )}
        {isian.nomorWa && (
          <div>
            <dt>WhatsApp</dt>
            <dd><a href={`https://wa.me/${isian.nomorWa.replace(/^0/, "62").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{isian.nomorWa}</a></dd>
          </div>
        )}
        {isian.catatan && (
          <div>
            <dt>Catatan pegawai</dt>
            <dd>{isian.catatan}</dd>
          </div>
        )}
      </dl>

      {bolehUbah && (adaKp || adaPmk || langsung.length > 0) && (
        <div className="pmh-aksi">
          {langsung.length > 0 && (
            <button type="button" className="dsb-tombol" disabled={sibuk || pilih.size === 0} onClick={() => void terapkan()}>
              Terapkan {pilih.size > 0 ? pilih.size : ""} isian ke Data Pegawai
            </button>
          )}
          {adaKp && (
            <button type="button" className="dsb-tombol" data-jenis="garis" disabled={sibuk} onClick={() => onCatat("kp")}>
              Catat kenaikan pangkat…
            </button>
          )}
          {adaPmk && (
            <button type="button" className="dsb-tombol" data-jenis="garis" disabled={sibuk} onClick={() => onCatat("pmk")}>
              Catat PMK…
            </button>
          )}
        </div>
      )}

      <div className="pmh-status">
        <label className="inv-bidang">
          <span>Status tindak lanjut</span>
          <select className="dsb-cari" value={statusBaru} onChange={(e) => setStatusBaru(e.target.value as StatusTindakLanjut)}>
            {(Object.keys(LABEL_TINDAK_LANJUT) as StatusTindakLanjut[]).map((s) => (
              <option key={s} value={s}>{LABEL_TINDAK_LANJUT[s]}</option>
            ))}
          </select>
        </label>
        <label className="inv-bidang pmh-catatan">
          <span>Catatan {statusBaru === "perlu_perbaikan" ? "(wajib)" : "(opsional)"}</span>
          <input className="dsb-cari" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. MKG masih golongan II; minta pegawai mengirim ulang" />
        </label>
        <button type="button" className="dsb-tombol" data-jenis="garis" disabled={sibuk} onClick={() => void simpanStatus()}>
          Simpan status
        </button>
      </div>
    </article>
  );
}

const URUTAN_SUMBER: SumberDokumen[] = ["arsip", "sk_kgb", "inventaris", "usulan"];

function BagianDokumen({
  pegawaiId,
  dokumen,
  onLihat,
  onGalat,
  onBerhasil,
}: {
  pegawaiId: string;
  dokumen: DokumenPegawai[] | null;
  onLihat: (d: DokumenPegawai) => void;
  onGalat: (g: string | null) => void;
  onBerhasil: (teks: string) => void;
}) {
  const [jenis, setJenis] = useState<JenisDokumen>("sk_pangkat");
  const [nomorSK, setNomorSK] = useState("");
  const [tanggalSK, setTanggalSK] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kunciInput, setKunciInput] = useState(0);

  async function unggah() {
    if (!berkas) return;
    if (berkas.size > BATAS_DOKUMEN_BYTE) {
      onGalat("Ukuran dokumen paling besar 5 MB.");
      return;
    }
    setSibuk(true);
    onGalat(null);
    try {
      const form = new FormData();
      form.set("jenis", jenis);
      form.set("nomorSK", nomorSK);
      form.set("tanggalSK", tanggalSK);
      form.set("keterangan", keterangan);
      form.set("berkas", berkas);
      const res = await fetch(`/api/pegawai/${pegawaiId}/dokumen`, { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Dokumen gagal diunggah.");
      setNomorSK("");
      setTanggalSK("");
      setKeterangan("");
      setBerkas(null);
      setKunciInput((k) => k + 1);
      onBerhasil(`${JENIS_DOKUMEN[jenis]} diunggah ke arsip dokumen pegawai.`);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Dokumen gagal diunggah.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(d: DokumenPegawai) {
    if (!window.confirm(`Hapus ${d.judul}${d.nomorSK ? ` ${d.nomorSK}` : ""} dari arsip dokumen?`)) return;
    const res = await fetch(`/api/pegawai/${pegawaiId}/dokumen/${encodeURIComponent(d.id.replace(/^arsip-/, ""))}`, { method: "DELETE" });
    if (res.ok) onBerhasil(`${d.judul} dihapus dari arsip dokumen.`);
    else onGalat("Dokumen gagal dihapus.");
  }

  const urut = [...(dokumen ?? [])].sort(
    (a, b) => URUTAN_SUMBER.indexOf(a.sumber) - URUTAN_SUMBER.indexOf(b.sumber) || (b.tanggal || "").localeCompare(a.tanggal || ""),
  );

  return (
    <section className="dsb-panel" aria-labelledby="judul-dokumen">
      <div className="dsb-panel-kepala">
        <h2 id="judul-dokumen" className="dsb-panel-judul">
          Dokumen pegawai <small>{dokumen ? `${dokumen.length} berkas` : ""}</small>
        </h2>
      </div>

      <div className="inv-atur pmh-unggah">
        <label className="inv-bidang">
          <span>Jenis dokumen</span>
          <select className="dsb-cari" value={jenis} onChange={(e) => setJenis(e.target.value as JenisDokumen)}>
            {(Object.keys(JENIS_DOKUMEN) as JenisDokumen[]).map((j) => (
              <option key={j} value={j}>{JENIS_DOKUMEN[j]}</option>
            ))}
          </select>
        </label>
        <label className="inv-bidang">
          <span>Nomor SK</span>
          <input className="dsb-cari" value={nomorSK} onChange={(e) => setNomorSK(e.target.value)} placeholder="Sesuai dokumen" />
        </label>
        <label className="inv-bidang">
          <span>Tanggal SK</span>
          <input type="date" className="dsb-cari" value={tanggalSK} onChange={(e) => setTanggalSK(e.target.value)} />
        </label>
        <span />
        <label className="inv-bidang inv-lebar-2">
          <span>Berkas PDF (paling besar 5 MB)</span>
          <input
            key={kunciInput}
            type="file"
            accept="application/pdf,.pdf"
            className="dsb-cari"
            onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="inv-bidang">
          <span>Keterangan</span>
          <input className="dsb-cari" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="opsional" />
        </label>
        <button type="button" className="dsb-tombol" disabled={sibuk || !berkas} onClick={() => void unggah()}>
          {sibuk ? "Mengunggah…" : "Unggah"}
        </button>
      </div>

      {!dokumen ? (
        <p className="dsb-kosong">Memuat…</p>
      ) : urut.length === 0 ? (
        <p className="dsb-kosong">Belum ada dokumen. Unggah SK pegawai di atas, atau dokumen akan tampil dari SK KGB, usulan UPT, dan formulir.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="dsb-tabel">
            <thead>
              <tr>
                <th scope="col">Dokumen</th>
                <th scope="col">Nomor dan tanggal</th>
                <th scope="col">Sumber</th>
                <th scope="col" className="kanan">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {urut.map((d) => (
                <tr key={d.id}>
                  <td>
                    <p className="dsb-nama" style={{ margin: 0 }}>{d.judul}</p>
                    {d.keterangan && <p className="dsb-kecil" style={{ margin: 0 }}>{d.keterangan}</p>}
                  </td>
                  <td className="dsb-kecil">
                    {d.nomorSK || "-"}
                    {d.tanggal && <span style={{ display: "block" }}>{tanggalTeks(d.tanggal)}</span>}
                  </td>
                  <td className="dsb-kecil">
                    {LABEL_SUMBER_DOKUMEN[d.sumber]}
                    {d.ukuran !== null && <span style={{ display: "block" }}>{ukuranTeks(d.ukuran)}</span>}
                  </td>
                  <td className="kanan whitespace-nowrap">
                    <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => onLihat(d)}>
                      Lihat
                    </button>
                    {d.bisaHapus && (
                      <button type="button" className="dsb-ikon-tombol" data-nada="merah" aria-label={`Hapus ${d.judul}`} onClick={() => void hapus(d)} style={{ marginLeft: 6 }}>
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
