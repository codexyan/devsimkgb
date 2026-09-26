"use client";

import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { formatTanggalId } from "@/lib/waktu";

/* Lini masa KGB per bulan TMT di dashboard Super Admin dan SDM. Menggantikan ubin 12 bulan yang hanya berisi
   angka: tiap bulan TMT memperlihatkan jendela inputnya (dibuka sampai batas input SDM) beserta keadaannya
   hari ini, dan sebaran status KGB-nya sebagai bilah bertumpuk. Bulan yang jendelanya sedang terbuka disorot
   emas (ADR-003: emas berarti "sekarang"). Klik bulan menyaring antrian. */

export type KelompokLiniMasa = "lewat" | "belum" | "proses" | "keuangan" | "selesai";

export interface EntriLiniMasa {
  /** TMT KGB, ISO atau yyyy-mm-dd. */
  tmt: string;
  kelompok: KelompokLiniMasa;
}

const URUTAN: { k: KelompokLiniMasa; label: string; warna: string }[] = [
  { k: "selesai", label: "selesai", warna: "var(--st-green)" },
  { k: "keuangan", label: "di keuangan", warna: "var(--st-violet)" },
  { k: "proses", label: "diproses", warna: "var(--navy-solid)" },
  { k: "belum", label: "belum diinput", warna: "var(--amber-solid, var(--st-amber))" },
  { k: "lewat", label: "lewat batas", warna: "var(--st-red)" },
];

/** Dua bulan TMT ke belakang sampai lima ke depan: jendela yang baru lewat, yang terbuka, dan yang akan datang. */
const MUNDUR = 2;
const MAJU = 5;

function kunciBulan(t: Date): string {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

export default function LiniMasaKgb({
  entri,
  bulanTerpilih,
  onPilih,
}: {
  entri: readonly EntriLiniMasa[];
  bulanTerpilih: string | null;
  onPilih: (bulan: string | null) => void;
}) {
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  const perBulan = new Map<string, Record<KelompokLiniMasa, number>>();
  for (const e of entri) {
    const t = new Date(e.tmt);
    if (Number.isNaN(t.getTime())) continue;
    const kunci = kunciBulan(t);
    const hitung = perBulan.get(kunci) ?? { lewat: 0, belum: 0, proses: 0, keuangan: 0, selesai: 0 };
    hitung[e.kelompok] += 1;
    perBulan.set(kunci, hitung);
  }

  const bulan = Array.from({ length: MUNDUR + MAJU + 1 }, (_, i) => new Date(hariIni.getFullYear(), hariIni.getMonth() - MUNDUR + i, 1));

  return (
    <div className="dsb-lini">
      <ol className="dsb-lini-daftar">
        {bulan.map((tmt) => {
          const kunci = kunciBulan(tmt);
          const hitung = perBulan.get(kunci) ?? { lewat: 0, belum: 0, proses: 0, keuangan: 0, selesai: 0 };
          const total = URUTAN.reduce((n, u) => n + hitung[u.k], 0);
          const jendela = jendelaProsesKgb(tmt, hariIni);
          const terbuka = !!jendela && !jendela.isLocked && !jendela.flagRapelan;
          const sisaHari = jendela ? Math.round((jendela.deadlineSDM.getTime() - hariIni.getTime()) / 86_400_000) : null;
          const keadaan = !jendela
            ? ""
            : jendela.isLocked
              ? `dibuka ${formatTanggalId(jendela.unlockDate, { day: "numeric", month: "short" })}`
              : terbuka
                ? sisaHari === 0 ? "batas hari ini" : `terbuka, ${sisaHari} hari lagi`
                : "ditutup";
          const terpilih = bulanTerpilih === kunci;
          return (
            <li key={kunci}>
              <button
                type="button"
                className="dsb-lini-sel"
                aria-pressed={terpilih}
                data-terbuka={terbuka ? "" : undefined}
                data-kosong={total === 0 ? "" : undefined}
                onClick={() => onPilih(terpilih ? null : kunci)}
                aria-label={`TMT ${formatTanggalId(tmt, { month: "long", year: "numeric" })}: ${total} KGB${
                  hitung.lewat > 0 ? `, ${hitung.lewat} lewat batas` : ""
                }; jendela input ${keadaan}`}
              >
                <span className="dsb-lini-kepala">
                  <span className="dsb-lini-bulan">{formatTanggalId(tmt, { month: "short", year: "numeric" })}</span>
                  <span className="dsb-lini-total">{total}</span>
                </span>
                <span className="dsb-lini-bar" aria-hidden="true">
                  {total > 0 &&
                    URUTAN.filter((u) => hitung[u.k] > 0).map((u) => (
                      <span key={u.k} style={{ flexGrow: hitung[u.k], background: u.warna }} />
                    ))}
                </span>
                <span className="dsb-lini-jendela">
                  {jendela && (
                    <>
                      input {formatTanggalId(jendela.unlockDate, { day: "numeric", month: "short" })}–
                      {formatTanggalId(jendela.deadlineSDM, { day: "numeric", month: "short" })}
                    </>
                  )}
                </span>
                <span className="dsb-lini-keadaan" data-nada={hitung.lewat > 0 ? "merah" : terbuka ? "emas" : undefined}>
                  {hitung.lewat > 0 ? `${hitung.lewat} lewat batas` : keadaan}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="dsb-legenda dsb-lini-legenda">
        {URUTAN.map((u) => (
          <span key={u.k}>
            <span className="dsb-lini-kotak" style={{ background: u.warna }} aria-hidden="true" />
            {u.label}
          </span>
        ))}
        <span>
          <span className="dsb-lini-kotak" data-emas="" aria-hidden="true" />
          jendela input terbuka
        </span>
      </p>
    </div>
  );
}
