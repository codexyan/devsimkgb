"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/* Navigasi panduan: pemilih tugas pembaca dan daftar isi yang mengikuti posisi baca. Keduanya berbagi
   pilihan tugas lewat penyimpan kecil di modul ini, sehingga bagian yang relevan ikut ditandai di
   daftar isi tanpa perlu konteks React di halaman server. */

export interface BagianPanduan {
  id: string;
  judul: string;
}

interface Peran {
  id: string;
  label: string;
  /** Tautan yang disarankan, urut baca. `bagian` = id h2 induk untuk penanda di daftar isi. */
  tautan: { href: string; judul: string; bagian: string }[];
}

const PERAN: Peran[] = [
  {
    id: "upt",
    label: "Admin kepegawaian UPT",
    tautan: [
      { href: "#jadwal", judul: "Kapan KGB diberikan dan diusulkan", bagian: "jadwal" },
      { href: "#untuk-upt", judul: "Menyiapkan surat permohonan", bagian: "untuk-upt" },
      { href: "#contoh-kasus", judul: "Contoh kasus Rutan Rantau", bagian: "contoh-kasus" },
    ],
  },
  {
    id: "tu",
    label: "Tata Usaha Kanwil",
    tautan: [{ href: "#di-kanwil", judul: "Agenda dan disposisi", bagian: "di-kanwil" }],
  },
  {
    id: "sdm",
    label: "Tim SDM Kanwil",
    tautan: [
      { href: "#kewenangan", judul: "Siapa yang menetapkan KGB", bagian: "kewenangan" },
      { href: "#di-sim-kgb", judul: "Langkah Tim SDM di SIM-KGB", bagian: "di-sim-kgb" },
      { href: "#pengiriman-sk", judul: "Pengiriman SK dan KPPN mitra", bagian: "pengiriman-sk" },
    ],
  },
  {
    id: "keuangan",
    label: "Bagian keuangan",
    tautan: [
      { href: "#keuangan", judul: "Konfirmasi keuangan", bagian: "keuangan" },
      { href: "#pengiriman-sk", judul: "KPPN mitra satker", bagian: "pengiriman-sk" },
    ],
  },
  {
    id: "super",
    label: "Super Admin",
    tautan: [
      { href: "#kewenangan", judul: "Data penandatangan", bagian: "kewenangan" },
      { href: "#keadaan-khusus", judul: "Keadaan khusus", bagian: "di-sim-kgb" },
    ],
  },
  {
    id: "pegawai",
    label: "Pegawai",
    tautan: [
      { href: "#status", judul: "Arti status", bagian: "status" },
      { href: "#pertanyaan", judul: "Pertanyaan umum", bagian: "pertanyaan" },
    ],
  },
];

let peranTerpilih: string | null = null;
const pendengar = new Set<() => void>();

function pilihPeran(id: string | null) {
  peranTerpilih = id;
  pendengar.forEach((f) => f());
}

function usePeran() {
  return useSyncExternalStore(
    (cb) => {
      pendengar.add(cb);
      return () => pendengar.delete(cb);
    },
    () => peranTerpilih,
    () => null,
  );
}

