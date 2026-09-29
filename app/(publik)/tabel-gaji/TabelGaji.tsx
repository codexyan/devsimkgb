"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { BarisTanggaGaji } from "@/lib/tabelGaji";
import { anakBerlaku, kelompokGolongan } from "../kgb/tangga/tata";

/* Tabel gaji pokok digital per golongan. Tab memilih golongan I sampai IV; isian masa kerja menandai sel
   yang berlaku di tiap kolom (MKG terbesar yang tidak melebihi masa kerja, sama dengan cara SIM-KGB
   menghitung). Mengeklik sel mengisi masa kerja itu; pengguna keyboard memakai isian yang sama. */

const ROMAWI = ["I", "II", "III", "IV"];
const angka = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const MKG_MAKS = 40;

export default function TabelGaji({ baris }: { baris: BarisTanggaGaji[] }) {
  const id = useId();
  const [kelompok, setKelompok] = useState(1);
  const [teksMkg, setTeksMkg] = useState("");
  const tabRef = useRef<(HTMLButtonElement | null)[]>([]);
  const wadahRef = useRef<HTMLDivElement>(null);

  const kolom = baris.filter((b) => kelompokGolongan(b.golongan) === kelompok);
  const daftarMkg = [...new Set(kolom.flatMap((b) => b.anak.map((a) => a.mkg)))].sort((a, b) => a - b);

  const mkg = teksMkg.trim() === "" ? null : Math.min(MKG_MAKS, Math.max(0, Math.floor(Number(teksMkg))));
  const mkgSah = mkg !== null && Number.isFinite(mkg);
  // null bila masa kerja masih di bawah anak tangga pertama ruang itu (I/b sampai II/d mulai di MKG 3).
  const berlaku = mkgSah ? kolom.map((b) => b.anak[anakBerlaku(b.anak, mkg)] ?? null) : [];

  // Ringkasan untuk pembaca layar, ditunda sampai pengetikan berhenti agar tidak dibacakan per huruf.
  const ringkasanKini = mkgSah
    ? `Pada masa kerja ${mkg} tahun: ${kolom
        .map((b, i) => {
          const a = berlaku[i];
          return a
            ? `${b.golongan} Rp${angka(a.gaji)}${a.mkg === mkg ? "" : ` pada MKG ${a.mkg}`}`
            : `${b.golongan} belum ada, mulai MKG ${b.anak[0].mkg}`;
        })
        .join("; ")}.`
    : "";
  const [ringkasan, setRingkasan] = useState("");
  useEffect(() => {
    const pewaktu = setTimeout(() => setRingkasan(ringkasanKini), 500);
    return () => clearTimeout(pewaktu);
  }, [ringkasanKini]);

  const pilihTab = (k: number) => {
    setKelompok(k);
    tabRef.current[k]?.focus();
  };

  const saatTombolTab = (e: KeyboardEvent<HTMLButtonElement>, k: number) => {
    const tujuan =
      e.key === "ArrowRight" ? (k + 1) % 4 : e.key === "ArrowLeft" ? (k + 3) % 4 : e.key === "Home" ? 0 : e.key === "End" ? 3 : -1;
    if (tujuan < 0) return;
    e.preventDefault();
    pilihTab(tujuan);
  };

  /* Baris yang dicari dibawa ke dalam pandangan hanya bila tabelnya memang bergulir sendiri (layar
     sempit); di layar lebar halaman tidak digeser saat pengguna sedang mengetik. */
  const gulirKeMkg = (nilai: number) => {
    const wadah = wadahRef.current;
    const tr = wadah?.querySelector<HTMLElement>(`tr[data-mkg="${nilai}"]`);
    if (!wadah || !tr || wadah.scrollHeight <= wadah.clientHeight) return;
    const kepala = wadah.querySelector<HTMLElement>("thead")?.offsetHeight ?? 0;
    const atas = tr.offsetTop - kepala - 8;
    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wadah.scrollTo({ top: Math.max(0, atas), behavior: kurangiGerak ? "auto" : "smooth" });
  };

  return (
    <div className="tb-alat">
      <div className="tb-kendali">
        <div className="tb-tab" role="tablist" aria-label="Golongan">
          {ROMAWI.map((r, k) => (
            <button
              key={r}
              ref={(el) => void (tabRef.current[k] = el)}
              type="button"
              role="tab"
              id={`${id}-tab-${k}`}
              aria-selected={kelompok === k}
              aria-controls={`${id}-panel`}
              tabIndex={kelompok === k ? 0 : -1}
              className="tb-tab-tombol"
              onClick={() => setKelompok(k)}
              onKeyDown={(e) => saatTombolTab(e, k)}
            >
              Golongan {r}
            </button>
          ))}
          <span className="tb-tab-tanda" style={{ "--k": kelompok } as React.CSSProperties} aria-hidden="true" />
        </div>

        <div className="tb-cari">
          <label htmlFor={`${id}-mkg`}>Masa kerja golongan</label>
          <div className="tb-cari-bidang">
            <input
              id={`${id}-mkg`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MKG_MAKS}
              placeholder="Tahun"
              value={teksMkg}
              onChange={(e) => {
                setTeksMkg(e.target.value);
                const n = Number(e.target.value);
                if (e.target.value === "" || !Number.isFinite(n)) return;
                gulirKeMkg(daftarMkg.filter((m) => m <= n).at(-1) ?? daftarMkg[0]);
              }}
            />
            <span aria-hidden="true">tahun</span>
            {teksMkg && (
              <button type="button" className="tb-cari-hapus" onClick={() => setTeksMkg("")}>
                Hapus
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="tb-hasil">
        {mkgSah ? (
          <>
            Pada masa kerja {mkg} tahun, gaji pokok yang berlaku:{" "}
            {kolom.map((b, i) => (
              <span key={b.golongan} className="tb-hasil-butir">
                <b>{b.golongan}</b>{" "}
                {berlaku[i] ? (
                  <>
                    Rp{angka(berlaku[i].gaji)}
                    {berlaku[i].mkg !== mkg && <span className="tb-hasil-mkg"> (MKG {berlaku[i].mkg})</span>}
                  </>
                ) : (
                  <span className="tb-hasil-mkg">belum ada, mulai MKG {b.anak[0].mkg}</span>
                )}
              </span>
            ))}
          </>
        ) : (
          "Isi masa kerja golongan atau klik sebuah sel untuk menandai gaji pokok yang berlaku di setiap ruang."
        )}
      </p>

      {/* Hasil dibacakan pembaca layar setelah pengetikan berhenti, bukan pada tiap huruf. */}
      <p className="pub-visually-hidden" aria-live="polite">
        {ringkasan}
      </p>

      <p className="tb-geser">Tabel dapat digeser ke samping untuk melihat kolom lainnya.</p>

      <div
        ref={wadahRef}
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${kelompok}`}
        className="tb-wadah"
        tabIndex={0}
      >
        <table key={kelompok} className="tb-tabel" data-kolom={kolom.length}>
          <caption className="pub-visually-hidden">
            Gaji pokok golongan {ROMAWI[kelompok]} dalam rupiah menurut masa kerja golongan
          </caption>
          <thead>
            <tr>
              <th scope="col" className="tb-mkg">
                MKG
              </th>
              {kolom.map((b) => (
                <th key={b.golongan} scope="col">
                  <span className="tb-kode">{b.golongan}</span>
                  <span className="tb-pangkat">{b.pangkat}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            onClick={(e) => {
              const sel = (e.target as HTMLElement).closest<HTMLElement>("td[data-gaji]");
              const tr = sel?.closest<HTMLElement>("tr[data-mkg]");
              if (tr) setTeksMkg(tr.dataset.mkg ?? "");
            }}
          >
            {daftarMkg.map((m) => (
              <tr key={m} data-mkg={m}>
                <th scope="row" className="tb-mkg">
                  {m}
                </th>
                {kolom.map((b, k) => {
                  const a = b.anak.find((x) => x.mkg === m);
                  const aktif = mkgSah && berlaku[k]?.mkg === m;
                  return (
                    <td key={b.golongan} data-k={k} data-gaji={a ? "1" : undefined} data-berlaku={aktif ? "1" : undefined}>
                      {a ? angka(a.gaji) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
