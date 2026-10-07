"use client";

import { LANGKAH_ISIAN, keadaanLangkah, type CekIsian, type NomorLangkah } from "./langkahIsian";

/**
 * Garis langkah isian data pegawai (ADR-083): lingkaran bernomor yang menjadi ✓ bila lengkap dan ! bila masih kurang,
 * langkah aktif disorot. Setiap langkah dapat diklik langsung.
 */
export function GarisLangkah({
  aktif,
  cek,
  onPilih,
  dikunjungi,
}: {
  aktif: NomorLangkah;
  cek: readonly CekIsian[];
  onPilih: (n: NomorLangkah) => void;
  /**
   * Langkah yang sudah dibuka. Langkah yang belum dibuka dan belum lengkap tampil netral (bernomor), bukan "!", supaya
   * formulir yang baru dibuka tidak tampak penuh kesalahan. Tanpa nilai ini semua langkah dianggap sudah dibuka.
   */
  dikunjungi?: ReadonlySet<number>;
}) {
  const sekarang = LANGKAH_ISIAN[aktif - 1];
  return (
    <nav className="lgk" aria-label="Langkah pengisian">
      <ol>
        {LANGKAH_ISIAN.map((l) => {
          const lengkap = keadaanLangkah(cek, l.n) === "lengkap";
          const k = lengkap ? "lengkap" : !dikunjungi || dikunjungi.has(l.n) ? "kurang" : "belum";
          const ini = aktif === l.n;
          return (
            <li key={l.n} data-aktif={ini ? "" : undefined} data-keadaan={k}>
              <button
                type="button"
                onClick={() => onPilih(l.n)}
                aria-current={ini ? "step" : undefined}
                aria-label={`Langkah ${l.n}: ${l.judul}, ${k === "lengkap" ? "lengkap" : k === "kurang" ? "masih kurang" : "belum dibuka"}`}
                title={l.ket}
              >
                <span className="lgk-bulat" aria-hidden="true">
                  {ini || k === "belum" ? l.n : k === "lengkap" ? "✓" : "!"}
                </span>
                <span className="lgk-judul">{l.judul}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="lgk-ket">
        <strong>
          Langkah {aktif} dari {LANGKAH_ISIAN.length}: {sekarang.judul}.
        </strong>{" "}
        {sekarang.ket}
      </p>
    </nav>
  );
}

/** Ringkasan langkah 5: tiap langkah lengkap atau apa yang masih kurang, dapat diklik untuk kembali ke sana. */
export function RingkasanLangkah({ cek, onPilih }: { cek: readonly CekIsian[]; onPilih: (n: NomorLangkah) => void }) {
  return (
    <ul className="lgk-ringkas">
      {LANGKAH_ISIAN.slice(0, 4).map((l) => {
        const kurang = cek.filter((c) => c.langkah === l.n && !c.ok);
        return (
          <li key={l.n} data-keadaan={kurang.length > 0 ? "kurang" : "lengkap"}>
            <button type="button" onClick={() => onPilih(l.n)}>
              <span className="lgk-bulat" aria-hidden="true">
                {kurang.length > 0 ? "!" : "✓"}
              </span>
              <span className="min-w-0">
                <strong>
                  {l.n}. {l.judul}
                </strong>
                <small>{kurang.length > 0 ? `Masih kurang: ${kurang.map((k) => k.label).join(", ")}` : "Lengkap"}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
