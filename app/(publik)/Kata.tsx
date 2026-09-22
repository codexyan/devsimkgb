import { Fragment } from "react";

/* Judul yang katanya naik satu per satu dari balik garis dasar. Pemisahan per kata (bukan per huruf)
   menjaga kerning huruf judul, dan teksnya tetap utuh untuk pembaca layar serta pencarian di halaman. */
export default function Kata({ teks, jeda = 0 }: { teks: string; jeda?: number }) {
  return (
    <>
      {teks.split(" ").map((kata, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="kt">
            <span className="kt-isi" style={{ "--i": i + jeda } as React.CSSProperties}>
              {kata}
            </span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
