"use client";

import { useMemo, useState } from "react";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import KolomBerkas from "./KolomBerkas";
import { IsianTanggal, type DrafUsulanUpt, type PegawaiUntukUsulan } from "./FormulirUsulan";
import { BIDANG_DIISI } from "@/lib/usulanFormulir";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { JENIS_KP, hitungKenaikanPangkat } from "@/lib/kenaikanPangkat";
import { hitungPmk } from "@/lib/pmk";
import { formatTanggalId } from "@/lib/waktu";
import { LABEL_DASAR_BARU } from "@/lib/dasarBaruUsulan";

/* Kartu "Laporkan kenaikan pangkat" dan "Laporkan peninjauan masa kerja" untuk Admin UPT (ADR-045).
 *
 * Satu SK, satu kartu. Sebelumnya kedua tindakan membuka formulir perbaikan data yang utuh — identitas,
 * jabatan, pangkat, berkas — padahal operator yang memegang satu SK hanya perlu memindahkan apa yang
 * tertulis di SK itu. Kartu ini hanya memuat isian SK-nya, pratayang hitungannya, dan pindaian SK-nya.
 *
 * Yang disimpan tetap usulan perbaikan yang sama (POST /api/upt/usulan atau PATCH bila drafnya sudah ada),
 * sebab Kanwil-lah yang mencatat riwayat KP atau PMK saat menyetujui (ADR-030). Karena rute PATCH menulis
 * seluruh isian, kartu ini selalu mengirimkan kembali nilai draf yang sudah ada apa adanya dan hanya
 * menimpa yang memang diubahnya; tanpa itu, menyimpan dari kartu akan mengosongkan isian lain pada draf.
 */

type JenisDasar = "kp" | "pmk";

/** Pratayang akibat SK: baris siap tampil, atau sebab mengapa belum dapat dihitung. */
type Pratayang =
  | { ok: true; baris: [string, string][]; catatan: string }
  | { ok: false; galat: string }
  | null;

