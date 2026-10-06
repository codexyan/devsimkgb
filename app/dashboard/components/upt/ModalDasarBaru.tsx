"use client";

import { useState } from "react";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import KolomBerkas from "./KolomBerkas";
import { IsianTanggal, type DrafUsulanUpt, type PegawaiUntukUsulan } from "./FormulirUsulan";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { JENIS_KP } from "@/lib/kenaikanPangkat";
import { kekuranganLaporSk, peringatanDampakKgb, pratayangLaporSk, teksMasaKerja, type IsianLaporSk } from "@/lib/laporSk";
import {
  ajukanLaporSk,
  berkasBelumAda,
  berkasDiminta,
  berkasTersedia,
  keadaanInduk,
  keadaanTercatat,
  nilaiTercatat,
  simpanLaporSk,
} from "./laporSkKirim";
import { formatTanggalId } from "@/lib/waktu";
import { LABEL_DASAR_BARU, TANPA_SK_BARU } from "@/lib/dasarBaruUsulan";

/* Kartu "Laporkan kenaikan pangkat" dan "Laporkan peninjauan masa kerja" untuk Admin UPT (ADR-045).
 *
 * Satu SK, satu kartu. Sebelumnya kedua tindakan membuka formulir perbaikan data yang utuh, lengkap
 * dengan identitas, jabatan, pangkat, dan berkas, padahal operator yang memegang satu SK hanya perlu memindahkan apa yang
 * tertulis di SK itu. Kartu ini hanya memuat isian SK-nya, pratayang hitungannya, dan pindaian SK-nya.
 *
 * Yang disimpan tetap usulan perbaikan yang sama (POST /api/upt/usulan atau PATCH bila drafnya sudah ada),
 * sebab Kanwil-lah yang mencatat riwayat KP atau PMK saat menyetujui (ADR-030). Karena rute PATCH menulis
 * seluruh isian, kartu ini selalu mengirimkan kembali nilai draf yang sudah ada apa adanya dan hanya
 * menimpa yang memang diubahnya; tanpa itu, menyimpan dari kartu akan mengosongkan isian lain pada draf.
 */

type JenisDasar = "kp" | "pmk";

