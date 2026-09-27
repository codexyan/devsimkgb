"use client";

import { useEffect, useId, useRef, useState } from "react";
import { URUTAN_GOLONGAN } from "@/lib/kenaikanPangkat";
import { getPangkat } from "@/lib/tabelGaji";
import { golonganBerikutnya, simulasiKenaikanPangkat } from "@/lib/simulasiKp";
import { SOROT_TABEL, type SorotTabel } from "./sorot";
import { kurangiGerak as kurangiGerakPengguna } from "@/lib/ui/gerak";

/* Kalkulator kenaikan pangkat (KP) dan KGB sesudahnya. Hitungannya dari lib/simulasiKp.ts, yang meniru cara
   SIM-KGB mencatat KP: dalam jenjang MKG dibawa, lintas jenjang dipotong, dan siklus KGB tidak diulang dari
   TMT KP. Hasil dihitung ulang setiap isian berubah; tombol "Tandai di tabel" menyorot sel gaji lama dan
   baru pada tabel di bawahnya. */

const angka = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const rupiah = (n: number) => `Rp${angka(n)}`;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tanggal = (t: Date) => `${t.getDate()} ${BULAN[t.getMonth()]} ${t.getFullYear()}`;
const jenjang = (golongan: string) => golongan.split("/")[0];
const mkgTeks = (tahun: number, bulan: number) => `${tahun} tahun${bulan ? ` ${bulan} bulan` : ""}`;

