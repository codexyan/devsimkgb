"use client";

import { LABEL_POSISI, ringkasBulan, type KartuSatker, type PosisiKartu } from "@/lib/kartuSatkerDasbor";
import { fokusKosong, periodeTerkunci, satkerTerkunci, type FokusPapan } from "@/lib/fokusPapan";
import { TombolCiut, usePanelCiut } from "@/app/dashboard/components/PanelCiut";

/* Kartu satker di dasbor Kanwil (ADR-036). Menggantikan panel Pantau satker yang hanya memberi lima angka
   gabungan, dan sekaligus menyerap panel Jadwal input: rincian per bulan TMT kini melekat pada satkernya,
   bukan berdiri sendiri se-Kanwil. Gembok pada satker dan pada tiap baris TMT mengunci fokus papan antrian
   (ADR-088): boleh beberapa sekaligus, tersimpan per akun, dan hanya menyaring tampilan. */

/** Gembok tertutup (terkunci) atau terbuka. */
function Gembok({ tutup }: { tutup: boolean }) {
  return (
    <svg className="ksk-gembok" aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {tutup ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7.5-1.9" />}
    </svg>
  );
}

const NADA_POSISI: Record<PosisiKartu, string | undefined> = {
  lewat: "merah",
  diproses: "navy",
  siap: "kuning",
  keuangan: "ungu",
  rekam_upt: "ungu",
  terkunci: undefined,
  selesai: "hijau",
};

/** "2026-11" menjadi "Nov 2026"; bulan yang tidak terbaca ditampilkan apa adanya. */
function labelBulan(bulanTmt: string): string {
  const [y, m] = bulanTmt.split("-").map(Number);
  if (!y || !m) return bulanTmt;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

export default function PanelKartuSatker({
  kartu,
  namaSatker,
  tanpaPekerjaan,
  fokus,
  onAlihSatker,
  onAlihPeriode,
  onBukaSemua,
}: {
  kartu: readonly KartuSatker[];
  namaSatker: (kode: string) => { ringkas: string; lengkap: string };
  /** Berapa satker lain yang sedang tidak punya pekerjaan; disebut satu baris, bukan kartu kosong. */
  tanpaPekerjaan: number;
  /** Fokus yang berlaku (kunci yang sudah tidak punya pekerjaan sudah dibuang). */
  fokus: FokusPapan;
  onAlihSatker: (kode: string) => void;
  onAlihPeriode: (kode: string, bulanTmt: string) => void;
  onBukaSemua: () => void;
}) {
  const adaFokus = !fokusKosong(fokus);
  const jumlahKunci = fokus.satker.length + fokus.periode.length;
  const [ciut, alihCiut] = usePanelCiut("kartu-satker");
  return (
    // dsb-penuh: panel ini yang mengambil sisa tinggi rail, dan daftarnya yang bergulir di dalam. Sebelumnya
    // tanpa peran sama sekali, sehingga tingginya hanya dibatasi angka mati di .ksk-daftar (ADR-050).
    <section className="dsb-panel dsb-penuh" aria-labelledby="judul-kartu-satker" data-ciut={ciut ? "" : undefined}>
      <div className="dsb-panel-kepala">
        <h2 id="judul-kartu-satker" className="dsb-panel-judul">
          Pekerjaan per satker <small>{kartu.length} satker</small>
        </h2>
        {adaFokus && (
          <button type="button" className="dsb-tautan" onClick={onBukaSemua} title="Buka semua kunci: papan menampilkan seluruh satker">
            Buka semua ({jumlahKunci})
          </button>
        )}
        <TombolCiut ciut={ciut} alih={alihCiut} judul="Pekerjaan per satker" />
      </div>

      {kartu.length === 0 ? (
        <p className="dsb-kosong" style={{ padding: "28px 16px" }}>
          Tidak ada satker yang sedang punya pekerjaan KGB.
        </p>
      ) : (
        <div className="ksk-daftar dsb-gulir">
          <p className="ksk-petunjuk">
            {adaFokus
              ? "Papan antrian hanya menampilkan satker dan TMT yang dikunci. Tekan gemboknya lagi untuk membuka."
              : "Tekan gembok satker atau TMT untuk memfokuskan papan antrian; boleh beberapa sekaligus."}
          </p>
          {kartu.map((k) => {
            const nama = namaSatker(k.kode);
            const kunciSatker = satkerTerkunci(fokus, k.kode);
            const tersentuh = kunciSatker || k.bulan.some((b) => periodeTerkunci(fokus, k.kode, b.bulanTmt));
            return (
              <article key={k.kode} className="ksk-kartu" data-aktif={tersentuh ? "" : undefined}>
                <button
                  type="button"
                  className="ksk-kepala"
                  title={`${kunciSatker ? "Buka kunci" : "Kunci fokus ke"} ${nama.lengkap}`}
                  aria-pressed={kunciSatker}
                  onClick={() => onAlihSatker(k.kode)}
                >
                  <span className="min-w-0">
                    <strong>{nama.ringkas}</strong>
                    <small>
                      {k.jumlah > 0 ? `${k.jumlah} perlu dikerjakan` : "tidak ada pekerjaan KGB"}
                      {k.selesai > 0 ? ` · ${k.selesai} selesai` : ""}
                    </small>
                  </span>
                  {k.utama && (
                    <span className="dsb-tag" data-garis="" data-nada={NADA_POSISI[k.utama]}>
                      {LABEL_POSISI[k.utama]}
                    </span>
                  )}
                  <Gembok tutup={kunciSatker} />
                </button>

                {k.bulan.length > 0 && (
                  <ul className="ksk-bulan">
                    {k.bulan.map((b) => {
                      const dikunci = periodeTerkunci(fokus, k.kode, b.bulanTmt);
                      return (
                        <li key={b.bulanTmt}>
                          <button
                            type="button"
                            aria-pressed={dikunci}
                            title={`${dikunci ? "Buka kunci" : "Kunci fokus ke"} ${nama.ringkas} TMT ${labelBulan(b.bulanTmt)}`}
                            onClick={() => onAlihPeriode(k.kode, b.bulanTmt)}
                          >
                            <span className="dsb-titik" data-nada={NADA_POSISI[b.utama]} aria-hidden="true" />
                            <span className="ksk-bulan-nama">TMT {labelBulan(b.bulanTmt)}</span>
                            <span className="ksk-bulan-jumlah">{b.jumlah}</span>
                            <Gembok tutup={dikunci} />
                            <small>{ringkasBulan(b)}</small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {(k.tanpaBulan > 0 || k.usulan > 0) && (
                  <p className="ksk-kaki">
                    {k.tanpaBulan > 0 && <span>{k.tanpaBulan} TMT belum tercatat</span>}
                    {k.usulan > 0 && (
                      <span className="dsb-tag" data-garis="" data-nada="ungu">
                        {k.usulan} usulan menunggu
                      </span>
                    )}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tanpaPekerjaan > 0 && (
        <p className="ksk-lain">{tanpaPekerjaan} satker lain tanpa pekerjaan KGB saat ini.</p>
      )}
    </section>
  );
}
