"use client";

import { useEffect, useRef } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { DALAM_BALOK, MKG_UJUNG, potongBalok, susunLanskap, xMkg, type BarisLanskap } from "./tata";

/* Lanskap tangga gaji (three.js). Satu draw call untuk 272 balok: geometri kotak yang di-instance,
   ukuran dan warna dihitung di shader dari atribut per balok. Tidak ada loop yang berjalan terus:
   bingkai digambar hanya selama ada yang bergerak (tumbuh awal, sorotan berpindah, kamera mengikuti
   kursor atau gulir), lalu berhenti sampai ada perubahan berikutnya. */

export interface PosisiTangga {
  baris: number;
  anak: number;
}

interface Props {
  baris: BarisLanskap[];
  sorot: PosisiTangga;
  kurangiGerak: boolean;
  onArah: (posisi: PosisiTangga | null) => void;
  onPilih: (posisi: PosisiTangga) => void;
  onSiap: () => void;
  onGagal: () => void;
}

const WARNA_KELOMPOK = ["#a9b8cb", "#7c93b1", "#4b6b95", "#1f3c64"];
const WARNA_EMAS = "#e2a526";
const WARNA_KERTAS = "#f4f1ea";
const LABEL_KELOMPOK = ["Golongan I", "Golongan II", "Golongan III", "Golongan IV"];

const SHADER_VERTEX = /* glsl */ `
  attribute vec4 aKotak;   // x0, x1, z, tinggi
  attribute vec3 aInfo;    // baris, anak, kelompok
  attribute vec2 aSorot;   // sorot anak tangga, sorot baris
  uniform float uTumbuh;
  uniform float uJumlahBaris;
  uniform float uDalam;
  varying vec3 vNormal;
  varying float vKaki;
  varying float vKelompok;
  varying vec2 vSorot;

  void main() {
    float jeda = aInfo.x / uJumlahBaris * 0.6 + aInfo.y * 0.014;
    float t = clamp((uTumbuh - jeda) / 0.5, 0.0, 1.0);
    float g = 1.0 - pow(1.0 - t, 3.0);
    float lebar = (aKotak.y - aKotak.x) * 0.92;
    float tinggi = max(aKotak.w * g, 0.001) + aSorot.x * 0.14;
    vec3 p = position;
    vec3 dunia = vec3(
      (aKotak.x + aKotak.y) * 0.5 + p.x * lebar,
      (p.y + 0.5) * tinggi,
      aKotak.z + p.z * uDalam
    );
    vNormal = normal;
    vKaki = (p.y + 0.5) * tinggi;
    vKelompok = aInfo.z;
    vSorot = aSorot;
    gl_Position = projectionMatrix * viewMatrix * vec4(dunia, 1.0);
  }
`;

const SHADER_FRAGMENT = /* glsl */ `
  uniform vec3 uWarna[4];
  uniform vec3 uEmas;
  uniform vec3 uKertas;
  uniform vec3 uCahaya;
  uniform float uRedup;
  varying vec3 vNormal;
  varying float vKaki;
  varying float vKelompok;
  varying vec2 vSorot;

  void main() {
    vec3 n = normalize(vNormal);
    float atas = step(0.5, n.y);
    float terang = 0.64 + max(dot(n, normalize(uCahaya)), 0.0) * 0.4 + atas * 0.1;
    // Kaki sisi balok sedikit lebih gelap, seperti bayangan pada maket kertas.
    terang *= mix(mix(0.8, 1.0, smoothstep(0.0, 0.5, vKaki)), 1.0, atas);
    vec3 dasar = mix(uWarna[int(vKelompok + 0.5)], uEmas, vSorot.x);
    vec3 warna = dasar * terang;
    warna = mix(warna, uKertas, (1.0 - vSorot.y) * uRedup);
    gl_FragColor = vec4(warna, 1.0);
    #include <colorspace_fragment>
  }
`;

function teksturBayangan(): CanvasTexture {
  const kanvas = document.createElement("canvas");
  kanvas.width = kanvas.height = 256;
  const k = kanvas.getContext("2d")!;
  const gradasi = k.createRadialGradient(128, 128, 10, 128, 128, 128);
  gradasi.addColorStop(0, "rgba(15, 30, 51, 0.2)");
  gradasi.addColorStop(0.55, "rgba(15, 30, 51, 0.08)");
  gradasi.addColorStop(1, "rgba(15, 30, 51, 0)");
  k.fillStyle = gradasi;
  k.fillRect(0, 0, 256, 256);
  return new CanvasTexture(kanvas);
}

