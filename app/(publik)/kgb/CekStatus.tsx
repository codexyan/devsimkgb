"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { infoStatusKgb } from "@/lib/statusKgb";
import { kurangiGerak as kurangiGerakPengguna } from "@/lib/ui/gerak";

/* Bentuk tanggapan POST /api/public/cek-kgb. Cek publik hanya mengirim yang perlu untuk mengetahui status
   KGB (lib/cekKgbPublik.ts): nama disamarkan, status, dan tanggal. Semua kolom diperlakukan opsional. */
interface KgbTerbaru {
  status?: string | null;
  tmtKgbBaru?: string | null;
  flagRapelan?: boolean | string | null;
}

interface HasilCek {
  namaSamaran?: string | null;
  tmtKgbBerikutnya?: string | null;
  kgbTerbaru?: KgbTerbaru | null;
}

interface Galat {
  judul: string;
  pesan: string;
  saran?: string;
}

const POLA_NIP = /^\d{18}$/;
const ZONA_WAKTU = "Asia/Makassar";

function teks(nilai: unknown): string {
  if (typeof nilai === "number" && Number.isFinite(nilai)) return String(nilai);
  return typeof nilai === "string" && nilai.trim() ? nilai.trim() : "-";
}

function tanggal(nilai: unknown, opsi: Intl.DateTimeFormatOptions): string {
  if (typeof nilai !== "string" || !nilai.trim()) return "-";
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { ...opsi, timeZone: ZONA_WAKTU }).format(d);
}

function benar(nilai: unknown): boolean {
  return nilai === true || (typeof nilai === "string" && nilai.trim().toLowerCase() === "true");
}

function kalimat(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function pesanDariApi(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data) {
    const pesan = (data as { error: unknown }).error;
    if (typeof pesan === "string" && pesan.trim()) return kalimat(pesan.trim());
  }
  return null;
}

