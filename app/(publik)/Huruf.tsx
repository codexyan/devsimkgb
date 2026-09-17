import { Fragment } from "react";

/* Judul yang hurufnya naik dari balik garis dasar katanya: motif gerak yang sama untuk judul panggung
   dan judul bagian. Pembaca layar membaca aria-label pada judul, bukan huruf-huruf terpisah. */
export default function Huruf({ teks, kelasKata, kelasHuruf, jeda = 0 }: {
  teks: string;
  kelasKata: string;
  kelasHuruf: string;
  jeda?: number;
}) {
  let urutan = jeda;
  return (
    <span aria-hidden="true">
      {teks.split(" ").map((kata, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className={kelasKata}>
            {Array.from(kata).map((h, j) => (
              <span key={j} className={kelasHuruf} style={{ "--i": urutan++ } as React.CSSProperties}>
                {h}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