/** Angka dari isian teks; kosong dibaca nol, sebab masa kerja 0 tahun adalah nilai yang sah. */
const angka = (teks: string) => {
  const n = Number((teks ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
const mkgTeks = (tahun: number, bulan: number) => `${tahun} thn ${bulan} bln`;

export default function ModalDasarBaru({
  jenis,
  pegawai,
  draf,
  onTutup,
  onSelesai,
}: {
  jenis: JenisDasar;
  pegawai: PegawaiUntukUsulan;
  /** Draf usulan yang sedang berjalan untuk pegawai ini; isinya dipertahankan saat kartu disimpan. */
  draf: DrafUsulanUpt | null;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const sekarang: Record<string, string> = draf?.nilai ?? pegawai.dataSekarang ?? {};
  const golonganSekarang = sekarang.golonganRuang ?? "";
  const mkgTahunSekarang = angka(sekarang.mkgTahun ?? "0");
  const mkgBulanSekarang = angka(sekarang.mkgBulan ?? "0");
  const tmtKgbTerakhir = sekarang.tmtKgbTerakhir ?? "";

  // Draf yang sudah menyebut sebab yang sama isinya dipakai kembali; yang menyebut sebab lain dibiarkan
  // apa adanya sampai operator benar-benar menyimpan, lalu diganti — dengan peringatan di layar.
  const drafSama = draf?.dasarBaru?.jenis === jenis ? draf.dasarBaru : null;
  const drafSebabLain = draf?.dasarBaru?.jenis && draf.dasarBaru.jenis !== jenis ? draf.dasarBaru.jenis : null;

  const [golonganBaru, setGolonganBaru] = useState(jenis === "kp" ? (drafSama ? sekarang.golonganRuang ?? "" : "") : "");
  const [jenisKp, setJenisKp] = useState(drafSama?.jenisKp || "reguler");
  const [mkgTahunSk, setMkgTahunSk] = useState(jenis === "pmk" && drafSama ? String(mkgTahunSekarang) : "");
  const [mkgBulanSk, setMkgBulanSk] = useState(jenis === "pmk" && drafSama ? String(mkgBulanSekarang) : "");
  const [nomorSk, setNomorSk] = useState(drafSama?.nomorSk ?? "");
  const [tanggalSk, setTanggalSk] = useState(drafSama?.tanggalSk ?? "");
  const [tmt, setTmt] = useState(drafSama?.tmt ?? "");
  const [penetap, setPenetap] = useState(drafSama?.penetap ?? "");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  /** Berkas yang sedang dibuka, agar operator dapat memastikan pindaian yang dilampirkan memang benar. */
  const [pratinjauBerkas, setPratinjauBerkas] = useState<{ judul: string; url: string; lokal: boolean } | null>(null);

  const medanBerkas = jenis === "kp" ? "skPangkat" : "skPmk";
  const labelBerkas = jenis === "kp" ? "SK kenaikan pangkat" : "SK peninjauan masa kerja";
  const berkasTersimpan = draf?.berkas.find((b) => b.medan === medanBerkas) ?? null;
  const berkasBawaan = pegawai.bawaan?.berkas.find((b) => b.medan === medanBerkas) ?? null;

  /**
   * Pratayang akibat SK ini, memakai fungsi yang sama dengan yang dipakai Kanwil saat menyetujui
   * (lib/kenaikanPangkat.ts dan lib/pmk.ts), sehingga yang terlihat di sini bukan taksiran.
   */
  const hitung = useMemo((): Pratayang => {
    if (jenis === "kp") {
      if (!golonganBaru) return null;
      const h = hitungKenaikanPangkat({
        golonganLama: golonganSekarang,
        mkgTahunLama: mkgTahunSekarang,
        mkgBulanLama: mkgBulanSekarang,
        golonganBaru,
      });
      if (!h.ok) return { ok: false, galat: h.pesan };
      return {
        ok: true,
        baris: [
          ["Pangkat", `${h.hasil.pangkatBaru} (${h.hasil.golonganBaru})`],
          [
            "Masa kerja golongan",
            `${mkgTeks(mkgTahunSekarang, mkgBulanSekarang)} → ${mkgTeks(h.hasil.mkgTahunBaru, h.hasil.mkgBulanBaru)}`,
          ],
          ["Gaji pokok", rupiah(h.hasil.gajiPokokBaru)],
        ],
        catatan:
          h.hasil.potonganMkgTahun > 0
            ? `Masa kerja golongan dipotong ${h.hasil.potonganMkgTahun} tahun karena pindah jenjang golongan. Jadwal KGB berikutnya tidak bergeser oleh kenaikan pangkat.`
            : "Jadwal KGB berikutnya tidak bergeser oleh kenaikan pangkat.",
      };
    }
    if (!mkgTahunSk && !mkgBulanSk) return null;
    const h = hitungPmk({
      golonganRuang: golonganSekarang,
      mkgTahun: mkgTahunSekarang,
      mkgBulan: mkgBulanSekarang,
      tmtKgbTerakhir,
      tmtPmk: tmt,
      mkgTahunSk: angka(mkgTahunSk),
      mkgBulanSk: angka(mkgBulanSk),
    });
    if (!h.ok) return { ok: false, galat: h.pesan };
    return {
      ok: true,
      baris: [
        [
          "Masa kerja golongan",
          `${mkgTeks(mkgTahunSekarang, mkgBulanSekarang)} → ${mkgTeks(h.hasil.mkgTahunDasar, h.hasil.mkgBulanDasar)}`,
        ],
        ["Gaji pokok", rupiah(h.hasil.gajiPokokBaru)],
        ["KGB berikutnya", formatTanggalId(h.hasil.tmtKgbBerikutnyaUsulan)],
      ],
      catatan: `Tambahan masa kerja ${h.hasil.tambahBulan} bulan. Kanwil dapat mengoreksi TMT KGB berikutnya sesuai SK.`,
    };
  }, [jenis, golonganBaru, golonganSekarang, mkgTahunSekarang, mkgBulanSekarang, mkgTahunSk, mkgBulanSk, tmt, tmtKgbTerakhir]);

  const galatHitung = hitung && !hitung.ok ? hitung.galat : null;
  const pratayang = hitung?.ok ? hitung : null;

  function kurang(): string[] {
    const perlu: string[] = [];
    if (jenis === "kp" && !golonganBaru) perlu.push("golongan baru menurut SK");
    if (jenis === "pmk" && !mkgTahunSk && !mkgBulanSk) perlu.push("masa kerja golongan menurut SK PMK");
    if (!nomorSk.trim()) perlu.push(`nomor ${labelBerkas}`);
    if (!tanggalSk) perlu.push("tanggal SK");
    if (!tmt) perlu.push(jenis === "kp" ? "TMT pangkat" : "TMT PMK");
    return perlu;
  }

  async function kirim() {
    const perlu = kurang();
    if (perlu.length > 0) {
      setGalat(`Belum lengkap: ${perlu.join(", ")}.`);
      return;
    }
    if (galatHitung) {
      setGalat(galatHitung);
      return;
    }
    setSibuk(true);
    setGalat(null);

    const form = new FormData();
    // Tersimpan sebagai draf: pengirimannya tetap lewat Usulan kolektif, jadi nomor surat usulan belum ada.
    form.set("status", "draf");
    form.set("jenis", "perubahan");
    if (!draf) form.set("pegawaiId", pegawai.id);

    // Seluruh isian draf dikirim ulang apa adanya; rute menulis semua kolom, jadi yang tidak ikut akan
    // terhapus. Yang berubah hanya kolom yang memang ditetapkan SK ini.
    const isian: Record<string, string> = { ...sekarang };
    if (jenis === "kp") isian.golonganRuang = golonganBaru;
    else {
      isian.mkgTahun = String(angka(mkgTahunSk));
      isian.mkgBulan = String(angka(mkgBulanSk));
    }
    for (const bidang of BIDANG_DIISI) form.set(bidang.kunci, isian[bidang.kunci] ?? "");

    // SK dasar gaji pokok dan catatan pada draf dipertahankan, sebab rute menuliskannya juga.
    form.set("nomorSkTerakhir", draf?.surat?.nomorSkTerakhir ?? pegawai.bawaan?.nomorSkTerakhir ?? "");
    form.set("tanggalSkTerakhir", draf?.surat?.tanggalSkTerakhir ?? pegawai.bawaan?.tanggalSkTerakhir ?? "");
    form.set("catatanUpt", draf?.surat?.catatanUpt ?? "");

    form.set("dasarBaruJenis", jenis);
    form.set("dasarBaruJenisKp", jenis === "kp" ? jenisKp : "");
    form.set("dasarBaruNomorSk", nomorSk.trim());
    form.set("dasarBaruTanggalSk", tanggalSk);
    form.set("dasarBaruTmt", tmt);
    form.set("dasarBaruPenetap", penetap.trim());
    if (berkas) form.set(medanBerkas, berkas);

    try {
      const res = draf
        ? await fetch(`/api/upt/usulan/${draf.id}`, { method: "PATCH", body: form })
        : await fetch("/api/upt/usulan", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Laporan gagal disimpan");
        return;
      }
      onSelesai(
        `${jenis === "kp" ? "Kenaikan pangkat" : "Peninjauan masa kerja"} ${pegawai.nama} tersimpan sebagai draf usulan. ` +
          "Ajukan ke Kanwil lewat Usulan kolektif beserta surat usulannya.",
      );
    } catch {
      setGalat("Laporan gagal disimpan. Periksa sambungan lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul={jenis === "kp" ? "Laporkan kenaikan pangkat" : "Laporkan peninjauan masa kerja"}
      subjudul={`${pegawai.nama} · ${pegawai.nip}`}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void kirim()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : draf ? "Simpan ke draf" : "Simpan draf"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />

      <Catatan>
        {jenis === "kp"
          ? "Isi golongan baru beserta SK-nya. Masa kerja golongan dan gaji pokok dihitung Kanwil saat menyetujui — naik jenjang golongan memotong masa kerja — jadi keduanya tidak diketik di sini."
          : "Isi masa kerja golongan sebagaimana tertulis pada SK PMK. Kanwil menghitung ulang gaji pokok dan jadwal KGB berikutnya dari angka itu saat menyetujui."}{" "}
        Tersimpan sebagai draf usulan perbaikan; pengirimannya tetap lewat Usulan kolektif, satu surat untuk
        beberapa pegawai.
      </Catatan>

      {drafSebabLain && (
        <Catatan nada="amber">
          Draf pegawai ini sudah menyebut <strong>{LABEL_DASAR_BARU[drafSebabLain as "kp" | "pmk" | "koreksi"]}</strong> sebagai
          sebab perubahan. Menyimpan di sini akan menggantinya.
        </Catatan>
      )}

      <p className="kgbm-legenda">
        Tercatat sekarang: <strong>{golonganSekarang || "-"}</strong> · {mkgTeks(mkgTahunSekarang, mkgBulanSekarang)}
        {tmtKgbTerakhir ? ` · TMT KGB terakhir ${formatTanggalId(tmtKgbTerakhir)}` : ""}
      </p>

      {jenis === "kp" ? (
        <div className="kgbm-grid2">
          <label className="kgbm-label">
            <span className="kgbm-wajib">Jenis kenaikan pangkat</span>
            <select className="kgbm-input" value={jenisKp} onChange={(e) => setJenisKp(e.target.value)}>
              {Object.entries(JENIS_KP).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="kgbm-label">
            <span className="kgbm-wajib">Golongan baru menurut SK</span>
            <select className="kgbm-input" value={golonganBaru} onChange={(e) => setGolonganBaru(e.target.value)}>
              <option value="">Pilih golongan</option>
              {Object.entries(GOLONGAN_PANGKAT).map(([golongan, pangkat]) => (
                <option key={golongan} value={golongan}>
                  {golongan} · {pangkat}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="kgbm-grid2">
          <label className="kgbm-label">
            <span className="kgbm-wajib">Masa kerja pada SK (tahun)</span>
            <input
              className="kgbm-input"
              inputMode="numeric"
              value={mkgTahunSk}
              onChange={(e) => setMkgTahunSk(e.target.value.replace(/\D/g, ""))}
            />
            <span className="kgbm-bantuan">Masa kerja golongan pada TMT PMK, sebagaimana tertulis pada SK.</span>
          </label>
          <label className="kgbm-label">
            Masa kerja pada SK (bulan)
            <input
              className="kgbm-input"
              inputMode="numeric"
              value={mkgBulanSk}
              onChange={(e) => setMkgBulanSk(e.target.value.replace(/\D/g, ""))}
            />
            <span className="kgbm-bantuan">0 sampai 11.</span>
          </label>
        </div>
      )}

      <div className="kgbm-grid2">
        <label className="kgbm-label">
          <span className="kgbm-wajib">Nomor {labelBerkas}</span>
          <input className="kgbm-input" value={nomorSk} onChange={(e) => setNomorSk(e.target.value)} />
        </label>
        <IsianTanggal label="Tanggal SK" wajib nilai={tanggalSk} onUbah={setTanggalSk} />
      </div>

      <div className="kgbm-grid2">
        <IsianTanggal label={jenis === "kp" ? "TMT pangkat" : "TMT PMK"} wajib nilai={tmt} onUbah={setTmt} />
        <label className="kgbm-label">
          Ditetapkan oleh
          <input
            className="kgbm-input"
            value={penetap}
            onChange={(e) => setPenetap(e.target.value)}
            placeholder="Pejabat penanda tangan SK"
          />
        </label>
      </div>

      {galatHitung ? (
        <Catatan nada="amber">{galatHitung}</Catatan>
      ) : (
        pratayang && (
          <div className="kgbm-hitungan">
            <p className="kgbm-hitungan-judul">Dihitung sistem</p>
            <dl>
              {pratayang.baris.map(([label, nilai]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{nilai}</dd>
                </div>
              ))}
            </dl>
            <p className="kgbm-hitungan-ket">{pratayang.catatan}</p>
          </div>
        )
      )}

      <KolomBerkas
        label={labelBerkas}
        wajib
        bantuan={
          berkasBawaan && !berkasTersimpan
            ? "Yang terlampir masih SK dari usulan sebelumnya. Bila SK yang Anda laporkan berbeda, ganti berkasnya."
            : "Pindai sebagai dokumen, bukan foto. Boleh menyusul, tetapi ditagih saat usulan diajukan ke Kanwil."
        }
        dipilih={berkas}
        urlTersimpan={
          draf && berkasTersimpan
            ? `/api/usulan/${draf.id}/berkas?berkas=${medanBerkas}`
            : berkasBawaan
              ? `/api/usulan/${berkasBawaan.usulanId}/berkas?berkas=${medanBerkas}`
              : null
        }
        namaTersimpan={
          berkasTersimpan?.nama ??
          (berkasBawaan ? `${berkasBawaan.nama ?? labelBerkas} · dari usulan yang disetujui` : null)
        }
        ditandaiHapus={false}
        onPilih={setBerkas}
        onHapusTersimpan={() => {}}
        onBatalHapus={() => {}}
        onPratinjau={(judul, url, lokal) => setPratinjauBerkas({ judul, url, lokal })}
      />

      {pratinjauBerkas && (
        <ModalPratinjauBerkas
          judul={pratinjauBerkas.judul}
          subjudul={`${pegawai.nama} · berkas tersimpan`}
          url={pratinjauBerkas.url}
          onTutup={() => {
            // Blob URL berkas yang baru dipilih dicabut agar memorinya dilepas.
            if (pratinjauBerkas.lokal) URL.revokeObjectURL(pratinjauBerkas.url);
            setPratinjauBerkas(null);
          }}
        />
      )}
    </KerangkaModal>
  );
}
