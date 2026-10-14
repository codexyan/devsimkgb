"use client";

import type { LinimasaHukdisJson, TitikKgbJson } from "@/lib/linimasaHukdis";
import { formatTanggalId } from "@/lib/waktu";

/* Linimasa perhitungan hukdis pada formulir Catat Kanwil (ADR-116): dua jalur KGB di atas satu sumbu waktu berskala.
   Jalur atas "Semula" adalah jadwal tanpa hukuman; jalur bawah "Sesudah dicatat" adalah jadwal setelah hukumannya dicatat.
   Pita kuning di tengah adalah masa hukuman, batang kuning pada jalur bawah adalah penundaannya. Angka MKG dan gaji pada tiap
   titik dihitung dengan rumus Input KGB, jadi yang terlihat di sini adalah yang kelak tercetak. Teks ringkasan di bawahnya
   memuat angka yang sama untuk pembaca layar. */

const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
const bulanTahun = (iso: string | null) => (iso ? formatTanggalId(iso, { month: "short", year: "numeric" }) : "-");
const tanggalPenuh = (iso: string | null) => (iso ? formatTanggalId(iso, { day: "numeric", month: "short", year: "numeric" }) : "-");
const mkgTeks = (t: Pick<TitikKgbJson, "mkgTahun" | "mkgBulan">) => (t.mkgBulan ? `${t.mkgTahun} th ${t.mkgBulan} bln` : `${t.mkgTahun} th`);
const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

const TEPI = 0.04; // ruang kiri-kanan sumbu, agar titik dan label di ujung tidak terpotong
const TAHUN = 365.25 * 86_400_000;

function Label({ kiri, t, iso, sisi, tag, atas }: { kiri: string; t: TitikKgbJson; iso: string | null; sisi: "kiri" | "tengah" | "kanan"; tag?: string; atas?: boolean }) {
  return (
    <div className="hkd-lm-label" data-sisi={sisi} data-atas={atas ? "" : undefined} style={sisi === "kiri" ? { left: 0 } : sisi === "kanan" ? { right: 0 } : { left: kiri }}>
      {tag && <span className="hkd-lm-tag">{tag}</span>}
      <strong>{bulanTahun(iso)}</strong>
      <span>MKG {mkgTeks(t)}</span>
      <span className="hkd-lm-gaji">{rupiah(t.gaji)}</span>
    </div>
  );
}

