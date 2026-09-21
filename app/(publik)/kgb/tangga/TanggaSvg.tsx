import type { AnakLanskap } from "./tata";

/* Tangga gaji satu golongan sebagai grafik SVG. Tampil lebih dulu selagi lanskap 3D dimuat, dan
   menggantikannya bila WebGL tidak tersedia. Skala gaji sama untuk semua golongan (Rp1,5 juta
   sampai Rp6,5 juta) sehingga perbedaan antargolongan tetap terbaca saat golongan diganti. */

const L = 640;
const T = 400;
const KIRI = 56;
const KANAN = 620;
const ATAS = 28;
const BAWAH = 352;
const MKG_MAKS = 34;
const GAJI_MIN = 1_500_000;
const GAJI_MAKS = 6_500_000;

const x = (mkg: number) => KIRI + (mkg / MKG_MAKS) * (KANAN - KIRI);
const y = (gaji: number) => BAWAH - ((gaji - GAJI_MIN) / (GAJI_MAKS - GAJI_MIN)) * (BAWAH - ATAS);

export default function TanggaSvg({ anak, sorot }: { anak: readonly AnakLanskap[]; sorot: number }) {
  if (anak.length === 0) return null;
  const ujung = (i: number) => anak[i + 1]?.mkg ?? Math.min(anak[i].mkg + 2, MKG_MAKS);
  const jalur =
    `M${x(anak[0].mkg)} ${BAWAH}` +
    anak.map((a, i) => ` V${y(a.gaji).toFixed(1)} H${x(ujung(i)).toFixed(1)}`).join("") +
    ` V${BAWAH} Z`;
  const a = anak[Math.min(sorot, anak.length - 1)];
  const iSorot = Math.min(sorot, anak.length - 1);

  return (
    <svg className="tg-svg" viewBox={`0 0 ${L} ${T}`} aria-hidden="true" focusable="false">
      {[2, 4, 6].map((juta) => (
        <g key={juta} className="tg-svg-sumbu">
          <line x1={KIRI} x2={KANAN} y1={y(juta * 1_000_000)} y2={y(juta * 1_000_000)} />
          <text x={KIRI - 10} y={y(juta * 1_000_000) + 4} textAnchor="end">
            {juta} jt
          </text>
        </g>
      ))}
      <path className="tg-svg-luas" d={jalur} />
      <rect
        className="tg-svg-sorot"
        x={x(a.mkg)}
        y={y(a.gaji)}
        width={x(ujung(iSorot)) - x(a.mkg)}
        height={BAWAH - y(a.gaji)}
      />
      <line className="tg-svg-dasar" x1={KIRI} x2={KANAN} y1={BAWAH} y2={BAWAH} />
      {[0, 8, 16, 24, 32].map((m) => (
        <text key={m} className="tg-svg-mkg" x={x(m)} y={BAWAH + 26} textAnchor="middle">
          {m === 0 ? "MKG 0" : m}
        </text>
      ))}
    </svg>
  );
}
