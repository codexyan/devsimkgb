"use client";

/* Lambang IMIPAS dari ribuan titik (three.js), mengikuti panggung portal SDM Pas Kalsel.
   Titik-titik terbang dari awan dan merakit lambang tepat di kotak jangkar (.pb-logo), lalu
   terurai saat halaman digulir. Gambar /icons.svg di jangkar tetap tampil bila WebGL tidak ada.
   Bentuk diambil dari path icons.svg; tiap bagian diberi kode warna saat dirasterisasi:
   1 badan tabung, 2 tudung, 3 padi dan kapas, 4 detail garis dan titik. */

import { useEffect, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  Matrix3,
  Matrix4,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";

type Rgb = [number, number, number];

const PATH_BADAN =
  "M39.373 36.5C39.373 31.845 45.541 22.548 70.186 22.501C94.830 22.548 101 31.845 101 36.5V84.5C101 89.5 88 93 70.186 93C52.4 93 39.373 89.5 39.373 84.5Z";
const PATH_TUDUNG =
  "M70.373 0.0400391C73.2225 0.433241 80.7941 3.3179 86.999 10C93.499 17 104.499 19.0001 111.499 34.5C118.499 50 118.499 72 100.999 84.5V36.5C100.999 31.845 94.8303 22.5476 70.1855 22.501C45.5414 22.5478 39.373 31.8451 39.373 36.5V84.5C21.873 72 21.873 50 28.873 34.5C35.873 19.0002 46.8731 17 53.373 10C59.578 3.3178 67.1498 0.43311 69.999 0.0400391V0C70.0581 0.00393764 70.1204 0.00966717 70.1855 0.0166016C70.2509 0.00963024 70.3137 0.00395224 70.373 0V0.0400391Z";
const PATH_PADI =
  "M69.9999 107.5C70.8332 98 76.8999 80.4 94.4999 86C91.4999 87.5 85.9999 92.5 85.4999 96.5C84.9999 100.5 79.4999 103.5 76.4999 104.5C77.7692 100.269 78.3224 96.3961 80.5833 94.6989C76.2977 97.0141 75.2223 99.7867 72.4999 107.5C76.4999 107.5 85.4999 106 102 98.5C100.5 94.5 102 84 108 84.5C108.5 87.5 106 94.5 104 97C108 94 116.5 87.5 120 79C116 77.5 113 74 116.5 67.5C116 64.5 122 57.5 126.5 66.5C127.5 64.5 129 57.5 128.5 56C126.5 56.5 119.5 55 118.5 48C117.5 41 126.5 43.5 128.5 52.5V47.5C127 46.3333 124.5 42.8 126.5 38C126 36.5 124.5 34 124 33C121.5 33.5 116 34.5 114 31.5C112 28.5 111.5 21.5 120.5 27C119 24 114 18 112.5 17C110.5 17.5 101 16.5 98.4999 11.5C95.9999 6.5 97.4999 4.5 102.5 5C107.5 5.5 112.5 9 113.5 15C115 16.5 120.5 22.5 121 23.5C119.5 19 120.5 6 127.5 15C128.5 17.5 131 18.5 123 27C124.5 30 127 34.5 127.5 35.5C128.5 33 137 29.5 137.5 39C138.5 40.5 141 47 130.5 49C130.5 51.5 131.5 56.5 130 62.5C132 59.5 136 56 139 58C142 60 141 64 137.5 66.5C134 69 129.5 69 128.5 67.5C128.5 70.5 127 75 124.5 77.5C129 75.5 134.5 74 135.5 76.5C136.5 79 134.5 84.5 130.5 86C126.5 87.5 121.5 88 119 86C117.5 88 113 93 111 94.5C115 93.5 117 92 121 94.5C118 97 116 99.5 107.5 97C104 99 97.9999 103 97.4999 103.5C101 103.5 107 103 110 105C107.5 107.5 100.5 111.5 92.4999 106C88.4999 108 78.9999 113 58.9999 111.5C38.9999 110 23.9999 96.5 18.4999 88.5C14.9999 89 6.99991 87.5 3.99991 80.5C1.59991 74.9 1.66657 74.1667 1.99991 74.5C4.49994 74.3333 11 76.3 17 85.5C15 81 13 76 12.5 74C11 74.5 2 74 0 59.5C2 60 9 64 12 71C10.5 66 9.5 62 9.5 60C7.5 60 -1.50018 57 1.99991 44C3.5 45 8.14688 47 9.5 57C9.5 52.5 9.5 47.5 10 46.5C7.5 45.5 0.5 39.5 5.5 31C6.5 31.5 11.4905 35.6198 10.5 44.5C12 39 13 35 13.5 34C11.5 32.5 6 27.5 12.5 18.5C14 19.5 15.5 24.5 14.5 32C15.5 28.5 18 24 19 23C17.5 22 13.5 17 21 10C22.3753 12.7505 21.649 19.7041 20.748 21.6122C24.1405 16.3349 27 12.9526 27 11C27 9 33.5 3.5 38.5 3C35.5 8.5 31.5 15 28.5 16.5C25.5 18 22 21.5 22 22C27.5 18.5 30.5 16 34 16C32 20 31 24.5 20.5 24.5C19.5 26 16.5 30 16 32C19 29 24.5 26 28 26C27 29 25 35 15 35C13.5 37.5 12.5 42.5 12.5 44C14.5 40.5 18.5 36 24 35.5C23 39 20 46.5 12 47.5C11.5 49.5 11 56.5 11 57.5C13 52.5 17 46.5 21.5 45.5C21.5 50.5 18 59 12 60C11 62 12.5 70 13 70.5C13.5 65.5 14.5 59.5 20.5 57C21.5 61 21 70 14.5 73.5C14.5 76 17.4998 83.5 18.4999 84.5C18 79 17.5 71.5 23 68C23.5 70 29.5 81 21 87C22.5 90 35.5 105 55.5 106.5C52 101.5 45.5 94.5 42 94.5C47 92.5 64.4998 87 69.9999 107.5Z";
const PATH_GARIS = [
  "M44 56V52.5C50 57.5 67.5 58 71.5 58C75.5 59.5 73.5 63 71.5 63C51.9 63 45 58.3333 44 56Z",
  "M44 70.5V67C50 72 67.5 72.5 71.5 72.5C75.5 74 73.5 77.5 71.5 77.5C51.9 77.5 45 72.8333 44 70.5Z",
];
const TITIK_DETAIL = [
  { cx: 90, cy: 51.5, r: 4.5 },
  { cx: 90, cy: 65.5, r: 4.5 },
  { cx: 80.5, cy: 53, r: 3 },
  { cx: 80.5, cy: 67, r: 3 },
];
// Bobot kepadatan titik per bagian (indeks = kode warna).
const BOBOT_BAGIAN = [0, 0.38, 1.7, 1.3, 2.4];
// Resolusi rasterisasi: viewBox lambang 141 x 112 diperbesar lima kali.
const SKALA = 5;
const LEBAR = 141 * SKALA;
const TINGGI = 112 * SKALA;

const rgb = (hex: number): Rgb => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const campur = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const batas = (n: number, min = 0, maks = 1) => Math.min(maks, Math.max(min, n));

function acakNormal() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

const VERTEX = /* glsl */ `
  uniform float uWaktu;
  uniform float uRakit;
  uniform float uLewat;
  uniform float uUkuran;
  uniform float uRasio;
  uniform float uSkala;
  uniform float uSapu;
  uniform mat3 uPutar;
  uniform vec3 uGeser;

  attribute vec3 aAwal;
  attribute vec3 aLepas;
  attribute float aTunda;
  attribute float aJenis;
  attribute vec3 aAcak;
  attribute vec3 aWarna;

  varying vec3 vWarna;
  varying float vAlfa;

  const float DURASI = 1.60;

  vec3 arus(vec3 p, float t) {
    return vec3(
      sin(p.y * 1.9 + t * 0.35) + sin(p.z * 1.3 - t * 0.27),
      sin(p.z * 1.7 + t * 0.31) + sin(p.x * 1.1 - t * 0.22),
      sin(p.x * 1.5 - t * 0.29) + sin(p.y * 2.3 + t * 0.19)
    ) * 0.5;
  }

  void main() {
    float t = clamp((uRakit - aTunda) / DURASI, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 4.0);
    vec3 p;
    float alfa;
    float ukuran;

    if (aJenis < 0.5) {
      // Debu cahaya di sekitar lambang.
      p = position + arus(position * 1.7 + aAcak * 6.0, uWaktu) * 0.05;
      p.y += sin(uWaktu * (0.2 + aAcak.y * 0.25) + aAcak.x * 6.2831) * 0.03;
      alfa = (0.16 + aAcak.z * 0.32) * smoothstep(0.0, 1.0, t);
      ukuran = 0.55 + aAcak.z * 1.0;
    } else {
      // Terbang dari awan ke tempatnya sambil berpusar; pusaran mereda saat titik tiba.
      float sisa = 1.0 - e;
      p = mix(aAwal, position, e);
      float putar = sisa * sisa * (1.8 + aAcak.x * 1.6) * (aAcak.y > 0.5 ? 1.0 : -1.0);
      float c = cos(putar);
      float s = sin(putar);
      p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      p += arus(position * 6.0 + aAcak, uWaktu) * 0.0032 * e;

      alfa = aJenis > 3.5 ? 0.96 : aJenis > 2.5 ? 0.92 : aJenis > 1.5 ? 0.9 : 0.55;
      alfa *= (0.82 + aAcak.z * 0.18) * smoothstep(0.0, 0.3, t);
      ukuran = (aJenis > 3.5 ? 1.08 : aJenis < 1.5 ? 0.82 : 1.0) * (0.72 + aAcak.z * 0.58);
    }

    // Terurai saat digulir.
    float g = smoothstep(0.0, 1.0, uLewat);
    p += aLepas * g * (0.5 + aAcak.y * 0.9);
    alfa *= 1.0 - smoothstep(0.12, 0.75, uLewat) * (0.7 + aAcak.z * 0.3);

    // Kilau yang menyapu lambang sekali setelah selesai dirakit.
    vec3 warna = aWarna;
    if (aJenis > 0.5) {
      float pita = position.x * 0.62 + position.y * 0.78;
      float kilau = exp(-pow((pita - uSapu) / 0.075, 2.0)) * e;
      vec3 terang = (aJenis > 2.5 && aJenis < 3.5) ? vec3(1.0, 0.9, 0.55) : vec3(0.5, 0.76, 1.0);
      warna = mix(aWarna, terang, kilau * 0.7);
      ukuran *= 1.0 + kilau * 0.55;
    }

    vec3 dunia = uPutar * (p * uSkala) + uGeser;
    vec4 mv = modelViewMatrix * vec4(dunia, 1.0);
    gl_Position = projectionMatrix * mv;

    float d = -mv.z;
    alfa *= 0.9 + 0.1 * sin(uWaktu * (0.6 + aAcak.y * 1.4) + aAcak.x * 6.2831);
    float px = min(ukuran * uUkuran * uRasio / max(d, 0.001), 40.0);
    alfa *= clamp(px / 1.2, 0.0, 1.0);
    gl_PointSize = max(px, 1.2);

    vWarna = warna;
    vAlfa = alfa;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vWarna;
  varying float vAlfa;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d) * vAlfa;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vWarna, a);
  }
`;

/** Geometri titik lambang; null bila kanvas 2D tidak tersedia. */
function buatGeometri(jumlahLambang: number, jumlahDebu: number): BufferGeometry | null {
  const kanvas = document.createElement("canvas");
  kanvas.width = LEBAR;
  kanvas.height = TINGGI;
  const ctx = kanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.scale(SKALA, SKALA);
  const isi = (kode: number, path: Path2D, aturan: CanvasFillRule = "nonzero") => {
    ctx.fillStyle = `rgb(${kode},0,0)`;
    ctx.fill(path, aturan);
  };
  isi(1, new Path2D(PATH_BADAN));
  isi(2, new Path2D(PATH_TUDUNG), "evenodd");
  isi(3, new Path2D(PATH_PADI));
  const elips = new Path2D();
  elips.ellipse(70, 37, 26.5, 9, 0, 0, 2 * Math.PI);
  isi(4, elips);
  for (const d of PATH_GARIS) isi(4, new Path2D(d));
  for (const t of TITIK_DETAIL) {
    const lingkaran = new Path2D();
    lingkaran.arc(t.cx, t.cy, t.r, 0, 2 * Math.PI);
    isi(4, lingkaran);
  }

  const data = ctx.getImageData(0, 0, LEBAR, TINGGI).data;
  const piksel: number[][] = [[], [], [], [], []];
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 250) continue;
    const kode = data[i];
    if (kode >= 1 && kode <= 4) piksel[kode].push(p);
  }

  const bobot = piksel.map((daftar, kode) => daftar.length * BOBOT_BAGIAN[kode]);
  const totalBobot = bobot.reduce((a, b) => a + b, 0) || 1;
  const kuota = bobot.map((b) => Math.round((jumlahLambang * b) / totalBobot));
  const kapasitas = kuota.reduce((a, b) => a + b, 0) + jumlahDebu;

  const posisi = new Float32Array(3 * kapasitas);
  const awal = new Float32Array(3 * kapasitas);
  const lepas = new Float32Array(3 * kapasitas);
  const tunda = new Float32Array(kapasitas);
  const jenis = new Float32Array(kapasitas);
  const acak = new Float32Array(3 * kapasitas);
  const warna = new Float32Array(3 * kapasitas);

  const NAVY_TUA = rgb(0x0f254a);
  const NAVY = rgb(0x1274ba);
  const EMAS = rgb(0xf9c02a);
  const JINGGA = rgb(0xda7f00);
  const DETAIL = rgb(0x103865);
  const BADAN_A = rgb(0xc6d6ea);
  const BADAN_B = rgb(0xdfe8f3);

  let n = 0;
  const tambah = (x: number, y: number, z: number, w: Rgb, kode: number, jeda: number) => {
    posisi.set([x, y, z], 3 * n);
    warna.set(w, 3 * n);
    jenis[n] = kode;
    tunda[n] = jeda;
    acak.set([Math.random(), Math.random(), Math.random()], 3 * n);
    // Titik awal di awan sekitar lambang.
    const s = 2 * Math.random() - 1;
    const sudut = Math.random() * Math.PI * 2;
    const jari = 0.8 + 1.5 * Math.random();
    const h = Math.sqrt(1 - s * s);
    awal.set([0.25 * x + Math.cos(sudut) * h * jari * 1.25, 0.25 * y + Math.sin(sudut) * h * jari, s * jari * 0.7 + 0.25], 3 * n);
    // Arah terurai saat digulir.
    const panjang = Math.hypot(x, y) || 1;
    const kuat = 0.3 + 0.8 * Math.random();
    lepas.set(
      [(x / panjang) * kuat * 0.8 + 0.16 * acakNormal(), Math.abs(y / panjang) * kuat * 0.35 + 0.5 + 0.55 * Math.random(), 0.3 + Math.random()],
      3 * n,
    );
    n++;
  };

  for (let kode = 1; kode <= 4; kode++) {
    const daftar = piksel[kode];
    if (daftar.length === 0) continue;
    for (let i = 0; i < kuota[kode]; i++) {
      const p = daftar[(Math.random() * daftar.length) | 0];
      const px = ((p % LEBAR) + Math.random()) / SKALA;
      const py = (Math.floor(p / LEBAR) + Math.random()) / SKALA;
      const x = (px - 70.2) / 112;
      const y = -(py - 56) / 112;
      const u = (px - 70.19) / 30.8135;
      const lengkung = Math.sqrt(Math.max(0, 1 - u * u));
      if (kode === 1) {
        tambah(x, y, (0.015 + 0.08 * lengkung + (Math.random() - 0.5) * 0.006) * 1.7, campur(BADAN_A, BADAN_B, Math.random()), 1, 0.3 + ((py - 22) / 71) * 0.45 + 0.12 * Math.random());
      } else if (kode === 2) {
        const v = (px - 70.2) / 46;
        const w = campur(NAVY_TUA, NAVY, batas(((px - 57.5) * 48.5 + (py + 17) * 104.5) / 13272.5)).map((c) => c * (0.94 + 0.12 * Math.random())) as Rgb;
        tambah(x, y, (0.03 * Math.max(0, 1 - v * v) + (Math.random() - 0.5) * 0.035) * 1.7, w, 2, 0.05 + (py / 85) * 0.6 + 0.12 * Math.random());
      } else if (kode === 3) {
        const z = (0.035 + (Math.random() - 0.5) * 0.05 + (py / 112) * 0.03) * 1.7;
        const w = campur(EMAS, JINGGA, batas((py - 3) / 108.78)).map((c) => Math.min(1, c * (0.95 + 0.1 * Math.random()))) as Rgb;
        const sudut = Math.atan2(py - 56, px - 70.2);
        const jarakSudut = Math.abs(Math.atan2(Math.sin(sudut - Math.PI / 2), Math.cos(sudut - Math.PI / 2))) / Math.PI;
        tambah(x, y, z, w, 3, 1 + 1.25 * jarakSudut + 0.1 * Math.random());
      } else {
        const w = DETAIL.map((c) => c * (0.92 + 0.16 * Math.random())) as Rgb;
        const jeda = (py < 47 ? 0.8 : px > 76 ? 1.15 : 0.95 + ((px - 44) / 30) * 0.2) + 0.12 * Math.random();
        tambah(x, y, (0.028 + 0.08 * lengkung) * 1.7, w, 4, jeda);
      }
    }
  }

  const DEBU_EMAS = rgb(0xd9a441);
  const DEBU_BIRU = rgb(0x7fa6d8);
  for (let i = 0; i < jumlahDebu; i++) {
    const sudut = Math.random() * Math.PI * 2;
    const jari = 0.55 + 0.75 * Math.random();
    tambah(Math.cos(sudut) * jari * 1.2, Math.sin(sudut) * jari * 0.9, (Math.random() - 0.5) * 1.1, Math.random() < 0.45 ? DEBU_EMAS : DEBU_BIRU, 0, 0.6 + 2.2 * Math.random());
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(posisi.subarray(0, 3 * n), 3));
  geo.setAttribute("aAwal", new BufferAttribute(awal.subarray(0, 3 * n), 3));
  geo.setAttribute("aLepas", new BufferAttribute(lepas.subarray(0, 3 * n), 3));
  geo.setAttribute("aTunda", new BufferAttribute(tunda.subarray(0, n), 1));
  geo.setAttribute("aJenis", new BufferAttribute(jenis.subarray(0, n), 1));
  geo.setAttribute("aAcak", new BufferAttribute(acak.subarray(0, 3 * n), 3));
  geo.setAttribute("aWarna", new BufferAttribute(warna.subarray(0, 3 * n), 3));
  return geo;
}

