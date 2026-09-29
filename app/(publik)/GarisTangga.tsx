/* Motif anak tangga: garis yang naik bertahap, seperti gaji pokok yang naik setiap KGB. Dipakai sebagai
   nomor bagian (jumlah anak tangga = nomor bagian), garis kaki halaman, dan penanda di panduan. */
export default function GarisTangga({ anak = 4, className }: { anak?: number; className?: string }) {
  const lebar = 12;
  const tinggi = 4;
  const jalur = `M0 ${anak * tinggi}` + Array.from({ length: anak }, () => ` h${lebar} v-${tinggi}`).join("") + ` h${lebar}`;
  return (
    <svg
      className={className}
      viewBox={`0 -1 ${(anak + 1) * lebar} ${anak * tinggi + 2}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={jalur} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
