"use client";

import { LABEL_POSISI, ringkasBulan, type KartuSatker, type PosisiKartu } from "@/lib/kartuSatkerDasbor";

/* Kartu satker di dasbor Kanwil (ADR-036). Menggantikan panel Pantau satker yang hanya memberi lima angka
   gabungan, dan sekaligus menyerap panel Jadwal input: rincian per bulan TMT kini melekat pada satkernya,
   bukan berdiri sendiri se-Kanwil. Satu baris bulan dapat ditekan untuk menyaring papan antrian ke satker
   dan bulan itu sekaligus, sehingga angka di kartu selalu dapat ditelusuri ke orangnya. */

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
  satkerTerpilih,
  bulanTerpilih,
  onPilih,
}: {
  kartu: readonly KartuSatker[];
  namaSatker: (kode: string) => { ringkas: string; lengkap: string };
  /** Berapa satker lain yang sedang tidak punya pekerjaan; disebut satu baris, bukan kartu kosong. */
  tanpaPekerjaan: number;
  satkerTerpilih: string | null;
  bulanTerpilih: string | null;
  /** bulanTmt null berarti seluruh bulan satker itu. */
  onPilih: (kode: string | null, bulanTmt: string | null) => void;
}) {
  return (
    <section className="dsb-panel" aria-labelledby="judul-kartu-satker">
      <div className="dsb-panel-kepala">
        <h2 id="judul-kartu-satker" className="dsb-panel-judul">
          Pekerjaan per satker <small>rincian bulan TMT</small>
        </h2>
        {(satkerTerpilih || bulanTerpilih) && (
          <button type="button" className="dsb-tautan" onClick={() => onPilih(null, null)}>
            Semua satker
          </button>
        )}
      </div>

      {kartu.length === 0 ? (
        <p className="dsb-kosong" style={{ padding: "28px 16px" }}>
          Tidak ada satker yang sedang punya pekerjaan KGB.
        </p>
      ) : (
        <div className="ksk-daftar">
          {kartu.map((k) => {
            const nama = namaSatker(k.kode);
            const aktif = satkerTerpilih === k.kode;
            return (
              <article key={k.kode} className="ksk-kartu" data-aktif={aktif ? "" : undefined}>
                <button
                  type="button"
                  className="ksk-kepala"
                  title={nama.lengkap}
                  aria-pressed={aktif}
                  onClick={() => onPilih(aktif && !bulanTerpilih ? null : k.kode, null)}
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
                </button>

                {k.bulan.length > 0 && (
                  <ul className="ksk-bulan">
                    {k.bulan.map((b) => {
                      const dipilih = aktif && bulanTerpilih === b.bulanTmt;
                      return (
                        <li key={b.bulanTmt}>
                          <button
                            type="button"
                            aria-pressed={dipilih}
                            onClick={() => onPilih(k.kode, dipilih ? null : b.bulanTmt)}
                          >
                            <span className="dsb-titik" data-nada={NADA_POSISI[b.utama]} aria-hidden="true" />
                            <span className="ksk-bulan-nama">TMT {labelBulan(b.bulanTmt)}</span>
                            <span className="ksk-bulan-jumlah">{b.jumlah}</span>
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
