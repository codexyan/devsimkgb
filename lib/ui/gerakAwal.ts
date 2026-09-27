// Bagian pilihan animasi yang dipakai server (app/layout.tsx): kunci penyimpanan dan skrip awal yang memasang
// html[data-gerak] sebelum halaman dilukis. Logika peramban ada di lib/ui/gerak.ts.

export const KUNCI_GERAK = "kgb-gerak";
export const KUERI_KURANGI_GERAK = "(prefers-reduced-motion: reduce)";

export const SKRIP_GERAK_AWAL = `try{var g=localStorage.getItem("${KUNCI_GERAK}");document.documentElement.setAttribute("data-gerak",g==="nyala"?"gerak":g==="kurangi"?"kurangi":(matchMedia("${KUERI_KURANGI_GERAK}").matches?"kurangi":"gerak"))}catch(e){}`;