export default function LanskapGaji({ baris, sorot, kurangiGerak, onArah, onPilih, onSiap, onGagal }: Props) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<(HTMLSpanElement | null)[]>([]);
  const pinRef = useRef<HTMLSpanElement>(null);
  const aksiRef = useRef({ onArah, onPilih, onSiap, onGagal });
  const sorotRef = useRef(sorot);
  const kurangiRef = useRef(kurangiGerak);
  const mintaGambarRef = useRef<() => void>(() => {});

  useEffect(() => {
    aksiRef.current = { onArah, onPilih, onSiap, onGagal };
  });

  // Preferensi gerak dibaca lewat ref: menggantinya cukup mengubah perilaku, tanpa membangun ulang scene.
  useEffect(() => {
    kurangiRef.current = kurangiGerak;
    mintaGambarRef.current();
  }, [kurangiGerak]);

  useEffect(() => {
    sorotRef.current = sorot;
    mintaGambarRef.current();
  }, [sorot]);

  useEffect(() => {
    const wadah = wadahRef.current;
    if (!wadah) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      aksiRef.current.onGagal();
      return;
    }
    const kanvas = renderer.domElement;
    kanvas.className = "tg-webgl";
    renderer.setClearColor(0x000000, 0);
    wadah.prepend(kanvas);

    const tata = susunLanskap(baris);
    const n = tata.balok.length;
    const scene = new Scene();
    const kamera = new PerspectiveCamera(26, 1, 0.5, 200);

    // Geometri kotak satuan yang di-instance; posisi, lebar, dan tinggi balok dihitung di shader.
    const kotak = new BoxGeometry(1, 1, 1);
    const geometri = new InstancedBufferGeometry();
    geometri.index = kotak.index;
    geometri.setAttribute("position", kotak.getAttribute("position"));
    geometri.setAttribute("normal", kotak.getAttribute("normal"));
    geometri.instanceCount = n;
    const dataKotak = new Float32Array(n * 4);
    const dataInfo = new Float32Array(n * 3);
    const dataSorot = new Float32Array(n * 2);
    tata.balok.forEach((b, i) => {
      dataKotak.set([b.x0, b.x1, b.z, b.tinggi], i * 4);
      dataInfo.set([b.baris, b.anak, b.kelompok], i * 3);
    });
    const atributSorot = new InstancedBufferAttribute(dataSorot, 2).setUsage(DynamicDrawUsage);
    geometri.setAttribute("aKotak", new InstancedBufferAttribute(dataKotak, 4));
    geometri.setAttribute("aInfo", new InstancedBufferAttribute(dataInfo, 3));
    geometri.setAttribute("aSorot", atributSorot);

    const bahan = new ShaderMaterial({
      vertexShader: SHADER_VERTEX,
      fragmentShader: SHADER_FRAGMENT,
      uniforms: {
        uTumbuh: { value: kurangiRef.current ? 2 : 0 },
        uJumlahBaris: { value: baris.length },
        uDalam: { value: DALAM_BALOK },
        uWarna: { value: WARNA_KELOMPOK.map((w) => new Color(w)) },
        uEmas: { value: new Color(WARNA_EMAS) },
        uKertas: { value: new Color(WARNA_KERTAS) },
        uCahaya: { value: new Vector3(-0.55, 0.85, 0.45) },
        uRedup: { value: 0.16 },
      },
    });
    const lanskap = new Mesh(geometri, bahan);
    lanskap.frustumCulled = false;
    scene.add(lanskap);

    const tekstur = teksturBayangan();
    const bahanBayangan = new MeshBasicMaterial({ map: tekstur, transparent: true, depthWrite: false });
    const bayangan = new Mesh(new PlaneGeometry(tata.setengahLebar * 2 + 4, tata.setengahDalam * 2 + 4), bahanBayangan);
    bayangan.rotation.x = -Math.PI / 2;
    bayangan.position.y = -0.002;
    scene.add(bayangan);

    // Titik jangkar label (dunia) yang diproyeksikan ke layar setiap bingkai digambar. Label golongan
    // duduk di ujung kanan anak tangga tertinggi tiap golongan, sehingga tidak tertutup baris lain.
    const puncakKelompok = [0, 1, 2, 3].map((k) =>
      tata.balok
        .filter((b) => b.kelompok === k)
        .reduce<(typeof tata.balok)[number] | null>((a, b) => (!a || b.tinggi > a.tinggi ? b : a), null),
    );
    const jangkar = [
      ...puncakKelompok.map((b) => (b ? new Vector3(b.x1 + 0.25, b.tinggi, b.z) : null)),
      new Vector3(xMkg(0), 0, tata.setengahDalam + 0.45),
      new Vector3(xMkg(MKG_UJUNG - 2), 0, tata.setengahDalam + 0.45),
    ];

    // Sorotan per balok bergerak menuju sasaran agar perpindahan terasa lembut.
    const sasaranSorot = new Float32Array(n * 2);
    const hitungSasaran = () => {
      const s = sorotRef.current;
      tata.balok.forEach((b, i) => {
        sasaranSorot[i * 2] = b.baris === s.baris && b.anak === s.anak ? 1 : 0;
        sasaranSorot[i * 2 + 1] = b.baris === s.baris ? 1 : 0;
      });
    };
    hitungSasaran();
    if (kurangiRef.current) dataSorot.set(sasaranSorot);

    // Kamera mengorbit titik tengah lanskap: sudut dasar, ditambah geser kursor dan gulir.
    const target = new Vector3(0, 0.55, -0.4);
    const kam = { azimut: -0.62, kutub: 1.04, jarak: 30 };
    const sasaranKam = { ...kam };
    const kursor = new Vector2(0, 0);
    let gulir = 0;
    let lebar = 1;
    let tinggi = 1;
    let bingkai = 0;
    let waktuLalu = 0;
    let terlihat = true;
    let berjalanSekali = false;
    let dibuang = false;

    const jarakPas = () => {
      // Jarak agar lebar lanskap (ditambah label) muat di sudut pandang horizontal.
      const tanV = Math.tan(((kamera.fov / 2) * Math.PI) / 180);
      const tanH = tanV * kamera.aspect;
      const setengah = tata.setengahLebar + 0.5;
      return (Math.max(setengah / tanH, (tata.tinggiMaks + 1.6) / tanV) + tata.setengahDalam * 0.25) * 1.08;
    };

    const aturSasaranKamera = () => {
      const diam = kurangiRef.current;
      sasaranKam.azimut = -0.62 + (diam ? 0 : kursor.x * 0.1 + gulir * 0.22);
      sasaranKam.kutub = 1.04 + (diam ? 0 : kursor.y * 0.05 - gulir * 0.1);
      sasaranKam.jarak = jarakPas() * (1 - gulir * 0.06);
    };

    let kotakKanvas = kanvas.getBoundingClientRect();
    const ukur = () => {
      lebar = Math.max(1, wadah.clientWidth);
      tinggi = Math.max(1, wadah.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lebar < 600 ? 1.75 : 2));
      renderer.setSize(lebar, tinggi, false);
      kamera.aspect = lebar / tinggi;
      kamera.updateProjectionMatrix();
      aturSasaranKamera();
      kotakKanvas = kanvas.getBoundingClientRect();
      if (kurangiRef.current || !berjalanSekali) Object.assign(kam, sasaranKam);
    };

    const letakkanLabel = () => {
      const v = new Vector3();
      jangkar.forEach((titik, i) => {
        const el = labelRef.current[i];
        // Label yang disembunyikan CSS (layar sempit) atau tanpa jangkar tidak perlu dihitung tiap bingkai.
        if (!el || !titik || el.offsetParent === null) return;
        v.copy(titik).project(kamera);
        const px = ((v.x + 1) / 2) * lebar;
        const py = ((1 - v.y) / 2) * tinggi;
        el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        // Label yang jatuh di luar kanvas (misalnya saat kamera berputar) disembunyikan agar tidak menimpa teks lain.
        el.style.visibility = px < 0 || px > lebar - 40 || py < 8 || py > tinggi - 8 ? "hidden" : "";
      });
      const pin = pinRef.current;
      const s = sorotRef.current;
      const b = tata.balok.find((x) => x.baris === s.baris && x.anak === s.anak);
      if (pin && b) {
        const tumbuh = Math.min(1, Math.max(0, bahan.uniforms.uTumbuh.value - 0.6));
        v.set((b.x0 + b.x1) / 2, b.tinggi + 0.14, b.z).project(kamera);
        pin.style.transform = `translate3d(${((v.x + 1) / 2) * lebar}px, ${((1 - v.y) / 2) * tinggi}px, 0)`;
        pin.style.opacity = String(tumbuh);
      }
    };

    const gambar = (waktu: number) => {
      bingkai = 0;
      if (dibuang) return;
      const dt = Math.min(0.05, waktuLalu ? (waktu - waktuLalu) / 1000 : 0.016);
      waktuLalu = waktu;
      let bergerak = false;

      const u = bahan.uniforms.uTumbuh;
      if (u.value < 2) {
        u.value = Math.min(2, u.value + dt / 0.95);
        bergerak = true;
      }

      const laju = 1 - Math.exp(-dt * 9);
      let sorotBerubah = false;
      for (let i = 0; i < dataSorot.length; i++) {
        const selisih = sasaranSorot[i] - dataSorot[i];
        if (Math.abs(selisih) > 0.002) {
          dataSorot[i] += selisih * laju;
          sorotBerubah = true;
        } else if (selisih !== 0) {
          dataSorot[i] = sasaranSorot[i];
          sorotBerubah = true;
        }
      }
      if (sorotBerubah) {
        atributSorot.needsUpdate = true;
        bergerak = true;
      }

      const lajuKam = 1 - Math.exp(-dt * 5);
      for (const k of ["azimut", "kutub", "jarak"] as const) {
        const selisih = sasaranKam[k] - kam[k];
        if (Math.abs(selisih) > 1e-4) {
          kam[k] += selisih * lajuKam;
          bergerak = true;
        } else kam[k] = sasaranKam[k];
      }
      const sinKutub = Math.sin(kam.kutub);
      kamera.position.set(
        target.x + kam.jarak * sinKutub * Math.sin(kam.azimut),
        target.y + kam.jarak * Math.cos(kam.kutub),
        target.z + kam.jarak * sinKutub * Math.cos(kam.azimut),
      );
      kamera.lookAt(target);

      renderer.render(scene, kamera);
      letakkanLabel();

      if (!berjalanSekali) {
        berjalanSekali = true;
        wadah.dataset.siap = "1";
        aksiRef.current.onSiap();
      }
      if (bergerak && terlihat) bingkai = requestAnimationFrame(gambar);
      else waktuLalu = 0;
    };

    const minta = () => {
      if (!bingkai && !dibuang && terlihat) bingkai = requestAnimationFrame(gambar);
    };
    mintaGambarRef.current = () => {
      hitungSasaran();
      if (kurangiRef.current) {
        bahan.uniforms.uTumbuh.value = 2;
        dataSorot.set(sasaranSorot);
        atributSorot.needsUpdate = true;
      }
      minta();
    };

    ukur();
    const pengamatUkuran = new ResizeObserver(() => {
      ukur();
      minta();
    });
    pengamatUkuran.observe(wadah);

    const pengamatLayar = new IntersectionObserver(([e]) => {
      terlihat = e.isIntersecting;
      if (terlihat) minta();
    });
    pengamatLayar.observe(wadah);

    // Gulir: lanskap sedikit berputar saat panggung meninggalkan layar.
    let bingkaiGulir = 0;
    const bacaGulir = () => {
      bingkaiGulir = 0;
      const kotakWadah = wadah.getBoundingClientRect();
      kotakKanvas = kanvas.getBoundingClientRect();
      gulir = Math.min(1, Math.max(0, -kotakWadah.top / Math.max(1, kotakWadah.height)));
      aturSasaranKamera();
      minta();
    };
    const saatGulir = () => {
      if (!terlihat || kurangiRef.current || bingkaiGulir) return;
      bingkaiGulir = requestAnimationFrame(bacaGulir);
    };
    window.addEventListener("scroll", saatGulir, { passive: true });

    // Kursor dan sentuh: arahkan untuk pratinjau, ketuk atau klik untuk mengunci pilihan.
    const sinar = new Raycaster();
    const ndc = new Vector2();
    const balokDiTitik = (e: PointerEvent) => {
      if (bahan.uniforms.uTumbuh.value < 1.4) return -1;
      const k = kotakKanvas;
      ndc.set(((e.clientX - k.left) / k.width) * 2 - 1, -((e.clientY - k.top) / k.height) * 2 + 1);
      sinar.setFromCamera(ndc, kamera);
      const { origin: o, direction: d } = sinar.ray;
      const asal = [o.x, o.y, o.z] as const;
      const arah = [d.x, d.y, d.z] as const;
      let terpilih = -1;
      let jarak = Infinity;
      tata.balok.forEach((b, i) => {
        // Balok yang sedang disorot sedikit lebih tinggi; ikut diperhitungkan agar pilihan tepat.
        const naik = dataSorot[i * 2] * 0.14;
        const t = potongBalok(asal, arah, naik ? { ...b, tinggi: b.tinggi + naik } : b);
        if (t !== null && t < jarak) {
          jarak = t;
          terpilih = i;
        }
      });
      return terpilih;
    };
    let arahTerakhir = -2;
    const saatGerak = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        const k = kotakKanvas;
        kursor.set(((e.clientX - k.left) / k.width) * 2 - 1, ((e.clientY - k.top) / k.height) * 2 - 1);
        aturSasaranKamera();
        minta();
        const i = balokDiTitik(e);
        if (i !== arahTerakhir) {
          arahTerakhir = i;
          aksiRef.current.onArah(i < 0 ? null : { baris: tata.balok[i].baris, anak: tata.balok[i].anak });
          kanvas.style.cursor = i < 0 ? "" : "pointer";
        }
      }
    };
    const saatKeluar = () => {
      tekan = null;
      kursor.set(0, 0);
      aturSasaranKamera();
      minta();
      arahTerakhir = -2;
      aksiRef.current.onArah(null);
    };
    let tekan: { x: number; y: number } | null = null;
    const saatTekan = (e: PointerEvent) => {
      tekan = { x: e.clientX, y: e.clientY };
    };
    const saatLepas = (e: PointerEvent) => {
      const awal = tekan;
      tekan = null;
      if (!awal || Math.hypot(e.clientX - awal.x, e.clientY - awal.y) > 8) return;
      const i = balokDiTitik(e);
      if (i >= 0) aksiRef.current.onPilih({ baris: tata.balok[i].baris, anak: tata.balok[i].anak });
    };
    kanvas.addEventListener("pointermove", saatGerak);
    kanvas.addEventListener("pointerleave", saatKeluar);
    kanvas.addEventListener("pointerdown", saatTekan);
    kanvas.addEventListener("pointerup", saatLepas);
    kanvas.addEventListener("pointercancel", saatKeluar);

    const saatKonteksHilang = (e: Event) => {
      e.preventDefault();
      aksiRef.current.onGagal();
    };
    kanvas.addEventListener("webglcontextlost", saatKonteksHilang);

    minta();

    return () => {
      dibuang = true;
      cancelAnimationFrame(bingkai);
      cancelAnimationFrame(bingkaiGulir);
      mintaGambarRef.current = () => {};
      pengamatUkuran.disconnect();
      pengamatLayar.disconnect();
      window.removeEventListener("scroll", saatGulir);
      kanvas.removeEventListener("pointermove", saatGerak);
      kanvas.removeEventListener("pointerleave", saatKeluar);
      kanvas.removeEventListener("pointerdown", saatTekan);
      kanvas.removeEventListener("pointerup", saatLepas);
      kanvas.removeEventListener("pointercancel", saatKeluar);
      kanvas.removeEventListener("webglcontextlost", saatKonteksHilang);
      kotak.dispose();
      geometri.dispose();
      bahan.dispose();
      bayangan.geometry.dispose();
      bahanBayangan.dispose();
      tekstur.dispose();
      // dispose() hanya membuang cache; konteks GL baru benar-benar lepas lewat forceContextLoss().
      renderer.forceContextLoss();
      renderer.dispose();
      kanvas.remove();
    };
  }, [baris]);

  return (
    <div className="tg-3d" ref={wadahRef} aria-hidden="true">
      {LABEL_KELOMPOK.map((label, i) => (
        <span key={label} className="tg-label tg-label-kelompok" ref={(el) => void (labelRef.current[i] = el)}>
          {label}
        </span>
      ))}
      <span className="tg-label tg-label-sumbu" ref={(el) => void (labelRef.current[4] = el)}>
        MKG 0
      </span>
      <span className="tg-label tg-label-sumbu" ref={(el) => void (labelRef.current[5] = el)}>
        MKG 32
      </span>
      <span className="tg-pin" ref={pinRef} />
    </div>
  );
}