export function PilihPeran() {
  const id = useId();
  const peran = usePeran();
  const aktif = PERAN.find((p) => p.id === peran) ?? null;

  return (
    <section className="pg-peran" aria-labelledby={`${id}-judul`}>
      <h2 id={`${id}-judul`} className="pg-peran-judul">
        Mulai dari tugas Anda
      </h2>
      <div className="pg-peran-pilihan" role="group" aria-label="Tugas pembaca">
        {PERAN.map((p) => (
          <button
            key={p.id}
            type="button"
            className="pg-peran-tombol"
            aria-pressed={peran === p.id}
            aria-controls={`${id}-saran`}
            onClick={() => pilihPeran(peran === p.id ? null : p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div id={`${id}-saran`} className="pg-peran-saran" aria-live="polite">
        {aktif ? (
          <ol key={aktif.id}>
            {aktif.tautan.map((t, i) => (
              <li key={t.href} style={{ "--i": i } as React.CSSProperties}>
                <a href={t.href}>
                  <span className="pg-peran-nomor" aria-hidden="true">
                    {i + 1}
                  </span>
                  {t.judul}
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p>Pilih tugas untuk melihat bagian yang perlu dibaca lebih dulu. Bagian itu juga ditandai di daftar isi.</p>
        )}
      </div>
    </section>
  );
}

export function DaftarIsiPanduan({ daftar }: { daftar: readonly BagianPanduan[] }) {
  const id = useId();
  const peran = usePeran();
  const relevan = new Set(PERAN.find((p) => p.id === peran)?.tautan.map((t) => t.bagian) ?? []);
  const [aktif, setAktif] = useState(daftar[0]?.id ?? "");
  const [bilahBuka, setBilahBuka] = useState(false);
  const daftarRef = useRef<HTMLOListElement>(null);
  const tandaRef = useRef<HTMLSpanElement>(null);

  // Bagian aktif: judul bagian terakhir yang sudah melewati pita atas layar.
  useEffect(() => {
    const judul = daftar.map((b) => document.getElementById(b.id)).filter((el): el is HTMLElement => !!el);
    if (judul.length === 0) return;
    let bingkai = 0;
    const periksa = () => {
      bingkai = 0;
      const batas = window.innerHeight * 0.3;
      let terakhir = judul[0].id;
      for (const el of judul) {
        if (el.getBoundingClientRect().top <= batas) terakhir = el.id;
      }
      setAktif(terakhir);
    };
    const saatGulir = () => {
      if (!bingkai) bingkai = requestAnimationFrame(periksa);
    };
    periksa();
    window.addEventListener("scroll", saatGulir, { passive: true });
    window.addEventListener("resize", saatGulir);
    return () => {
      cancelAnimationFrame(bingkai);
      window.removeEventListener("scroll", saatGulir);
      window.removeEventListener("resize", saatGulir);
    };
  }, [daftar]);

  // Penanda emas bergeser ke butir aktif di rel daftar isi.
  const letakkanTanda = useCallback(() => {
    const li = daftarRef.current?.querySelector<HTMLElement>(`[data-bagian="${aktif}"]`);
    const tanda = tandaRef.current;
    if (!li || !tanda) return;
    tanda.style.setProperty("--y", `${li.offsetTop}px`);
    tanda.style.setProperty("--h", `${li.offsetHeight}`);
  }, [aktif]);

  useLayoutEffect(() => {
    letakkanTanda();
  }, [letakkanTanda, peran]);

  // Tinggi butir berubah saat lebar layar berubah atau huruf serif selesai dimuat.
  useEffect(() => {
    const daftar = daftarRef.current;
    if (!daftar) return;
    const pengamat = new ResizeObserver(letakkanTanda);
    pengamat.observe(daftar);
    return () => pengamat.disconnect();
  }, [letakkanTanda]);

  const indeksAktif = Math.max(0, daftar.findIndex((b) => b.id === aktif));

  const butir = (b: BagianPanduan, i: number, tutup?: () => void) => (
    <li
      key={b.id}
      data-bagian={b.id}
      data-lewat={i < indeksAktif ? "1" : undefined}
      data-relevan={relevan.has(b.id) ? "1" : undefined}
    >
      <a href={`#${b.id}`} aria-current={b.id === aktif ? "location" : undefined} onClick={tutup}>
        <span className="pg-daftar-nomor" aria-hidden="true">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className="pg-daftar-teks">{b.judul}</span>
        {relevan.has(b.id) && <span className="pub-visually-hidden"> (disarankan untuk tugas Anda)</span>}
      </a>
    </li>
  );

  return (
    <>
      <nav className="pg-daftar" aria-label="Daftar isi">
        <p className="pg-daftar-judul">Daftar isi</p>
        <div className="pg-daftar-rel">
          <span className="pg-daftar-tanda" ref={tandaRef} aria-hidden="true" />
          <ol ref={daftarRef}>{daftar.map((b, i) => butir(b, i))}</ol>
        </div>
      </nav>

      <div className="pg-bilah" data-buka={bilahBuka ? "1" : "0"}>
        <button
          type="button"
          className="pg-bilah-tombol"
          aria-expanded={bilahBuka}
          aria-controls={`${id}-bilah`}
          onClick={() => setBilahBuka((v) => !v)}
        >
          <span className="pg-bilah-label">Daftar isi</span>
          <span className="pg-bilah-aktif">
            {String(indeksAktif + 1).padStart(2, "0")} {daftar[indeksAktif]?.judul}
          </span>
          <span className="pg-bilah-panah" aria-hidden="true" />
        </button>
        <span className="pg-bilah-kemajuan" aria-hidden="true" />
        <nav id={`${id}-bilah`} className="pg-bilah-daftar" aria-label="Daftar isi" inert={!bilahBuka}>
          <ol>{daftar.map((b, i) => butir(b, i, () => setBilahBuka(false)))}</ol>
        </nav>
      </div>
    </>
  );
}