const IkonCari = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const IkonSilang = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export default function CekStatus() {
  const id = useId();
  const idNip = `${id}-nip`;
  const idTempat = `${id}-tempat`;
  const idPetunjuk = `${id}-petunjuk`;
  const idGalatNip = `${id}-galat`;
  const idPanel = `${id}-panel`;
  const idJudul = `${id}-judul`;

  const [nip, setNip] = useState("");
  const [tempatLahir, setTempatLahir] = useState("");
  const tempatRef = useRef<HTMLInputElement>(null);
  const [galatNip, setGalatNip] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState<HasilCek | null>(null);
  const [galat, setGalat] = useState<Galat | null>(null);

  const wadahRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const judulRef = useRef<HTMLHeadingElement>(null);
  const nomorRef = useRef(0);
  const pengendaliRef = useRef<AbortController | null>(null);

  const panelBuka = !!(hasil || galat);

  const tutupPanel = (fokusKeInput = false) => {
    setHasil(null);
    setGalat(null);
    if (fokusKeInput) inputRef.current?.focus();
  };

  useEffect(() => {
    const pengendali = pengendaliRef;
    return () => pengendali.current?.abort();
  }, []);

  // Hasil yang baru tampil mendapat fokus (dibacakan pembaca layar) dan digulir ke dalam layar bila perlu.
  // Pesan galat tidak mengambil fokus, supaya NIP bisa langsung diperbaiki.
  useEffect(() => {
    if (!panelBuka) return;
    const kurangiGerak = kurangiGerakPengguna();
    const panel = wadahRef.current?.querySelector<HTMLElement>(".cs-panel");
    if (hasil) judulRef.current?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: "nearest", behavior: kurangiGerak ? "auto" : "smooth" });
  }, [panelBuka, hasil]);

  // "/" memfokuskan kolom NIP, kecuali saat sedang mengetik di kolom lain.
  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", saatTombol);
    return () => document.removeEventListener("keydown", saatTombol);
  }, []);

  // Panel hasil tertutup saat mengetuk di luar kotak cari atau menekan Escape.
  useEffect(() => {
    if (!panelBuka) return;
    const tutup = () => {
      setHasil(null);
      setGalat(null);
    };
    const saatTekan = (e: PointerEvent) => {
      if (wadahRef.current && !wadahRef.current.contains(e.target as Node)) tutup();
    };
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      tutup();
      inputRef.current?.focus();
    };
    document.addEventListener("pointerdown", saatTekan);
    document.addEventListener("keydown", saatTombol);
    return () => {
      document.removeEventListener("pointerdown", saatTekan);
      document.removeEventListener("keydown", saatTombol);
    };
  }, [panelBuka]);

  async function cari(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (memuat) return;

    const bersih = nip.replace(/\s+/g, "");
    if (bersih !== nip) setNip(bersih);

    if (!POLA_NIP.test(bersih)) {
      setGalatNip(bersih ? "NIP harus 18 angka." : "Masukkan NIP terlebih dahulu.");
      setHasil(null);
      setGalat(null);
      inputRef.current?.focus();
      return;
    }

    if (tempatLahir.trim().length < 3) {
      setGalatNip("Isi tempat lahir sesuai data kepegawaian Anda.");
      setHasil(null);
      setGalat(null);
      tempatRef.current?.focus();
      return;
    }

    setGalatNip("");
    pengendaliRef.current?.abort();
    const pengendali = new AbortController();
    pengendaliRef.current = pengendali;
    const nomor = ++nomorRef.current;

    setMemuat(true);
    setHasil(null);
    setGalat(null);

    try {
      // POST, bukan GET: tempat lahir tidak boleh tercatat di alamat, riwayat peramban, atau log server.
      const res = await fetch("/api/public/cek-kgb", {
        method: "POST",
        signal: pengendali.signal,
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ nip: bersih, tempatLahir: tempatLahir.trim() }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (nomor !== nomorRef.current) return;

      if (res.status === 404) {
        setGalat({
          judul: "Data tidak cocok",
          pesan: pesanDariApi(data) ?? "Data tidak ditemukan atau tempat lahir tidak cocok.",
          saran:
            "Tulis tempat lahir seperti di data kepegawaian, mis. Banjarmasin. Bila yakin sudah benar, tempat lahir Anda mungkin belum tercatat: hubungi pengelola kepegawaian di satker Anda.",
        });
      } else if (res.status === 429) {
        setGalat({ judul: "Terlalu banyak pencarian", pesan: "Tunggu sebentar, lalu coba lagi." });
      } else if (!res.ok) {
        setGalat({ judul: "Pencarian gagal", pesan: pesanDariApi(data) ?? "Terjadi kesalahan sistem. Coba lagi." });
      } else if (data && typeof data === "object") {
        setHasil(data as HasilCek);
      } else {
        setGalat({ judul: "Pencarian gagal", pesan: "Tanggapan server tidak dapat dibaca. Coba lagi." });
      }
    } catch (err) {
      if (nomor !== nomorRef.current || (err instanceof DOMException && err.name === "AbortError")) return;
      setGalat({ judul: "Pencarian gagal", pesan: "Gagal menghubungi server. Periksa koneksi, lalu coba lagi." });
    } finally {
      if (nomor === nomorRef.current) setMemuat(false);
    }
  }

  const kgb = hasil?.kgbTerbaru ?? null;
  const status = typeof kgb?.status === "string" ? kgb.status : "";
  const info = infoStatusKgb(status);
  // Tanda rapelan hanya berarti untuk KGB yang sudah diinput dan belum dikonfirmasi keuangan.
  const tampilkanRapel =
    kgb !== null && benar(kgb.flagRapelan) && (status === "sedang_diproses" || status === "menunggu_keuangan");

  return (
    <div className="cs" ref={wadahRef} data-buka={panelBuka ? "1" : "0"}>
      <form role="search" aria-label="Cek status KGB berdasarkan NIP dan tempat lahir" onSubmit={cari} noValidate>
        <label htmlFor={idNip} className="cs-label">
          Cek status KGB dengan NIP dan tempat lahir
        </label>
        <div className="cs-bidang" aria-busy={memuat}>
          <span className="cs-ikon">{IkonCari}</span>
          <input
            ref={inputRef}
            id={idNip}
            name="nip"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            placeholder="18 angka, tanpa spasi"
            value={nip}
            onChange={(e) => {
              setNip(e.target.value);
              if (galatNip) setGalatNip("");
            }}
            aria-describedby={galatNip ? `${idGalatNip} ${idPetunjuk}` : idPetunjuk}
            aria-invalid={galatNip ? true : undefined}
            aria-controls={panelBuka ? idPanel : undefined}
          />
          {nip && !memuat && (
            <button
              type="button"
              className="cs-hapus"
              aria-label="Kosongkan NIP"
              onClick={() => {
                setNip("");
                setGalatNip("");
                tutupPanel(true);
              }}
            >
              {IkonSilang}
            </button>
          )}
          <span className="cs-pemisah" aria-hidden="true" />
          <label htmlFor={idTempat} className="pub-visually-hidden">
            Tempat lahir
          </label>
          <input
            ref={tempatRef}
            id={idTempat}
            name="tempat-lahir"
            className="cs-tempat"
            type="text"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            placeholder="Tempat lahir"
            value={tempatLahir}
            onChange={(e) => {
              setTempatLahir(e.target.value);
              if (galatNip) setGalatNip("");
            }}
            aria-describedby={idPetunjuk}
          />
          <kbd className="cs-kbd" aria-hidden="true">
            /
          </kbd>
          <button type="submit" className="cs-kirim" disabled={memuat}>
            {memuat && <span className="cs-putar" aria-hidden="true" />}
            {memuat ? "Mencari" : "Cek status"}
          </button>
        </div>
        <p id={idPetunjuk} className="pub-visually-hidden">
          NIP terdiri atas 18 angka. Tempat lahir ditulis seperti di data kepegawaian, huruf besar kecil tidak berpengaruh.
        </p>
        {galatNip && (
          <p id={idGalatNip} className="cs-galat" role="alert">
            {galatNip}
          </p>
        )}
      </form>

      <p className="pub-visually-hidden" role="status">
        {memuat ? "Mencari data KGB" : hasil ? "Hasil pencarian ditampilkan" : galat ? galat.judul : ""}
      </p>

      {panelBuka && (
        <div className="cs-panel" id={idPanel}>
          {galat && (
            <div className="cs-galat-panel">
              <h2 id={idJudul} ref={judulRef} tabIndex={-1} className="cs-panel-judul">
                {galat.judul}
              </h2>
              <p>{galat.pesan}</p>
              {galat.saran && <p>{galat.saran}</p>}
            </div>
          )}

          {hasil && (
            <section aria-labelledby={idJudul}>
              <div className="cs-kepala">
                <h2 id={idJudul} ref={judulRef} tabIndex={-1} className="cs-panel-judul">
                  {teks(hasil.namaSamaran)}
                </h2>
                <p className="cs-meta">Nama disamarkan demi pelindungan data pribadi.</p>
              </div>

              <div className="cs-status">
                {kgb ? (
                  <>
                    <div className="cs-lencana">
                      <span className={`pub-status ${info.kelas}`.trim()}>{info.label || "-"}</span>
                      {tampilkanRapel && <span className="pub-status pub-status-rapelan">Berpotensi rapelan</span>}
                    </div>
                    {info.keterangan && <p>{info.keterangan}</p>}
                  </>
                ) : (
                  <>
                    <div className="cs-lencana">
                      <span className="pub-status">Belum ada data KGB</span>
                    </div>
                    <p>Hubungi pengelola kepegawaian di satker Anda untuk memastikan data KGB sudah dicatat.</p>
                  </>
                )}
              </div>

              <dl className="cs-rinci">
                <div>
                  <dt>Periode KGB</dt>
                  <dd>{tanggal(kgb?.tmtKgbBaru, { month: "long", year: "numeric" })}</dd>
                </div>
                <div>
                  <dt>TMT KGB berikutnya</dt>
                  <dd>{tanggal(hasil.tmtKgbBerikutnya, { day: "numeric", month: "long", year: "numeric" })}</dd>
                </div>
              </dl>

              {tampilkanRapel && (
                <p className="cs-catatan">
                  KGB ini diproses setelah batas waktu, tetapi TMT tidak berubah. Jika SK terbit setelah TMT, selisih
                  gaji sejak TMT dibayarkan sebagai kekurangan gaji.
                </p>
              )}
            </section>
          )}

          <div className="cs-kaki">
            {hasil ? (
              <Link href="/kgb#status" className="cs-kaki-tautan" onClick={() => tutupPanel()}>
                Arti setiap status
              </Link>
            ) : (
              <span />
            )}
            <button type="button" className="cs-tutup" onClick={() => tutupPanel(true)}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