const mkgTeks = teksMasaKerja;

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
  const sekarang = nilaiTercatat(pegawai, draf);
  const tercatat = keadaanTercatat(pegawai, draf);
  // Pratinjau dan keterangan "Tercatat sekarang" bertolak dari data induk, seperti Kanwil saat menyetujui; draf yang
  // sudah memuat golongan baru dari laporan ini bukan golongan lama (ADR-074).
  const induk = keadaanInduk(pegawai, draf);
  const golonganSekarang = induk.golongan;
  const mkgTahunSekarang = tercatat.mkgTahun;
  const mkgBulanSekarang = tercatat.mkgBulan;
  const tmtKgbTerakhir = induk.tmtKgbTerakhir;

  // Draf yang sudah menyebut sebab yang sama isinya dipakai kembali; yang menyebut sebab lain dibiarkan
  // apa adanya sampai operator benar-benar menyimpan, lalu diganti, dengan peringatan di layar.
  const drafSama = draf?.dasarBaru?.jenis === jenis ? draf.dasarBaru : null;
  // Jawaban "tidak ada SK" pada draf (ADR-065) cukup digantikan laporan ini, tanpa peringatan.
  const drafSebabLain =
    draf?.dasarBaru?.jenis && draf.dasarBaru.jenis !== jenis && draf.dasarBaru.jenis !== TANPA_SK_BARU ? draf.dasarBaru.jenis : null;

  const [golonganBaru, setGolonganBaru] = useState(jenis === "kp" ? (drafSama ? sekarang.golonganRuang ?? "" : "") : "");
  const [jenisKp, setJenisKp] = useState(drafSama?.jenisKp || "reguler");
  const [mkgTahunSk, setMkgTahunSk] = useState(jenis === "pmk" && drafSama ? String(mkgTahunSekarang) : "");
  const [mkgBulanSk, setMkgBulanSk] = useState(jenis === "pmk" && drafSama ? String(mkgBulanSekarang) : "");
  const [nomorSk, setNomorSk] = useState(drafSama?.nomorSk ?? "");
  const [tanggalSk, setTanggalSk] = useState(drafSama?.tanggalSk ?? "");
  const [tmt, setTmt] = useState(drafSama?.tmt ?? "");
  const [penetap, setPenetap] = useState(drafSama?.penetap ?? "");
  const [berkas, setBerkas] = useState<Record<string, File | null>>({});
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  /** Berkas yang sedang dibuka, agar operator dapat memastikan pindaian yang dilampirkan memang benar. */
  const [pratinjauBerkas, setPratinjauBerkas] = useState<{ judul: string; url: string; lokal: boolean } | null>(null);

  const medanBerkas = jenis === "kp" ? "skPangkat" : "skPmk";
  const labelBerkas = jenis === "kp" ? "SK kenaikan pangkat" : "SK peninjauan masa kerja";

  const daftarBerkas = berkasDiminta(tercatat, jenis);
  /** Berkas yang sudah ada untuk satu medan: unggahan pada draf, atau salinan dari usulan yang disetujui. */
  const tersedia = (medan: string) => berkasTersedia(pegawai, draf, medan);
  const belumAda = berkasBelumAda(pegawai, draf, tercatat, jenis, berkas);

  const isian: IsianLaporSk = { jenis, jenisKp, golonganBaru, mkgTahunSk, mkgBulanSk, nomorSk, tanggalSk, tmt, penetap };
  /** Pratayang akibat SK ini, dengan fungsi yang sama dengan yang dipakai Kanwil saat menyetujui (lib/laporSk.ts). */
  const hitung = pratayangLaporSk(induk, isian);
  /** Dampak ke KGB pegawai yang sedang berjalan di Kanwil (ADR-074). */
  const dampak = peringatanDampakKgb(pegawai.kgb?.status, pegawai.kgb?.tmt);
  const galatHitung = hitung && !hitung.ok ? hitung.galat : null;
  const pratayang = hitung?.ok ? hitung : null;

  /**
   * `langsung` true berarti sekalian diajukan ke Kanwil sesudah tersimpan. Laporan yang isinya murni SK kenaikan
   * pangkat atau PMK berangkat tanpa surat usulan (ADR-046); yang isinya lebih dari itu ditolak rute pengajuan dengan
   * menyebut suratnya, dan drafnya tetap tersimpan.
   */
  async function kirim(langsung: boolean) {
    const perlu = kekuranganLaporSk(isian);
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
    try {
      const simpan = await simpanLaporSk({ pegawai, draf, isian, berkas });
      if (!simpan.ok) {
        setGalat(simpan.galat);
        return;
      }
      const label = jenis === "kp" ? "Kenaikan pangkat" : "Peninjauan masa kerja";
      if (!langsung) {
        onSelesai(`${label} ${pegawai.nama} tersimpan sebagai draf. Kirim ke Kanwil bila berkasnya sudah lengkap.`);
        return;
      }
      const ajukan = await ajukanLaporSk(simpan.id);
      if (!ajukan.ok) {
        setGalat(ajukan.galat);
        return;
      }
      onSelesai(`${label} ${pegawai.nama} terkirim ke Kanwil beserta pindaian SK-nya.`);
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
      onKirim={() => void kirim(true)}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          {/* Menyimpan tanpa mengirim tetap disediakan: pemindai yang sedang antre tidak boleh membuat
              isian yang sudah diketik hilang. */}
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => void kirim(false)} disabled={sibuk}>
            Simpan draf
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk || belumAda.length > 0}>
            {sibuk ? "Mengirim…" : "Kirim ke Kanwil"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />

      <Catatan>
        {jenis === "kp"
          ? "Isi golongan baru beserta SK-nya. Masa kerja golongan dan gaji pokok dihitung Kanwil saat menyetujui; naik jenjang golongan memotong masa kerja, jadi keduanya tidak diketik di sini."
          : "Isi masa kerja golongan sebagaimana tertulis pada SK PMK. Kanwil menghitung ulang gaji pokok dan jadwal KGB berikutnya dari angka itu saat menyetujui."}{" "}
        Laporan SK tidak menumpang surat usulan: SK-nya sudah terbit dan pindaiannya ikut terkirim, jadi
        begitu berkasnya lengkap, kartu ini langsung mengirimkannya ke Kanwil.
      </Catatan>

      {dampak && (
        <Catatan nada={dampak.nada === "merah" ? "merah" : "amber"}>
          <strong>{dampak.nada === "merah" ? "Laporan akan tertahan. " : "Perhatikan. "}</strong>
          {dampak.teks}
        </Catatan>
      )}

      {drafSebabLain && (
        <Catatan nada="amber">
          Draf pegawai ini sudah menyebut <strong>{LABEL_DASAR_BARU[drafSebabLain as "kp" | "pmk" | "koreksi"]}</strong> sebagai
          sebab perubahan. Menyimpan di sini akan menggantinya.
        </Catatan>
      )}

      <p className="kgbm-legenda">
        Tercatat sekarang: <strong>{golonganSekarang || "-"}</strong> · {mkgTeks(induk.mkgTahun, induk.mkgBulan)}
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

      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Berkas yang menyertai</p>
          <p className="kgbm-bagian-ket">
            Pindai sebagai dokumen, bukan foto: tiap berkas paling besar 500 KB
          </p>
        </div>
        <div className="kgbm-bagian-isi">
          {daftarBerkas.map((b) => {
            const ada = tersedia(b.medan);
            const iniSkDilaporkan = b.medan === medanBerkas;
            return (
              <KolomBerkas
                key={b.medan}
                label={b.label}
                wajib={b.wajib}
                bantuan={
                  iniSkDilaporkan && ada.bawaan && !ada.draf
                    ? "Yang terlampir masih SK dari usulan sebelumnya. Bila SK yang Anda laporkan berbeda, ganti berkasnya."
                    : b.keterangan
                }
                dipilih={berkas[b.medan] ?? null}
                urlTersimpan={
                  draf && ada.draf
                    ? `/api/usulan/${draf.id}/berkas?berkas=${b.medan}`
                    : ada.bawaan
                      ? `/api/usulan/${ada.bawaan.usulanId}/berkas?berkas=${b.medan}`
                      : null
                }
                namaTersimpan={
                  ada.draf?.nama ??
                  (ada.bawaan ? `${ada.bawaan.nama ?? b.label} · dari usulan yang disetujui` : null)
                }
                ditandaiHapus={false}
                onPilih={(f) => setBerkas((lama) => ({ ...lama, [b.medan]: f }))}
                onHapusTersimpan={() => {}}
                onBatalHapus={() => {}}
                onPratinjau={(judul, url, lokal) => setPratinjauBerkas({ judul, url, lokal })}
              />
            );
          })}
          {belumAda.length > 0 && (
            <p className="kgbm-bantuan">
              Belum dapat dikirim ke Kanwil sebelum {belumAda.map((b) => b.label).join(" dan ")} dilampirkan.
              Isiannya tetap dapat disimpan sebagai draf.
            </p>
          )}
        </div>
      </div>

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
