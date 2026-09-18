import type { BarisTanggaGaji } from "@/lib/tabelGaji";

/* Ilustrasi halaman masuk: tangga gaji golongan I/a, II/a, III/a, dan IV/a dari tabel gaji yang sama dengan
   SIM-KGB, digambar sebagai garis yang tergores satu per satu. SVG ringan, tanpa WebGL, karena halaman ini
   dibuka petugas setiap hari. */

const L = 520;
const T = 300;
const MKG_MAKS = 34;
const GAJI_MIN = 1_500_000;
const GAJI_MAKS = 6_500_000;

const x = (mkg: number) => (mkg / MKG_MAKS) * L;
const y = (gaji: number) => T - ((gaji - GAJI_MIN) / (GAJI_MAKS - GAJI_MIN)) * T;

export default function TanggaMasuk({ baris }: { baris: BarisTanggaGaji[] }) {
  const pilihan = ["I/a", "II/a", "III/a", "IV/a"]
    .map((g) => baris.find((b) => b.golongan === g))
    .filter((b): b is BarisTanggaGaji => !!b);

  return (
    <figure className="lg-tangga">
      <svg viewBox={`-8 -12 ${L + 60} ${T + 24}`} aria-hidden="true" focusable="false">
        {pilihan.map((b, i) => {
          const d =
            `M${x(b.anak[0].mkg)} ${y(b.anak[0].gaji).toFixed(1)}` +
            b.anak
              .map((a, j) => {
                const ujung = b.anak[j + 1]?.mkg ?? Math.min(a.mkg + 2, MKG_MAKS);
                const naik = b.anak[j + 1] ? ` V${y(b.anak[j + 1].gaji).toFixed(1)}` : "";
                return ` H${x(ujung).toFixed(1)}${naik}`;
              })
              .join("");
          const akhir = b.anak[b.anak.length - 1];
          const xAkhir = x(Math.min(akhir.mkg + 2, MKG_MAKS));
          return (
            <g key={b.golongan} className="lg-tangga-baris" style={{ "--i": i } as React.CSSProperties}>
              <path d={d} pathLength={1} />
              <text x={xAkhir + 10} y={y(akhir.gaji) + 4}>
                {b.golongan}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>Gaji pokok golongan I/a sampai IV/a sepanjang masa kerja, PP Nomor 5 Tahun 2024.</figcaption>
    </figure>
  );
}