function posisiDalam(el: HTMLElement, leluhur: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== leluhur) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

// Waktu rakit (detik) saat kilau mulai menyapu, lama sapuan, dan batas animasi awal.
const SAPU_MULAI = 3.9;
const SAPU_LAMA = 1.8;
const RAKIT_SELESAI = SAPU_MULAI + SAPU_LAMA;

export default function LogoPartikel({ jangkar, onSiap }: { jangkar: string; onSiap?: () => void }) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const onSiapRef = useRef(onSiap);

  useEffect(() => {
    onSiapRef.current = onSiap;
  }, [onSiap]);

  useEffect(() => {
    const wadah = wadahRef.current;
    const lapis = wadah?.closest<HTMLElement>(".pb-lapis");
    const logo = lapis?.querySelector<HTMLElement>(jangkar);
    if (!wadah || !lapis || !logo) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
    const kanvas = renderer.domElement;
    kanvas.setAttribute("aria-hidden", "true");
    wadah.appendChild(kanvas);

    const geraknyaDikurangi = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kursorHalus = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const tinggiJangkar = Math.max(120, logo.offsetHeight);
    const geometri = buatGeometri(
      Math.round(batas(15500 * Math.pow(tinggiJangkar / 340, 2), 6500, 17000)),
      tinggiJangkar < 220 ? 160 : 380,
    );
    if (!geometri) {
      renderer.dispose();
      kanvas.remove();
      return;
    }

    const adegan = new Scene();
    const kamera = new PerspectiveCamera(30, 1, 0.05, 60);
    kamera.position.set(0, 0, 9);
    const tinggiDunia = 2 * Math.tan((Math.PI / 180) * 15) * 9;

    const uniform = {
      uWaktu: { value: 0 },
      uRakit: { value: geraknyaDikurangi ? 99 : 0 },
      uLewat: { value: 0 },
      uUkuran: { value: 20 },
      uRasio: { value: 1 },
      uSkala: { value: 1 },
      uSapu: { value: 9 },
      uPutar: { value: new Matrix3() },
      uGeser: { value: new Vector3() },
    };
    const material = new ShaderMaterial({
      uniforms: uniform,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
    });
    const titik = new Points(geometri, material);
    titik.frustumCulled = false;
    adegan.add(titik);

    const letak = { x: 0, y: 0, skala: 1 };
    const ukur = () => {
      const lebar = Math.max(1, wadah.clientWidth);
      const tinggi = Math.max(1, wadah.clientHeight);
      const rasio = Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(rasio);
      renderer.setSize(lebar, tinggi, false);
      kamera.aspect = lebar / tinggi;
      kamera.updateProjectionMatrix();
      const kotak = posisiDalam(logo, lapis);
      const perPiksel = tinggiDunia / tinggi;
      letak.x = (kotak.x + kotak.w / 2 - lebar / 2) * perPiksel;
      letak.y = (tinggi / 2 - (kotak.y + kotak.h / 2)) * perPiksel;
      letak.skala = kotak.h * perPiksel;
      uniform.uRasio.value = rasio;
      uniform.uUkuran.value = 20.7 * Math.pow(Math.max(kotak.h, 100) / 320, 0.45);
    };

    const kursor = { x: 0, y: 0, tx: 0, ty: 0 };
    const euler = new Euler();
    const matriks = new Matrix4();
    let lewat = 0;
    const perbaruiUniform = () => {
      const t = uniform.uWaktu.value;
      euler.set(-(0.2 * kursor.y) + 0.035 * Math.sin(0.19 * t) + 0.4 * lewat, 0.38 * kursor.x + 0.12 * Math.sin(0.23 * t), 0.015 * Math.sin(0.17 * t), "YXZ");
      uniform.uPutar.value.setFromMatrix4(matriks.makeRotationFromEuler(euler));
      uniform.uGeser.value.set(letak.x, letak.y + 0.012 * Math.sin(0.6 * t) * letak.skala + lewat * letak.skala * 0.3, 0.6 * lewat);
      uniform.uSkala.value = letak.skala;
      uniform.uLewat.value = lewat;
    };

    let siap = false;
    const gambar = () => {
      renderer.render(adegan, kamera);
      if (!siap) {
        siap = true;
        wadah.dataset.siap = "1";
        onSiapRef.current?.();
      }
    };

    // Animasi berjalan selama lambang dirakit, lalu hanya saat ada gulir atau gerak kursor,
    // sehingga tidak ada putaran tanpa henti yang menghabiskan baterai.
    let bingkai = 0;
    let berjalan = false;
    let waktuSebelum = 0;
    let aktifSampai = 0;
    let konteksHilang = false;
    const bolehJalan = () =>
      !konteksHilang && !document.hidden && window.scrollY <= (wadah.clientHeight || window.innerHeight) + 40;

    const langkah = (sekarang: number) => {
      bingkai = 0;
      const dt = waktuSebelum ? Math.min(0.05, (sekarang - waktuSebelum) / 1000) : 1 / 60;
      waktuSebelum = sekarang;
      uniform.uWaktu.value += dt;
      uniform.uRakit.value += dt;
      const sapu = uniform.uRakit.value - SAPU_MULAI;
      uniform.uSapu.value = sapu > 0 && sapu < SAPU_LAMA ? -0.95 + (sapu / SAPU_LAMA) * 1.9 : 9;
      if (!kursorHalus) {
        kursor.tx = 0;
        kursor.ty = 0;
      }
      const redam = 1 - Math.exp(-2.6 * dt);
      kursor.x += (kursor.tx - kursor.x) * redam;
      kursor.y += (kursor.ty - kursor.y) * redam;
      const target = batas(window.scrollY / (0.8 * (wadah.clientHeight || window.innerHeight)));
      lewat += (target - lewat) * (1 - Math.exp(-5 * dt));
      perbaruiUniform();
      gambar();
      const masihRakit = uniform.uRakit.value < RAKIT_SELESAI;
      const masihBergerak = sekarang < aktifSampai || Math.abs(target - lewat) > 0.001;
      if (bolehJalan() && (masihRakit || masihBergerak)) {
        bingkai = requestAnimationFrame(langkah);
      } else {
        berjalan = false;
        waktuSebelum = 0;
      }
    };
    const mulai = () => {
      aktifSampai = performance.now() + 1500;
      if (!geraknyaDikurangi && !berjalan && bolehJalan()) {
        berjalan = true;
        waktuSebelum = 0;
        bingkai = requestAnimationFrame(langkah);
      }
    };
    const gambarDiam = () => {
      uniform.uWaktu.value = 10;
      perbaruiUniform();
      gambar();
    };

    ukur();
    const pengamat = new ResizeObserver(() => {
      ukur();
      if (geraknyaDikurangi) gambarDiam();
      else if (!berjalan) {
        perbaruiUniform();
        gambar();
      }
    });
    pengamat.observe(wadah);
    pengamat.observe(logo);

    const saatKursor = (e: PointerEvent) => {
      kursor.tx = (e.clientX / window.innerWidth) * 2 - 1;
      kursor.ty = (e.clientY / window.innerHeight) * 2 - 1;
      mulai();
    };
    const saatKonteksHilang = (e: Event) => {
      e.preventDefault();
      konteksHilang = true;
      cancelAnimationFrame(bingkai);
      berjalan = false;
    };

    if (geraknyaDikurangi) {
      gambarDiam();
    } else {
      if (kursorHalus) window.addEventListener("pointermove", saatKursor, { passive: true });
      window.addEventListener("scroll", mulai, { passive: true });
      document.addEventListener("visibilitychange", mulai);
      mulai();
    }
    kanvas.addEventListener("webglcontextlost", saatKonteksHilang);

    return () => {
      cancelAnimationFrame(bingkai);
      pengamat.disconnect();
      window.removeEventListener("pointermove", saatKursor);
      window.removeEventListener("scroll", mulai);
      document.removeEventListener("visibilitychange", mulai);
      kanvas.removeEventListener("webglcontextlost", saatKonteksHilang);
      geometri.dispose();
      material.dispose();
      renderer.dispose();
      kanvas.remove();
    };
  }, [jangkar]);

  return <div ref={wadahRef} className="pb-partikel" />;
}
