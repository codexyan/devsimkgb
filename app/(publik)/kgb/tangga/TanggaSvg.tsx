import type { AnakLanskap } from "./tata";

/* Tangga gaji satu golongan sebagai grafik batang: satu batang per anak tangga, selebar rentang masa
   kerja berlakunya dan setinggi gaji pokoknya. Skala gaji sama untuk semua golongan (Rp1,5 juta sampai
   Rp6,5 juta) sehingga perbedaan antargolongan tetap terbaca saat golongan diganti. Grafik hanya jalur
   tambahan (aria-hidden): kursor dan sentuhan bisa memilih batang, tetapi kendali formulir di
   PenjelajahTangga tetap jalur utama untuk keyboard dan pembaca layar. */

const L = 640;
const T = 250;
const KIRI = 40;
const KANAN = 636;
const ATAS = 14;
const BAWAH = 214;
const CELAH = 3;
const MKG_MAKS = 34;
const GAJI_MIN = 1_500_000;
const GAJI_MAKS = 6_500_000;

const x = (mkg: number) => KIRI + (mkg / MKG_MAKS) * (KANAN - KIRI);
const y = (gaji: number) => BAWAH - ((gaji - GAJI_MIN) / (GAJI_MAKS - GAJI_MIN)) * (BAWAH - ATAS);
const skala = (gaji: number) => Math.max(0.02, (BAWAH - y(gaji)) / (BAWAH - ATAS));

interface Props {
  anak: readonly AnakLanskap[];
  sorot: number;
  onArah?: (indeks: number | null) => void;
  onPilih?: (indeks: number) => void;
}

export default function TanggaSvg({ anak, sorot, onArah, onPilih }: Props) {
  if (anak.length === 0) return null;
  const ujung = (i: number) => anak[i + 1]?.mkg ?? Math.min(anak[i].mkg + 2, MKG_MAKS);
  const iSorot = Math.min(sorot, anak.length - 1);
  const a = anak[iSorot];
  const tengahSorot = (x(a.mkg) + x(ujung(iSorot))) / 2;

  return (
    <svg
      className="tj-svg"
      viewBox={`0 0 ${L} ${T}`}
      aria-hidden="true"
      focusable="false"
      onPointerLeave={() => onArah?.(null)}
    >
      {[2, 4, 6].map((juta) => (
        <g key={juta} className="tj-sumbu">
          <line x1={KIRI} x2={KANAN} y1={y(juta * 1_000_000)} y2={y(juta * 1_000_000)} />
          <text x={KIRI - 10} y={y(juta * 1_000_000) + 4} textAnchor="end">
            {juta} jt
          </text>
        </g>
      ))}

      {anak.map((s, i) => {
        const x0 = x(s.mkg);
        const lebar = Math.max(1, x(ujung(i)) - x0 - CELAH);
        return (
          <g key={i}>
            <rect
              className="tj-batang"
              data-keadaan={i < iSorot ? "lewat" : i === iSorot ? "kini" : "nanti"}
              x={x0}
              y={ATAS}
              width={lebar}
              height={BAWAH - ATAS}
              rx={2}
              style={{ transform: `scaleY(${skala(s.gaji)})`, transitionDelay: `${i * 12}ms` }}
            />
            {/* Bidang sentuh setinggi grafik supaya batang pendek tetap mudah dituju */}
            <rect
              className="tj-sentuh"
              x={x0}
              y={ATAS}
              width={lebar + CELAH}
              height={BAWAH - ATAS}
              onPointerEnter={(e) => e.pointerType === "mouse" && onArah?.(i)}
              onClick={() => onPilih?.(i)}
            />
          </g>
        );
      })}

      <circle className="tj-titik" cx={tengahSorot} cy={y(a.gaji) - 11} r={4.5} />
      <line className="tj-dasar" x1={KIRI} x2={KANAN} y1={BAWAH} y2={BAWAH} />
      {[0, 8, 16, 24, 32].map((m) => (
        <text key={m} className="tj-mkg-label" x={x(m)} y={BAWAH + 26} textAnchor={m === 0 ? "start" : "middle"}>
          {m === 0 ? "MKG 0" : m}
        </text>
      ))}
    </svg>
  );
}