export default function LinimasaHukdis({ data }: { data: LinimasaHukdisJson }) {
  const awal = ms(data.acuan.tmt);
  const [semula1, semula2] = data.semula;
  const [sesudah1, sesudah2] = data.sesudah;
  const akhir = Math.max(ms(semula2.tmt), ms(sesudah2.tmt));
  if (!(akhir > awal)) return null;
  const x = (t: number) => (TEPI + ((t - awal) / (akhir - awal)) * (1 - 2 * TEPI)) * 100;
  const kiri = (iso: string | null) => `${x(ms(iso)).toFixed(2)}%`;

  // Garis tahun di dalam rentang.
  const garis: { tahun: number; kiri: string }[] = [];
  for (let th = new Date(awal).getUTCFullYear() + 1; th <= new Date(akhir).getUTCFullYear(); th++) {
    const t = Date.UTC(th, 0, 1);
    if (t > awal && t < akhir) garis.push({ tahun: th, kiri: `${x(t).toFixed(2)}%` });
  }

  // Pita hukuman dipotong pada rentang sumbu; tanpa tanggal berakhir, sampai ujung sumbu.
  const hMulai = Math.max(ms(data.hukuman.mulai), awal);
  const hAkhir = Math.min(Number.isNaN(ms(data.hukuman.berakhir)) ? akhir : ms(data.hukuman.berakhir), akhir);
  const adaPita = hAkhir > hMulai;
  const lebarPita = adaPita ? ((hAkhir - hMulai) / (akhir - awal)) * (1 - 2 * TEPI) * 100 : 0;

  const lebarTunda = ((ms(sesudah1.tmt) - ms(semula1.tmt)) / (akhir - awal)) * (1 - 2 * TEPI) * 100;
  const tahunSpan = ((akhir - awal) / TAHUN).toFixed(1);

  const tertunda = sesudah1;
  const kembali = sesudah2;
  return (
    <div className="hkd-lm" role="group" aria-label="Linimasa perhitungan jadwal KGB bila hukuman dicatat">
      <div className="hkd-lm-kepala">
        <p>Linimasa perhitungan</p>
        <span>{tahunSpan.replace(".", ",")} tahun</span>
      </div>
      <div className="hkd-lm-kanvas" aria-hidden="true">
        {garis.map((g) => (
          <div key={g.tahun} className="hkd-lm-tahun" style={{ left: g.kiri }}>
            <span>{g.tahun}</span>
          </div>
        ))}

        {/* Penghubung putus-putus dari TMT semula ke batang penundaan, di bawah label jalur atas */}
        <i className="hkd-lm-hubung" style={{ left: kiri(semula1.tmt) }} />

        {/* Jalur semula */}
        <p className="hkd-lm-jalur" style={{ top: 16 }}>Semula, tanpa hukuman</p>
        <i className="hkd-lm-garis" data-jalur="semula" style={{ left: kiri(data.acuan.tmt), width: `${x(ms(semula2.tmt)) - x(awal)}%`, top: 40 }} />
        <i className="hkd-lm-titik" data-jenis="acuan" style={{ left: kiri(data.acuan.tmt), top: 40 }} />
        <i className="hkd-lm-titik" data-jenis="semula" style={{ left: kiri(semula1.tmt), top: 40 }} />
        <i className="hkd-lm-titik" data-jenis="semula" data-nada={data.sejajar ? "hijau" : "kuning"} style={{ left: kiri(semula2.tmt), top: 40 }} />
        <div className="hkd-lm-baris" style={{ top: 52 }}>
          <Label kiri={kiri(data.acuan.tmt)} iso={data.acuan.tmt} t={data.acuan} sisi="kiri" tag={data.acuanBerjalan ? "KGB berjalan" : "KGB terakhir"} />
          <Label kiri={kiri(semula1.tmt)} iso={semula1.tmt} t={semula1} sisi="tengah" />
          <Label kiri={kiri(semula2.tmt)} iso={semula2.tmt} t={semula2} sisi="kanan" />
        </div>

        {/* Masa hukuman */}
        {adaPita && (
          <div className="hkd-lm-pita" style={{ left: `${x(hMulai).toFixed(2)}%`, width: `${lebarPita.toFixed(2)}%`, top: 108 }}>
            <span>Hukuman</span>
          </div>
        )}

        {/* Jalur sesudah dicatat: label KGB tertunda di bawah garis, label KGB berikutnya di atasnya agar tidak bertabrakan */}
        <p className="hkd-lm-jalur" style={{ top: 136 }}>Sesudah dicatat</p>
        <i className="hkd-lm-garis" data-jalur="sesudah" style={{ left: kiri(data.acuan.tmt), width: `${x(ms(kembali.tmt)) - x(awal)}%`, top: 184 }} />
        <div className="hkd-lm-tunda" style={{ left: kiri(semula1.tmt), width: `${lebarTunda.toFixed(2)}%`, top: 175 }}>
          <span>
            {lebarTunda >= 18 && <span className="hkd-lm-panjang">ditunda </span>}+{data.bulan}
            {lebarTunda >= 9 && " bln"}
          </span>
        </div>
        <i className="hkd-lm-titik" data-jenis="acuan" style={{ left: kiri(data.acuan.tmt), top: 184 }} />
        <i className="hkd-lm-titik" data-jenis="sesudah" style={{ left: kiri(tertunda.tmt), top: 184 }} />
        <i className="hkd-lm-titik" data-jenis="sesudah" data-nada={data.sejajar ? "hijau" : "kuning"} style={{ left: kiri(kembali.tmt), top: 184 }} />
        <div className="hkd-lm-baris" style={{ top: 196 }}>
          <Label kiri={kiri(tertunda.tmt)} iso={tertunda.tmt} t={tertunda} sisi="tengah" tag="Tertunda" />
        </div>
        <div className="hkd-lm-baris" data-atas="" style={{ top: 126 }}>
          <Label kiri={kiri(kembali.tmt)} iso={kembali.tmt} t={kembali} sisi="kanan" tag={data.sejajar ? "Kembali ke jalur" : "Berikutnya"} atas />
        </div>
      </div>

      <ul className="hkd-lm-ringkas">
        <li data-nada="kuning">
          Hukuman {tanggalPenuh(data.hukuman.mulai)}{data.hukuman.berakhir ? ` sampai ${tanggalPenuh(data.hukuman.berakhir)}` : ""}: KGB yang jatuh {bulanTahun(semula1.tmt)} ditunda {data.bulan} bulan menjadi {bulanTahun(tertunda.tmt)}.
        </li>
        <li>
          KGB tertunda {bulanTahun(tertunda.tmt)}: MKG {mkgTeks(data.acuan)} menjadi {mkgTeks(tertunda)} (penundaan dihitung penuh sebagai masa kerja), gaji{" "}
          {rupiah(data.acuan.gaji)} menjadi {rupiah(tertunda.gaji)}.
        </li>
        <li data-nada={data.sejajar ? "hijau" : "kuning"}>
          KGB berikutnya {bulanTahun(kembali.tmt)}: MKG {mkgTeks(kembali)}, gaji {rupiah(kembali.gaji)}.{" "}
          {data.sejajar
            ? "Kembali ke jalur semula; sama dengan bila tidak ada hukuman."
            : `Tidak sama dengan jalur semula (${bulanTahun(semula2.tmt)}, MKG ${mkgTeks(semula2)}); periksa data pegawai.`}
        </li>
      </ul>
    </div>
  );
}