/** "yyyy-mm-dd" dari <input type="date"> menjadi tanggal kalender setempat; kosong atau tidak sah menjadi null. */
function bacaTanggal(teks: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Angka yang bergulir ke nilai barunya; langsung berganti bila pengguna meminta gerak dikurangi. */
function useAngkaBergulir(sasaran: number): number {
  const [tampil, setTampil] = useState(sasaran);
  const dariRef = useRef(sasaran);
  useEffect(() => {
    const dari = dariRef.current;
    dariRef.current = sasaran;
    if (dari === sasaran) return;
    if (kurangiGerakPengguna()) {
      const t = setTimeout(() => setTampil(sasaran), 0);
      return () => clearTimeout(t);
    }
    let bingkai = 0;
    const mulai = performance.now();
    const langkah = (sekarang: number) => {
      const p = Math.min(1, (sekarang - mulai) / 520);
      const e = 1 - Math.pow(1 - p, 3);
      setTampil(Math.round(dari + (sasaran - dari) * e));
      if (p < 1) bingkai = requestAnimationFrame(langkah);
    };
    bingkai = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(bingkai);
  }, [sasaran]);
  return tampil;
}

export default function KalkulatorKp() {
  const id = useId();
  const [golLama, setGolLama] = useState("III/b");
  const [golBaru, setGolBaru] = useState("III/c");
  const [tahun, setTahun] = useState("2");
  const [bulan, setBulan] = useState("0");
  const [tmtKgb, setTmtKgb] = useState("");
  const [tmtKp, setTmtKp] = useState("");

  const r = simulasiKenaikanPangkat({
    golonganLama: golLama,
    mkgTahun: tahun === "" ? 0 : Number(tahun),
    mkgBulan: bulan === "" ? 0 : Number(bulan),
    golonganBaru: golBaru,
    tmtKgbTerakhir: bacaTanggal(tmtKgb),
    tmtKp: bacaTanggal(tmtKp),
    jumlahKgb: 3,
  });
  const h = r.ok ? r.hasil : null;
  const gajiBaru = useAngkaBergulir(h?.gajiBaru ?? 0);
  const selisih = useAngkaBergulir(h?.selisih ?? 0);

  // Ringkasan untuk pembaca layar, ditunda sampai pengisian berhenti.
  const ringkasanKini = h
    ? `${h.golonganLama} ke ${h.golonganBaru}: gaji pokok ${rupiah(h.gajiLama)} menjadi ${rupiah(h.gajiBaru)}, ` +
      `masa kerja golongan ${mkgTeks(h.mkgTahunBaru, h.mkgBulanBaru)}` +
      (h.potonganMkgTahun ? `, dipotong ${h.potonganMkgTahun} tahun.` : ", tidak dipotong.")
    : r.ok ? "" : r.pesan;
  const [ringkasan, setRingkasan] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setRingkasan(ringkasanKini), 600);
    return () => clearTimeout(t);
  }, [ringkasanKini]);

  function gantiGolLama(g: string) {
    setGolLama(g);
    // Golongan tujuan kembali ke satu ruang di atasnya: itulah kenaikan pangkat reguler.
    setGolBaru(golonganBerikutnya(g) ?? golBaru);
  }

  function tandaiDiTabel() {
    if (!h) return;
    const detail: SorotTabel = {
      lama: { golongan: h.golonganLama, mkg: h.mkgTahunLama },
      baru: { golongan: h.golonganBaru, mkg: h.mkgTahunBaru },
    };
    window.dispatchEvent(new CustomEvent(SOROT_TABEL, { detail }));
    const kurangiGerak = kurangiGerakPengguna();
    document.getElementById("tabel-gaji")?.scrollIntoView({ behavior: kurangiGerak ? "auto" : "smooth", block: "start" });
  }

  const pilihanGol = (batasBawah = -1) =>
    URUTAN_GOLONGAN.map((g, i) => (
      <option key={g} value={g} disabled={i <= batasBawah}>
        {g} · {getPangkat(g)}
      </option>
    ));

  return (
    <section className="tk" aria-labelledby={`${id}-judul`} id="kalkulator">
      <div className="tk-kepala">
        <p className="pub-eyebrow">Simulasi</p>
        <h2 id={`${id}-judul`} className="tk-judul">
          Kenaikan pangkat dan KGB sesudahnya
        </h2>
        <p className="tk-sub">
          Isi golongan dan masa kerja golongan dari SK terakhir, lalu pilih golongan tujuan. Tanggal boleh
          dikosongkan; tanpa tanggal, jadwal KGB ditampilkan sebagai jarak bulan.
        </p>
      </div>

      <div className="tk-isi">
        <form className="tk-form" onSubmit={(e) => e.preventDefault()} aria-describedby={`${id}-aturan`}>
          <div className="tk-baris2">
            <label className="tk-bidang">
              <span>Golongan sekarang</span>
              <select value={golLama} onChange={(e) => gantiGolLama(e.target.value)}>
                {pilihanGol()}
              </select>
            </label>
            <label className="tk-bidang">
              <span>Golongan tujuan</span>
              <select value={golBaru} onChange={(e) => setGolBaru(e.target.value)}>
                {pilihanGol(URUTAN_GOLONGAN.indexOf(golLama))}
              </select>
            </label>
          </div>

          <fieldset className="tk-bidang tk-mkg">
            <legend>Masa kerja golongan pada SK terakhir</legend>
            <div className="tk-mkg-isi">
              <label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={40}
                  value={tahun}
                  onChange={(e) => setTahun(e.target.value)}
                  aria-label="Masa kerja golongan, tahun"
                />
                <span>tahun</span>
              </label>
              <label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={11}
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  aria-label="Masa kerja golongan, bulan"
                />
                <span>bulan</span>
              </label>
            </div>
            <span className="tk-bantu">Dari SK KGB atau SK kenaikan pangkat terakhir.</span>
          </fieldset>

          <div className="tk-baris2">
            <label className="tk-bidang">
              <span>
                TMT KGB terakhir <em>opsional</em>
              </span>
              <input type="date" value={tmtKgb} onChange={(e) => setTmtKgb(e.target.value)} />
            </label>
            <label className="tk-bidang">
              <span>
                TMT kenaikan pangkat <em>opsional</em>
              </span>
              <input type="date" value={tmtKp} onChange={(e) => setTmtKp(e.target.value)} />
            </label>
          </div>
        </form>

        <div className="tk-hasil" aria-live="off">
          {!h ? (
            <p className="tk-galat" role="alert">
              {r.ok ? "" : r.pesan}
            </p>
          ) : (
            <>
              <div className="tk-banding">
                <div className="tk-sisi">
                  <span className="tk-label">Sebelum</span>
                  <span className="tk-gol">{h.golonganLama}</span>
                  <span className="tk-rinci">
                    {h.pangkatLama} · MKG {mkgTeks(h.mkgTahunLama, h.mkgBulanLama)}
                  </span>
                  <span className="tk-uang">{h.gajiLama ? rupiah(h.gajiLama) : "belum ada"}</span>
                </div>
                <span className="tk-panah" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
                <div className="tk-sisi tk-sisi-baru" key={`${h.golonganBaru}-${h.mkgTahunBaru}`}>
                  <span className="tk-label">Sesudah kenaikan pangkat</span>
                  <span className="tk-gol">{h.golonganBaru}</span>
                  <span className="tk-rinci">
                    {h.pangkatBaru} · MKG {mkgTeks(h.mkgTahunBaru, h.mkgBulanBaru)}
                  </span>
                  <span className="tk-uang tk-uang-besar">{h.gajiBaru ? rupiah(gajiBaru) : "belum ada"}</span>
                </div>
              </div>

              <div className="tk-chip-baris">
                {h.gajiBaru > 0 && h.gajiLama > 0 && (
                  <span className="tk-chip" data-nada={h.selisih >= 0 ? "naik" : "turun"}>
                    {h.selisih >= 0 ? "+" : "−"}
                    {rupiah(Math.abs(selisih))} per bulan
                  </span>
                )}
                <span className="tk-chip" data-nada={h.potonganMkgTahun ? "potong" : undefined}>
                  {h.potonganMkgTahun
                    ? `MKG dipotong ${h.potonganMkgTahun} tahun (golongan ${jenjang(h.golonganLama)} ke ${jenjang(h.golonganBaru)})`
                    : h.lintasJenjang
                      ? `MKG tidak dipotong (golongan ${jenjang(h.golonganLama)} ke ${jenjang(h.golonganBaru)})`
                      : "MKG tidak dipotong (masih satu golongan)"}
                </span>
              </div>

              {h.peringatan.map((p) => (
                <p key={p} className="tk-peringatan">
                  {p}
                </p>
              ))}

              <h3 className="tk-sub-judul">Proyeksi KGB</h3>
              <ol className="tk-garis">
                {h.kgb.map((k, i) => (
                  <li key={i} data-sebelum={k.sebelumKp ? "" : undefined} style={{ "--i": i } as React.CSSProperties}>
                    <span className="tk-garis-waktu">
                      {k.tmt ? tanggal(k.tmt) : `+${k.jarakBulan} bulan`}
                    </span>
                    <span className="tk-garis-isi">
                      <b>
                        {k.golongan} · MKG {mkgTeks(k.mkgTahun, k.mkgBulan)}
                      </b>
                      <span>
                        {k.gajiPokok ? rupiah(k.gajiPokok) : "belum ada di tabel"}
                        {k.kenaikan > 0 && <span className="tk-naik"> +{rupiah(k.kenaikan)}</span>}
                      </span>
                      {k.sebelumKp && <span className="tk-catat">sebelum TMT kenaikan pangkat, masih golongan lama</span>}
                    </span>
                  </li>
                ))}
              </ol>

              <button type="button" className="pub-btn pub-btn-secondary tk-tandai" onClick={tandaiDiTabel}>
                Tandai di tabel
              </button>
            </>
          )}
        </div>
      </div>

      <ul className="tk-aturan" id={`${id}-aturan`}>
        <li>
          <b>Satu golongan:</b> naik ruang di dalam golongan yang sama, misalnya III/b ke III/c, membawa masa kerja
          golongan apa adanya.
        </li>
        <li>
          <b>Pindah golongan:</b> dari golongan I ke II masa kerja golongan dipotong 6 tahun, dari II ke III dipotong 5
          tahun. Dari III ke IV tidak dipotong.
        </li>
        <li>
          <b>Jadwal KGB tetap:</b> kenaikan pangkat tidak mengulang hitungan KGB. KGB berikutnya tetap dihitung dari KGB
          terakhir, dengan gaji pokok dari kolom golongan yang baru.
        </li>
        <li>
          <b>Hanya simulasi:</b> angka resmi ditetapkan dalam SK kenaikan pangkat dan SK KGB.
        </li>
      </ul>

      <p className="pub-visually-hidden" aria-live="polite">
        {ringkasan}
      </p>
    </section>
  );
}
